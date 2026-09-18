/**
 * WorldSystem.js —— 世界卡池系统（纯逻辑层）（2.9）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/worlds.js（十二世界 · 熟练度 · 抽取规则）
 *
 * 口径（设计增补 v1.2 + 开发计划 §四 2.9）：
 *   · 开局抽世界：12 池等概率（各 1/12）；开局免费重掷 1 次（重掷排除当前世界）
 *   · 世界修正生效：产出 rateMul（含熟练度）／ 寿元流速 ／ 天劫强度 ／ 灵根突破成本
 *   · 同界轮回熟练度：每世 +3%（封顶 +15%），乘进产出修正；触发点随转世系统（阶段二）
 *   · 界游符换界 / 界镜道具重掷（V5.3 A4c 已实装）：兑领走 `buyTravel`（界镜每日限购 1 件）、
 *     使用走 `useTravel` → `_swapAtomic`（**原子换界**：世界修正 ＋ 熟练度清零 ＋ 专属机制两叶一起切）；
 *     随机换界（排除当前界），无定向套利；参数块在 data/worldMechanics.js → `WORLD_TRAVEL`
 *
 * 存档子树：state.world（null＝尚未抽世界；懒建兜底，老档自动补全）
 * 跨模块接线（13.1②，均由 main.js 中转）：
 *   · CultivationSystem 注入本实例 → 只读 rateMul / rootCostMul / trialMul 报价，不写 state.world
 *   · LifespanSystem 注入本实例 → 只读 lifespanDays（世界寿元流速），不写 state.world
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { WORLDS, MASTERY, DRAW, getWorld, rollWorldIndex, rerollWorldIndex } from '../data/worlds.js'
// 寿元基准流速（1 现实分钟 = 1 游戏天）——世界只提供倍率，绝对值从这里取，避免两处漂移
import { LIFESPAN } from '../data/lifespan.js'
// V5.3 A4c：换界道具（界镜 / 界游符）——价格 / 每日限购 / 界游之礼表全在数据层（数据先行），本系统不另立数值
import {
  WORLD_TRAVEL, travelPriceStones, travelDayKey, rollTravelGift, travelGiftH, stonesOfH
} from '../data/worldMechanics.js'
import { getItem } from '../data/items.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

class WorldSystem {
  constructor (state) {
    this.state = state
  }

  // ── 存档子树（懒建：老档 world 为 null 时补全结构）────────────────────────
  get s () {
    let w = this.state.world
    if (!w || typeof w !== 'object') {
      w = this.state.world = {
        worldId: null,          // 当前世界 id（数据表 id）；null ＝ 尚未抽取
        masteryPct: 0,          // 同界轮回熟练度（0~0.15，直接存百分比）
        runsInWorld: 1,         // 本界第几世（第 1 世起）
        specialState: {},       // 专属状态（内容批次 2 专属机制用）
        frictionState: {},      // 摩擦状态（内容批次 2 摩擦项用）
        freeRerollLeft: DRAW.freeRerolls,  // 开局免费重掷剩余次数
        rerollCount: 0,         // 累计重掷次数（含免费；界镜＝内容批次 2）
        drawnAt: 0
      }
    }
    // 老档迁移：早期预置结构用 id（带 world_ 前缀）+ masteryPct + runsInWorld
    if (!('worldId' in w)) {
      const rawId = w.id && typeof w.id === 'string' ? w.id.replace(/^world_/, '') : null
      this.state.world = {
        worldId: getWorld(rawId) ? rawId : null,
        masteryPct: typeof w.masteryPct === 'number' ? w.masteryPct : 0,
        runsInWorld: (w.runsInWorld | 0) || 1,
        specialState: (w.specialState && typeof w.specialState === 'object') ? w.specialState : {},
        frictionState: (w.frictionState && typeof w.frictionState === 'object') ? w.frictionState : {},
        freeRerollLeft: DRAW.freeRerolls,
        rerollCount: 0,
        drawnAt: 0
      }
      w = this.state.world
    }
    if (!('freeRerollLeft' in w)) w.freeRerollLeft = DRAW.freeRerolls
    if (!('rerollCount' in w)) w.rerollCount = 0
    if (!('masteryPct' in w)) w.masteryPct = 0
    if (!('runsInWorld' in w)) w.runsInWorld = 1
    if (!('specialState' in w)) w.specialState = {}
    if (!('frictionState' in w)) w.frictionState = {}
    return w
  }

  /** 老档补字段（照 EventSystem.ensure 惯例，返回 this 便于链式） */
  ensure () {
    this.s
    return this
  }

  // ── 基础查询 ─────────────────────────────────────────────────────────────

  get drawn () {
    return !!this.s.worldId
  }

  get world () {
    return getWorld(this.s.worldId)
  }

  /** 同界轮回熟练度加成（+3%/世，封顶 +15%；直接存百分比字段） */
  get masteryPct () {
    return clamp(this.s.masteryPct, 0, MASTERY.cap)
  }

  /** 产出乘区（世界 rateMul × 熟练度加成）；未抽世界 = 中性 1 */
  get rateMul () {
    const w = this.world
    if (!w) return 1
    return w.rateMul * (1 + this.masteryPct)
  }

  /** 寿元流速倍率（相对基准 1 现实分钟 = 1 游戏天）；未抽世界 = 中性 1 */
  get lifespanMul () {
    const w = this.world
    return w && Number.isFinite(w.lifespanMul) ? w.lifespanMul : 1
  }

  /** 寿元流速（游戏天 / 现实秒，供 LifespanSystem 直接用）：基准 × 世界倍率 */
  get lifespanDays () {
    return LIFESPAN.gameDaysPerRealSecond * this.lifespanMul
  }

  /** 天劫强度乘区（破晓星域 1.10）；未抽世界 = 中性 1 */
  get trialMul () {
    const w = this.world
    return w ? w.trialMul : 1
  }

  /**
   * 统一加成接口（V3.5.3）：本系统提供的加成行（只读，无副作用）。
   * 产出乘区 = rateMul（含轮回熟练度）——独立乘法因子，恒给行（未抽界也要有 ×1 中性行）。
   * 注意：只读 this.state.world 直读，**不经 this.s 的懒建兜底**——查询不该长出子树。
   */
  bonusView () {
    const w = this.state.world
    if (!w || !w.worldId) {
      return [{ kind: 'rate', label: '世界·尚未抽定', mul: 1, note: '开局抽世界后生效（含轮回熟练度）' }]
    }
    let name = '未知世界'
    try {
      const meta = getWorld(w.worldId)
      if (meta && meta.name) name = meta.name
    } catch (_) { /* 展示名取不到就用兜底 */ }
    return [{ kind: 'rate', label: `世界·${name}`, mul: this.rateMul, note: '世界修正含轮回熟练度加成' }]
  }

  /** 灵根突破成本修正（青岚界伪灵根 ×1.10）；未抽世界/未登记档位 = 中性 1 */
  rootCostMul (rarity) {
    const w = this.world
    if (!w || !w.rootCost) return 1
    return w.rootCost[rarity] || 1
  }

  // ── 抽取 / 重掷 ─────────────────────────────────────────────────────────

  /** 开局抽世界（等概率 1/12） */
  draw (r = Math.random()) {
    if (this.drawn) return { ok: false, message: '已抽定此世，不可再抽。' }
    const idx = rollWorldIndex(r)
    const w = WORLDS[idx]
    this.s.worldId = w.id
    this.s.drawnAt = Date.now()
    this.s.freeRerollLeft = DRAW.freeRerolls
    return { ok: true, world: w, index: idx }
  }

  /** 开局免费重掷（消耗 1 次；从其余 11 界等概率换一个） */
  reroll (r = Math.random()) {
    if (!this.drawn) return { ok: false, message: '尚未抽取世界。' }
    if (this.s.freeRerollLeft <= 0) {
      return { ok: false, message: '免费重掷已用完（「界镜」每日重掷 · 内容批次 2 上线）。' }
    }
    const prevId = this.s.worldId
    const idx = rerollWorldIndex(prevId, r)
    const w = WORLDS[idx]
    this.s.worldId = w.id
    this.s.freeRerollLeft -= 1
    this.s.rerollCount += 1
    return { ok: true, world: w, index: idx, previousId: prevId, freeRerollLeft: this.s.freeRerollLeft }
  }

  /** 直接指定世界（老档补发基准界用；不影响免费重掷次数） */
  assign (worldId) {
    const w = getWorld(worldId)
    if (!w) return { ok: false, message: `未登记的世界：${worldId}` }
    this.s.worldId = w.id
    if (!this.s.drawnAt) this.s.drawnAt = Date.now()
    return { ok: true, world: w }
  }

  // ── 转世接口（阶段二转世系统调用；本模块只维护字段与修正）──────────────

  /** 同界轮回 +1 世：熟练度 +3%（封顶 +15%）。由转世系统（阶段二）调用。 */
  onRebirth () {
    this.s.masteryPct = clamp(this.s.masteryPct + MASTERY.perRebirth, 0, MASTERY.cap)
    this.s.runsInWorld += 1
    return { runsInWorld: this.s.runsInWorld, masteryPct: this.masteryPct }
  }

  /**
   * 原子换界（V5.3 A4c；内部私有）：**worldId ＋ 熟练度 ＋ 专属机制两叶一起切**，不允许半生效。
   *   · 熟练度：`MASTERY` 口径是「同界轮回」，跨界必须清零（否则可先在一界刷满 +15% 再换界套利）；
   *   · 专属机制：`specialState` / `frictionState`（A3 两叶）随界重置为 {} —— 由 WorldMechanicSystem
   *     的 ensure() 在原界语境内懒建默认值，本系统不 import 任何 system（13.1②）；
   *   · **刻意不动**：`dungeonState.sig`（招牌首通是跨界资产，只换标签与乘数）、积分、`freeRerollLeft`；
   *   · `drawnAt` 刷成换界时刻（新界纪年开始）。
   */
  _swapAtomic (worldId, now = Date.now()) {
    const w = this.s
    const from = w.worldId
    w.worldId = worldId
    w.masteryPct = 0
    w.runsInWorld = 1
    w.specialState = {}
    w.frictionState = {}
    w.drawnAt = now
    return { from, worldId, masteryPct: 0, runsInWorld: 1, cleared: ['specialState', 'frictionState'] }
  }

  /**
   * 界游符换界：切换世界并重置熟练度（阶段二转世系统调用）
   * V5.3 A4c：升级为**原子换界**（熟练度 ＋ 专属机制两叶一并切）——与 `useTravel` 同一路径。
   */
  changeWorld (worldId, now = Date.now()) {
    const w = getWorld(worldId)
    if (!w) return { ok: false, message: `未登记的世界：${worldId}` }
    this._swapAtomic(w.id, now)
    return { ok: true, world: w, masteryPct: 0 }
  }

  // ── V5.3 A4c · 换界道具（界镜 / 界游符）────────────────────────────────────
  //   参数块在 data/worldMechanics.js → WORLD_TRAVEL；物品条目在 data/items.js。
  //   本段只做「兑（花灵石）/ 用（消耗一件 → 换界）」两件事，全部结算在系统内完成。

  /** 行囊快捷访问（老档自愈；照 DungeonSystem.items 同法，不新开存档叶子） */
  get items () {
    const inv = this.state.inventory
    if (!inv || typeof inv !== 'object') this.state.inventory = { items: {} }
    if (!this.state.inventory.items || typeof this.state.inventory.items !== 'object') {
      this.state.inventory.items = {}
    }
    return this.state.inventory.items
  }

  /**
   * 换界道具视图（V5.3 A4c；**纯读**：只读直读 this.state.world，不长子树）
   * @returns {{drawn,worldId,day,mirror,talisman,canReroll,canSwap,giftExpectH,note}}
   */
  travelView (now = Date.now()) {
    const w = this.state.world
    const wt = (w && typeof w === 'object' && w.travelDay && typeof w.travelDay === 'object') ? w.travelDay : null
    const day = travelDayKey(now)
    const level = this.state.player.realm.level
    const stones = (this.state.resources && this.state.resources.stones) | 0
    const bag = (this.state.inventory && this.state.inventory.items) ? this.state.inventory.items : {}
    const worldId = (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : null

    const pack = (kind, itemId) => {
      const spec = WORLD_TRAVEL[kind]
      const price = travelPriceStones(kind, level)
      const limited = spec.dailyLimit > 0
      const usedToday = limited && wt && wt.key === day ? Math.max(0, wt.mirror | 0) : 0
      const leftToday = limited ? Math.max(0, spec.dailyLimit - usedToday) : 0
      return {
        kind,
        itemId,
        name: getItem(itemId).name,
        held: Math.max(0, bag[itemId] | 0),
        priceH: spec.priceH,
        priceStones: price,
        limited,
        dailyLimit: spec.dailyLimit,
        usedToday,
        leftToday,
        affordable: stones >= price,
        canBuy: (!limited || leftToday > 0) && stones >= price
      }
    }
    const mirror = pack('mirror', WORLD_TRAVEL.mirrorItem)
    const talisman = pack('talisman', WORLD_TRAVEL.talismanItem)
    return {
      drawn: !!worldId,
      worldId,
      day,
      mirror,
      talisman,
      canReroll: !!worldId && mirror.held >= 1,
      canSwap: !!worldId && talisman.held >= 1,
      giftExpectH: WORLD_TRAVEL.gift.rolls.reduce((a, r) => a + r.p * travelGiftH(r), 0),
      note: '换界为**原子**切换：世界修正 ＋ 熟练度（清零）＋ 专属机制状态一起换；招牌首通与积分是跨界资产，保留。'
    }
  }

  /**
   * 兑领换界道具（V5.3 A4c）：扣灵石 → 入行囊；界镜受「每日限购 1 件」约束
   * （日键 = 世界域读法 1 现实日 = MECH.dayGameDays 游戏天）。
   * ⚠ 存档叶子 `world.travelDay = { key, mirror }` **只在写入时懒建**（查询不长子树），零迁移。
   */
  buyTravel (kind, now = Date.now()) {
    const spec = WORLD_TRAVEL[kind]
    if (!spec) return { ok: false, message: `未登记的换界道具：${kind}` }
    const itemId = kind === 'mirror' ? WORLD_TRAVEL.mirrorItem : WORLD_TRAVEL.talismanItem
    const name = getItem(itemId).name
    const day = travelDayKey(now)
    const w = this.s
    if (!w.travelDay || typeof w.travelDay !== 'object') w.travelDay = { key: day, mirror: 0 }
    if (w.travelDay.key !== day) { w.travelDay.key = day; w.travelDay.mirror = 0 }
    const used = Math.max(0, w.travelDay.mirror | 0)
    if (spec.dailyLimit > 0 && used >= spec.dailyLimit) {
      return { ok: false, kind, itemId, message: `${name}每日限领 ${spec.dailyLimit} 件，本日已领（${used}/${spec.dailyLimit}）——明日再来。` }
    }
    const price = travelPriceStones(kind, this.state.player.realm.level)
    const stones = this.state.resources.stones | 0
    if (stones < price) {
      return { ok: false, kind, itemId, message: `灵石不足：${name}需 ${price}（现有 ${stones}）。` }
    }
    this.state.resources.stones = stones - price
    this.items[itemId] = (this.items[itemId] | 0) + 1
    if (spec.dailyLimit > 0) w.travelDay.mirror = used + 1
    const left = spec.dailyLimit > 0 ? Math.max(0, spec.dailyLimit - w.travelDay.mirror) : 0
    return {
      ok: true,
      kind,
      itemId,
      spent: price,
      held: this.items[itemId],
      leftToday: left,
      message: `兑得${name} ×1（灵石 −${price}，现有 ${this.items[itemId]} 件）${spec.dailyLimit > 0 ? `；本日额度余 ${left} 件` : ''}。`
    }
  }

  /**
   * 使用换界道具（V5.3 A4c）：消耗 1 件 → **原子换界**（随机换到另一界，排除当前界）
   * @param {'mirror'|'talisman'} kind
   * @param {number} now 时间戳
   * @param {number} r  换界随机数（注入便于自测）
   * @param {number} rg 「界游之礼」随机数（仅 talisman 用；注入便于自测）
   * @returns {{ok,message,from?,to?,prevId?,worldId?,gift?,giftStones?,giftMat?,held?,atomic?}}
   */
  useTravel (kind, now = Date.now(), r = Math.random(), rg = Math.random()) {
    const spec = WORLD_TRAVEL[kind]
    if (!spec) return { ok: false, message: `未登记的换界道具：${kind}` }
    const itemId = kind === 'mirror' ? WORLD_TRAVEL.mirrorItem : WORLD_TRAVEL.talismanItem
    const name = getItem(itemId).name
    if (!this.drawn) return { ok: false, message: '尚未抽定世界，无从换界。' }
    if ((this.items[itemId] | 0) < 1) {
      return { ok: false, message: `行囊里没有${name}——先在世界日常面板兑一件。` }
    }
    const prevId = this.s.worldId
    const idx = rerollWorldIndex(prevId, r)
    const to = WORLDS[idx]
    const atomic = this._swapAtomic(to.id, now)
    this.items[itemId] = (this.items[itemId] | 0) - 1

    const fromName = (getWorld(prevId) || {}).name || prevId
    const out = {
      ok: true,
      kind,
      itemId,
      prevId,
      worldId: to.id,
      from: getWorld(prevId),
      to,
      held: this.items[itemId],
      atomic
    }
    if (kind === 'talisman') {
      // 「界游之礼」＝换界后首个轮回的小机缘（增补 §一.4）——只给灵石或既有材料，不发境界
      const g = rollTravelGift(rg)
      out.gift = g
      out.giftH = travelGiftH(g)
      if (g.kind === 'mats') {
        this.items[g.id] = (this.items[g.id] | 0) + (g.n | 0)
        out.giftMat = { id: g.id, n: g.n }
        out.message = `${name}已焚：${fromName} → ${to.name}（熟练度已清零）。天地补你一份「界游之礼」——${getItem(g.id).name} ×${g.n}。`
      } else {
        const got = stonesOfH(g.h, this.state.player.realm.level)
        this.state.resources.stones = (this.state.resources.stones | 0) + got
        out.giftStones = got
        out.message = `${name}已焚：${fromName} → ${to.name}（熟练度已清零）。天地补你一份「界游之礼」——灵石 +${got}。`
      }
    } else {
      out.message = `${name}一转：${fromName} → ${to.name}（熟练度已清零，专属机制状态随界重置）。`
    }
    return out
  }

  // ── 视图（装配层渲染用，纯读）────────────────────────────────────────────

  view () {
    if (!this.drawn) return { drawn: false }
    const w = this.world
    return {
      drawn: true,
      id: w.id,
      name: w.name,
      tag: w.tag,
      color: w.color,
      identity: w.identity,
      desc: w.desc,
      exclusive: w.exclusive,
      friction: w.friction,
      baseRateMul: w.rateMul,
      rateMul: this.rateMul,
      masteryPct: this.masteryPct,
      lifespanMul: this.lifespanMul,
      lifespanDays: this.lifespanDays,
      trialMul: w.trialMul,
      freeRerollLeft: this.s.freeRerollLeft,
      runsInWorld: this.s.runsInWorld
    }
  }
}

export default WorldSystem
