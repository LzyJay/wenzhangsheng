/**
 * LifespanSystem.js —— 寿元时钟（纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 口径来自 src/data/lifespan.js 与 realms.js 的 REALM_META.lifespanYears。
 *
 * 规则（《设计增补 v1.1》）：
 *   · 按真实时间流逝：1 现实秒 = 2 游戏天（离线同样流逝）
 *   · 破境续命：晋入新大境界 → 上限更新为该境基础值并立即回满
 *   · 寿元 < 20% 警告；耗尽 = 坐化（强制转世，无额外惩罚）
 *
 * ⚠ 阶段一取舍：转世系统属阶段二，故"坐化"暂不执行重置——寿元触底后停在 0 并提示一次，
 *   不中断修行（不擅自发明规则）。阶段二接入转世后把 `onExhausted` 交给转世流程即可。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { LIFESPAN, FIT, getFitTier, yearsPerRealSecond } from '../data/lifespan.js'
import { getRealmMeta, getLevelInfo } from '../data/realms.js'
// 游戏历（主人 2026-09-17）：天机榜冷却 / 在线护佑进度一律用游戏历文案
import { fmtGameDuration } from '../data/gametime.js'

function clamp (v, min, max) {
  return Math.min(Math.max(v, min), max)
}

class LifespanSystem {
  /**
   * @param {object} state 存档状态树
   * @param {object|null} world WorldSystem 实例（2.9：只读 lifespanDays 世界寿元流速，不碰它的子树）
   */
  constructor (state, world = null) {
    this.state = state
    this.world = world
  }

  get data () {
    return this.state.player.lifespan
  }

  get maxYears () {
    return this.data.maxYears
  }

  get remainYears () {
    return Math.max(0, this.data.remainYears)
  }

  /** 剩余比例 0~1 */
  get pct () {
    if (!this.maxYears) return 0
    return Math.min(1, Math.max(0, this.remainYears / this.maxYears))
  }

  get warning () {
    return this.pct < LIFESPAN.warnPct
  }

  get exhausted () {
    return this.remainYears <= 0
  }

  /** 每个现实秒流逝的游戏年（世界摩擦项：幽傩界 2.5 天/秒、人间香火 3 天/秒） */
  get yearsPerSecond () {
    const days = this.world ? this.world.lifespanDays : LIFESPAN.gameDaysPerRealSecond
    return yearsPerRealSecond(days)
  }

  /** 按当前上限，这一境还能撑多久（现实毫秒） */
  get remainingRealMs () {
    return (this.remainYears / this.yearsPerSecond) * 1000
  }

  /** 展示用文本：< 1000 年显示两位小数（能看见在流逝），否则取整 */
  get remainText () {
    const v = this.remainYears
    return v < 1000 ? v.toFixed(2) : String(Math.floor(v))
  }

  get maxText () {
    const v = this.maxYears
    return v < 1000 ? String(v) : String(v)
  }

  /**
   * 时间流逝结算
   * @param {number} dtSec 本次结算的真实秒数（由 CultivationSystem.tick 提供，保证口径一致）
   * @returns {{changed:boolean, lostYears:number, exhaustedNow:boolean, warnNow:boolean}}
   */
  tick (dtSec) {
    if (!(dtSec > 0)) return { changed: false, lostYears: 0, exhaustedNow: false, warnNow: false }
    if (this.state.settings && this.state.settings.paused) {
      return { changed: false, lostYears: 0, exhaustedNow: false, warnNow: false }
    }

    const before = this.remainYears
    const wasWarn = before / this.maxYears < LIFESPAN.warnPct && before > 0
    const lostYears = dtSec * this.yearsPerSecond

    this.data.remainYears = Math.max(0, before - lostYears)
    this.data.lastUpdateAt = Date.now()

    return {
      changed: lostYears > 0,
      lostYears,
      exhaustedNow: before > 0 && this.data.remainYears <= 0,
      warnNow: !wasWarn && this.warning && this.data.remainYears > 0
    }
  }

  /**
   * 破境续命：晋入新大境界 → 上限更新为该境基础值并立即回满
   * @param {number} level 新级数（1~72）
   * @returns {{maxYears:number, gainedYears:number}}
   */
  onRealmChange (level) {
    const info = getLevelInfo(level)
    const realmIndex = Math.floor((info.level - 1) / 9)
    const meta = getRealmMeta(realmIndex)
    const before = this.remainYears
    this.data.maxYears = meta.lifespanYears
    this.data.remainYears = meta.lifespanYears
    this.data.lastUpdateAt = Date.now()
    return { maxYears: meta.lifespanYears, gainedYears: meta.lifespanYears - before, realmName: meta.name }
  }

  /** 延寿（延寿丹等；阶段二接入物品系统后调用） */
  addYears (years) {
    this.data.remainYears = Math.min(this.data.maxYears, this.remainYears + years)
  }

  /**
   * 存档自检：上限与当前境界不符时以境界为准（老档/异常档兜底）
   * 不做"补满"，只把上限对齐，避免老档突然白送一大截寿命。
   */
  syncMaxWithRealm (level) {
    const info = getLevelInfo(level)
    const meta = getRealmMeta(Math.floor((info.level - 1) / 9))
    if (this.data.maxYears !== meta.lifespanYears) {
      this.data.maxYears = meta.lifespanYears
      this.data.remainYears = Math.min(this.remainYears, meta.lifespanYears)
      return true
    }
    return false
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2.11 天道契合区块 —— 顺天值（player.fit）六档修正 + 天机榜任务
  // 存档：fit 本体在 state.player.fit（数据模型 §四 既有字段）；任务进度在本模块
  //   自有子树 state.player.lifespan.quests（模块认领表：2.11 ↔ state.lifespan 线）。
  // 常量源：FIT / FIT.quests（lifespan.js，增补 v1.1 §一）。他人勿写。
  // ════════════════════════════════════════════════════════════════════════

  /** 顺天值兜底（老档无此字段 → 初始 50；越界夹回 0~100） */
  ensureFit () {
    const p = this.state.player
    if (typeof p.fit !== 'number' || !Number.isFinite(p.fit)) p.fit = FIT.initial
    p.fit = clamp(p.fit, 0, 100)
    return p.fit
  }

  get fit () {
    return this.ensureFit()
  }

  get fitTier () {
    return getFitTier(this.fit)
  }

  /** 修炼（灵气产出）乘区：1 + 档位加成 */
  get fitRateMul () {
    return 1 + this.fitTier.cultPct
  }

  /** 渡劫单雷通过率修正（加减 pp，与修为积累/准备加成合流后仍受 0.05~0.95 钳制） */
  get fitTrialPct () {
    return this.fitTier.trialPct
  }

  /**
   * 统一加成接口（V3.5.3）：本系统提供的加成行（只读，无副作用）。
   * 产出乘区 = 天道契合 fitRateMul——独立乘法因子，恒给行（凡常 ×1 也是口径的一部分）。
   */
  bonusView () {
    return [{
      kind: 'rate',
      label: `契合·${this.fitTier.name}`,
      mul: this.fitRateMul,
      note: '顺天值六档同时修正产出与渡劫（2.11）'
    }]
  }

  /** 契合总览（UI 只读此结果） */
  fitView () {
    const fit = this.fit
    const tier = this.fitTier
    const next = tier.max < 100 ? getFitTier(tier.max + 1) : null
    return { fit, tier, next, nextGap: next ? next.min - fit : 0 }
  }

  /**
   * 顺天值增减（事件果报 / 天机榜任务统一入口）
   * @returns {{ok:boolean, fit:number, delta:number, tierChanged:boolean,
   *            fromTier:string, toTier:string, message:string}}
   */
  addFit (delta, reason = '') {
    if (!Number.isFinite(delta) || delta === 0) {
      return { ok: false, fit: this.fit, delta: 0, tierChanged: false, fromTier: this.fitTier.name, toTier: this.fitTier.name, message: '契合无变化。' }
    }
    const before = this.fit
    const val = clamp(before + delta, 0, 100)
    this.state.player.fit = val
    const fromTier = getFitTier(before)
    const toTier = getFitTier(val)
    const tierChanged = toTier.id !== fromTier.id
    const sign = delta > 0 ? '+' : '−'
    return {
      ok: true,
      fit: val,
      delta,
      tierChanged,
      fromTier: fromTier.name,
      toTier: toTier.name,
      message: `天道契合 ${sign}${Math.abs(delta)}（${before} → ${val} · ${toTier.name}）${reason}` +
        (tierChanged ? ` —— ${toTier.name}：产出 ${toTier.cultPct >= 0 ? '+' : ''}${Math.round(toTier.cultPct * 100)}%，渡劫单雷 ${toTier.trialPct >= 0 ? '+' : ''}${Math.round(toTier.trialPct * 100)}%。` : '')
    }
  }

  // ── 天机榜（增补 v1.1 §一 任务样例 MVP 三条，可循环）────────────────────

  /** 任务进度子树兜底（本模块自有：player.lifespan.quests） */
  get quests () {
    const d = this.data
    if (!d.quests || typeof d.quests !== 'object') d.quests = { base: {}, doneAt: {} }
    const q = d.quests
    if (!q.base || typeof q.base !== 'object') q.base = {}
    if (!q.doneAt || typeof q.doneAt !== 'object') q.doneAt = {}
    return q
  }

  /** 清扫妖患的战力门槛（本境基准战力 × powerScale；ctx.power 由装配层传入宗门战力） */
  _powerNeed (quest) {
    const base = getLevelInfo(this.state.player.realm.level).combat.power
    return Math.round(base * (quest.powerScale || 1))
  }

  /** 布雨救旱的灵石花销（随大境界翻倍，防高境白捡） */
  _rainCost (quest) {
    const realmIndex = Math.floor((this.state.player.realm.level - 1) / 9)
    return Math.round(quest.stones * Math.pow(quest.stonesGrowth || 1, realmIndex))
  }

  /**
   * 天机榜全览（UI 只读此结果，不自行判断规则）
   * @param {{nowMs?:number, power?:number}} ctx 装配层注入：now 时间、宗门战力
   */
  questViews (ctx = {}) {
    const now = ctx.nowMs || Date.now()
    const playtime = this.state.meta.playtimeSec | 0
    return FIT.quests.list.map((q) => {
      const doneAt = this.quests.doneAt[q.id] || 0
      const cdSec = Math.max(0, Math.ceil((doneAt + FIT.quests.cdMs - now) / 1000))
      const v = { ...q, cdSec, claimable: false, progressText: '' }

      if (q.kind === 'idle') {
        const base = this.quests.base[q.id] || 0
        const played = Math.max(0, playtime - base)
        v.progress = played
        v.goal = q.idleSec
        v.progressText = `本次已挂机 ${Math.floor(played / 60)} 分（需 ${Math.round(q.idleSec / 60)} 分在线）`
        v.claimable = played >= q.idleSec
        v.state = cdSec > 0 ? 'cd' : (v.claimable ? 'ready' : 'running')
      } else if (q.kind === 'power') {
        const need = this._powerNeed(q)
        const have = Math.round(ctx.power || 0)
        v.progress = have
        v.goal = need
        v.progressText = `战力 ${have} / 需 ${need}`
        v.claimable = have >= need
        v.state = cdSec > 0 ? 'cd' : (v.claimable ? 'ready' : 'running')
      } else if (q.kind === 'stones') {
        const cost = this._rainCost(q)
        const have = this.state.resources.stones | 0
        v.progress = have
        v.goal = cost
        v.progressText = `散财 ${cost} 灵石（现有 ${have}）`
        v.claimable = have >= cost
        v.state = cdSec > 0 ? 'cd' : (v.claimable ? 'ready' : 'lack')
      }
      return v
    })
  }

  /**
   * 领取一次天机榜任务（校验/花销/契合入账一次做完）
   * @param {string} id 任务 id
   * @param {{nowMs?:number, power?:number}} ctx 同 questViews
   */
  claimQuest (id, ctx = {}) {
    const q = FIT.quests.list.find((x) => x.id === id)
    if (!q) return { ok: false, message: '未登记的天机榜任务。' }
    const now = ctx.nowMs || Date.now()
    const doneAt = this.quests.doneAt[q.id] || 0
    const cdSec = Math.max(0, Math.ceil((doneAt + FIT.quests.cdMs - now) / 1000))
    if (cdSec > 0) return { ok: false, message: `「${q.name}」天道尚在观礼，${fmtGameDuration(cdSec * 1000)}（游戏历）后再来。` }

    if (q.kind === 'idle') {
      const base = this.quests.base[q.id] || 0
      const played = Math.max(0, (this.state.meta.playtimeSec | 0) - base)
      if (played < q.idleSec) return { ok: false, message: `「${q.name}」尚差 ${fmtGameDuration((q.idleSec - played) * 1000)}（游戏历）在线护佑。` }
      this.quests.base[q.id] = this.state.meta.playtimeSec | 0   // 以领奖时刻重起算
    } else if (q.kind === 'power') {
      const need = this._powerNeed(q)
      const have = Math.round(ctx.power || 0)
      if (have < need) return { ok: false, message: `「${q.name}」战力不济（${have} / 需 ${need}），妖患未平。` }
    } else if (q.kind === 'stones') {
      const cost = this._rainCost(q)
      if ((this.state.resources.stones | 0) < cost) return { ok: false, message: `「${q.name}」灵石不足（需 ${cost}，现有 ${this.state.resources.stones | 0}）。` }
      this.state.resources.stones -= cost
    }

    this.quests.doneAt[q.id] = now
    const r = this.addFit(q.fit, `（天机榜·${q.name}）`)
    return { ok: true, ...r }
  }
}

export default LifespanSystem
