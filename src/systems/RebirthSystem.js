/**
 * RebirthSystem.js —— 终局与转世（纯逻辑层）（V6.7 · 批 E）
 * ═══════════════════════════════════════════════════════════════════════════
 * 职责：满级飞升之后，把「这一世」收束成一次**转世**——一世资产归零、跨世资产留下，
 *   并给出本界专属的终局演出（青云「剑意超脱」/ 九鼎「功德圆满」/ 无缺「出世」…）。
 *
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM、**禁止 import 任何 system**；
 *   只读写 state。世界侧动作一律走注入的 `WorldSystem` 实例的**既有公开方法**
 *   （`onRebirth()` 同界轮回 / `changeWorld()` 换界），本文件不另造世界语义。
 *
 * 口径来源：
 *   · `data/worlds.js`      —— `MASTERY`（+3%/世、封顶 +15%）、`WORLDS`、`DRAWN` 等既有真源
 *   · `data/storyEndings.js`—— 12 界终局演出 + 转世奖励系数（青云 1.2 / 无缺 1.5）
 *
 * **不改既有方法**：`onRebirth()` 的 +3% 被 V2.9 / V5.3 钉死，本文件只在它之后再**加法补足**
 *   本界系数差额（仍封顶 `MASTERY.cap`）；`changeWorld()` / `_swapAtomic()` 原样调用。
 *
 * 一世 / 跨世 分界（重置清单，照《批 E 探查》结论）：
 *   归零：境界、寿元基准、修为与灵石、功法与装备、宗门、灵兽、渡劫史、事件簿、秘境进度、
 *         专属机制状态、buff、`flags.ascended` / `firstTrialDone`（不清会导致突破永久拦截）
 *   保留：纪事与成就、收益台账、设置、日志、统计、熟练度与世数、跨世宝物、storyState（换界另计）
 *
 * 装配层用法（main.js）：
 *   `const r = rebirth.rebirth('same')` → `await persist('rebirth')` → `window.location.reload()`
 *   （复用既有 doReset 范式：整页重载后所有懒建子树由各 system 的 ensure() 自动重建，最安全）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { WORLDS, getWorld, MASTERY } from '../data/worlds.js'
import { getRealmMeta } from '../data/realms.js'
import { getRootTier } from '../data/roots.js'
import { endShowOf, masteryMulOf, REBIRTH_MODES, LEGACY, legacyLinesOf } from '../data/storyEndings.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

class RebirthSystem {
  /**
   * @param {object} state 存档状态树
   * @param {WorldSystem|null} world 世界系统实例（**只调公开方法** onRebirth / changeWorld；
   *        由 main.js 注入 —— 13.1②：System 之间不横向 import）
   */
  constructor (state, world = null) {
    this.state = state
    this.worldSys = world
  }

  /** 当前世界 id（只读直读、不经懒建，照 DungeonSystem.worldId 惯例） */
  get worldId () {
    const w = this.state.world
    return (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : ''
  }

  /** 是否已飞升（终局的达成标志；`CultivationSystem` 的 ascension 分支写入） */
  get ascended () {
    const p = this.state.player
    return !!(p && p.flags && p.flags.ascended)
  }

  /** 是否可转世：**必须先飞升**（只满级不算——飞升劫还没过，剧情上不合） */
  get canRebirth () {
    return this.ascended
  }

  /** 本界当前熟练度（0~cap） */
  get masteryPct () {
    const w = this.state.world
    const v = w && typeof w.masteryPct === 'number' ? w.masteryPct : 0
    return clamp(v, 0, MASTERY.cap)
  }

  /** 本界第几世 */
  get runsInWorld () {
    const w = this.state.world
    return (w && (w.runsInWorld | 0)) || 1
  }

  /** 终局 / 转世视图（面板消费） */
  view () {
    const wid = this.worldId
    const w = getWorld(wid)
    const show = endShowOf(wid)
    const mul = masteryMulOf(wid)
    const stats = this.state.stats || {}
    return {
      ascended: this.ascended,
      canRebirth: this.canRebirth,
      worldId: wid,
      worldName: w ? w.name : '',
      show,
      modes: REBIRTH_MODES,
      masteryPct: this.masteryPct,
      masteryCap: MASTERY.cap,
      masteryPer: MASTERY.perRebirth * mul,
      masteryMul: mul,
      runsInWorld: this.runsInWorld,
      rebirths: stats.rebirths | 0,
      keeps: ['纪事与成就', '收益台账', '设置与日志', '熟练度与世数（同界）', '跨界宝物'],
      // V6.8 批 F：本界「特色继承」说明 + 当前跨世遗产（面板展示；数值口径在 data/storyEndings.js）
      legacyLines: legacyLinesOf(wid),
      legacy: {
        tiannizhu: (this.state.legacy && this.state.legacy.tiannizhu) || 0,
        gongde: (this.state.legacy && this.state.legacy.gongde) || 0,
        puppetSlots: (this.state.legacy && this.state.legacy.puppetSlots) || 0,
        powerPct: (this.state.legacy && this.state.legacy.powerPct) || 0
      },
      gongdeCutPct: (() => {
        const g = (this.state.legacy && this.state.legacy.gongde) || 0
        return g > 0 ? Math.round(Math.min(LEGACY.gongde.maxCut, g / LEGACY.gongde.fullAt) * 100) : 0
      })()
    }
  }

  /**
   * 执行转世：把「这一世」归零，跨世资产留下。
   * @param {'same'|'other'} mode 同界轮回 / 换界转世
   * @param {{r?:number, force?:boolean, silent?:boolean}} opts
   *        `r` = 换界用的随机数（可注入，便于自测）；`force` = 绕过「须已飞升」——
   *        供**坐化**（寿元耗尽，见 main.js `tickLifespan`）使用：寿元尽即一世终了，不必先飞升。
   * @returns {{ok:boolean, message:string, mode?:string, from?:string, to?:string, show?:object, worldStep?:object}}
   */
  rebirth (mode = 'same', opts = {}, now = Date.now()) {
    const force = !!(opts && opts.force)
    const r = (opts && typeof opts.r === 'number') ? opts.r : Math.random()
    if (!this.canRebirth && !force) {
      return { ok: false, message: '尚未飞升，还未到转世之时。' }
    }
    const s = this.state
    const fromId = this.worldId
    const same = mode !== 'other'
    const show = endShowOf(fromId)
    // V6.8 批 F：**先快照本界功德** —— 下面世界侧操作（同界重置 / 换界原子清）会把 specialState 清空
    const prevGongde = (s.world && s.world.specialState && Number.isFinite(s.world.specialState.gongde))
      ? s.world.specialState.gongde
      : 0

    // ① 世界侧：同界走既有 onRebirth（熟练度 +3%/世、世数 +1）；换界走既有 changeWorld（原子换界）
    let worldStep
    let toId = fromId
    if (same) {
      if (!fromId) return { ok: false, message: '尚未抽定世界，无法转世。' }
      worldStep = this.worldSys ? this.worldSys.onRebirth() : { runsInWorld: this.runsInWorld, masteryPct: this.masteryPct }
      // 本界转世奖励系数（青云 1.2 / 无缺 1.5）：在既有 +3% 之上**加法补足**差额，仍封顶 cap
      const mul = masteryMulOf(fromId)
      if (mul > 1 && s.world) {
        s.world.masteryPct = clamp(this.masteryPct + MASTERY.perRebirth * (mul - 1), 0, MASTERY.cap)
      }
      // 专属机制状态随一世重置（换界由 changeWorld 自动清）
      if (s.world) {
        s.world.specialState = {}
        s.world.frictionState = {}
      }
    } else {
      const pool = WORLDS.filter((x) => x.id !== fromId)
      const pick = pool[Math.min(pool.length - 1, Math.floor(r * pool.length))] || pool[0]
      toId = pick ? pick.id : fromId
      worldStep = this.worldSys ? this.worldSys.changeWorld(toId, now) : { worldId: toId, masteryPct: 0, runsInWorld: 1 }
    }

    // ② 一世资产归零
    this._resetLifeAssets({ same, now })

    // ②b V6.8 批 F：各界「特色继承」落数值（rebirthHook → 天逆珠 / 符种 / 功德 / 傀儡位 / 隐性战力）
    this._settleLegacy({ same, now, gongde: prevGongde })

    // ③ 纪事节拍器解禁（「一世一推」）：清该界卷次留痕，并让节拍器重推当前卷
    const ss = s.storyState
    if (ss && typeof ss === 'object') {
      if (ss.seen && typeof ss.seen === 'object' && fromId) {
        for (const k of Object.keys(ss.seen)) {
          if (k.startsWith(fromId + ':')) delete ss.seen[k]
        }
      }
      ss.volume = 0
    }

    // ④ 跨世留痕
    if (!s.stats || typeof s.stats !== 'object') s.stats = {}
    s.stats.rebirths = (s.stats.rebirths | 0) + 1
    s.stats.lastRebirthAt = now
    if (!Array.isArray(s.stats.rebirthLog)) s.stats.rebirthLog = []
    s.stats.rebirthLog.push({ at: now, mode: same ? 'same' : 'other', from: fromId, to: toId })
    if (s.stats.rebirthLog.length > 24) s.stats.rebirthLog = s.stats.rebirthLog.slice(-24)

    return {
      ok: true,
      mode: same ? 'same' : 'other',
      from: fromId,
      to: toId,
      show,
      worldStep,
      message: same
        ? `第 ${this.runsInWorld} 世开始——${show.title}。熟练度 ${(this.masteryPct * 100).toFixed(1)}%（本界 ×${masteryMulOf(toId)}）。`
        : `换界转世：${(getWorld(fromId) || {}).name || fromId} → ${(getWorld(toId) || {}).name || toId}。`
    }
  }

  /**
   * 一世资产归零（**跨世资产不动**：纪事 / 成就 / econ / settings / log / stats / 熟练度）。
   * @param {{same:boolean, now:number}} opt
   */
  _resetLifeAssets ({ same, now }) {
    const s = this.state
    const p = s.player
    const life0 = getRealmMeta(0)   // 炼气寿元（REALM_META 真源；重载后 LifespanSystem 会再收敛一次）
    const baseYears = (life0 && typeof life0.lifespanYears === 'number') ? life0.lifespanYears : 100

    // 境界与渡劫
    p.realm.level = 1
    p.cooldownUntil = 0
    p.tribul = { preps: {}, nodeStats: {}, history: [], total: { hujie: 0, sect: 0, cure: 0 } }
    if (p.flags && typeof p.flags === 'object') {
      // ⚠ 必清：ascended 不清会让突破永久拦截（CultivationSystem 的 ascended 分支）
      delete p.flags.ascended
      delete p.flags.firstTrialDone
      if (!same) delete p.flags.rootDrawn     // 换界 → 灵根重抽（池子随界变）
    }
    // 寿元：回满（新境界的 maxYears 由 LifespanSystem 在重载后 syncMaxWithRealm 收敛）
    if (p.lifespan && typeof p.lifespan === 'object') {
      p.lifespan.maxYears = baseYears
      p.lifespan.remainYears = baseYears
      p.lifespan.lastUpdateAt = now
    }
    // 灵根（同界保留，换界重抽）
    if (!same) p.root = null

    // 资源与物品
    s.resources.qi = 0
    s.resources.stones = Math.max(s.resources.stones | 0, 100)
    s.resources.contribution = 0
    if (typeof s.resources.daoXing === 'number') s.resources.daoXing = 0
    s.inventory.items = { pill_xisui: 5 }

    // 功法 / 装备 / 势力 / 灵兽
    p.techniqueSlots = { main: null, side: [null, null] }
    p.faction = null
    s.techniques = { ownedTechniques: {} }
    s.sect = null
    s.beast = null
    s.buffs = []

    // 事件簿与秘境进度（招牌首通 / 积分属跨界资产，刻意保留）
    s.eventState = { pending: [], book: [], dedupe: {} }
    if (s.dungeonState && typeof s.dungeonState === 'object') {
      s.dungeonState.cleared = {}
      s.dungeonState.stars = {}
      s.dungeonState.dispatch = { slots: 0, runs: [] }
    }
    s.trialState = { node: 0, consecutiveFails: 0, lastAttemptAt: 0, daoShangUntil: 0 }
  }

  /**
   * V6.8 批 F：各界「转世特色继承」结算（`story.js` 的 `rebirthHook` 在此落成数值）。
   *   破晓 天逆珠 ｜ 望族 符种保底 ｜ 九鼎 功德结转 ｜ 天工 傀儡位 ｜ 观云 隐性战力。
   *   跨世资产（功德 / 傀儡位）只增不减；本世遗产（天逆珠余量 / 隐性战力）每世重发。
   *   数值口径全部来自 `data/storyEndings.js` 的 `LEGACY`，本文件不写死数字。
   */
  _settleLegacy ({ same, now, gongde: gongdeIn = 0 }) {
    const s = this.state
    if (!s.legacy || typeof s.legacy !== 'object') s.legacy = {}
    const lg = s.legacy
    const wid = this.worldId
    const p = s.player

    // ① 本界功德结转（九鼎产功德，其它界恒 0）→ 跨世功德累加并封顶
    //    功德由调用方在**世界侧清空 specialState 之前**快照传入（见 rebirth 的 prevGongde）
    const gongde = Number.isFinite(gongdeIn) ? gongdeIn : 0
    if (gongde > 0) {
      const carry = Math.floor(gongde * LEGACY.gongde.carryPct)
      lg.gongde = Math.min(LEGACY.gongde.cap, Math.max(0, lg.gongde | 0) + carry)
    }
    if (!Number.isFinite(lg.gongde)) lg.gongde = 0
    if (!Number.isFinite(lg.puppetSlots)) lg.puppetSlots = 0

    // ② 本世遗产先归零（每世重发）
    lg.tiannizhu = 0
    lg.powerPct = 0

    // ③ 按界发牌
    if (wid === LEGACY.tiannizhu.world) lg.tiannizhu = LEGACY.tiannizhu.perLife
    if (wid === LEGACY.powerPct.world) lg.powerPct = LEGACY.powerPct.value
    if (wid === LEGACY.puppetSlots.world) {
      const runs = (s.world && (s.world.runsInWorld | 0)) || 1
      lg.puppetSlots = Math.min(LEGACY.puppetSlots.max, Math.max(lg.puppetSlots | 0, runs - 1))
    }

    // ④ 望族符种：**同界**轮回起手不低于真灵根（换界则灵根重抽，不受此保底）
    if (same && wid === LEGACY.rootFloor.world) {
      const floorTier = getRootTier(LEGACY.rootFloor.rarity)
      const cur = (p.root && p.root.rarity) ? getRootTier(p.root.rarity) : null
      const curMul = (cur && cur.mods && typeof cur.mods.rateMul === 'number') ? cur.mods.rateMul : 0
      const floorMul = (floorTier && floorTier.mods) ? floorTier.mods.rateMul : 1
      if (curMul < floorMul) {
        p.root = {
          id: `root_${LEGACY.rootFloor.rarity}`,
          rarity: LEGACY.rootFloor.rarity,
          attrs: [],
          rerollCount: 0,
          lowStreak: 0,
          drawnAt: now
        }
        if (p.flags && typeof p.flags === 'object') p.flags.rootDrawn = true
      }
    }
  }
}

export default RebirthSystem
