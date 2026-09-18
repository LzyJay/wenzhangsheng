/**
 * DungeonSystem.js —— 秘境系统（纯逻辑层）（2.7）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/dungeon.js（试炼塔 · 资源秘境 · 分身派遣）
 *
 * 口径（设计库《秘境副本设计 v1》+《秘境奖励曲线与事件 v1》+ 开发计划 §四 2.7）：
 *   · 试炼塔＝战力标尺：第 m 层推荐战力 = 1.15×power(m)，战力达标方可挑战（确定性，不 roll）
 *   · 首通当量 h → 灵石（复用 events.stoneHourly 时薪，与事件系统同口径）；不发境界只发货币/材料
 *   · 资源秘境：先首通（一次性当量 + 评星），再派遣（挂机产出灵石 + 主题材料）
 *   · 派遣离线照算、到时自动结算并续派；召回按已过时长比例结算
 *   · 周常扫荡：每周一按已通最高层 ×0.2h（上限 20h）发放灵石
 *
 * V3.3.1 增补（主人：秘境要能拿功法 / 古修遗迹要有惊喜或意外 / 只显示基础奖励）：
 *   · 首通某深度 → 必得该档功法一本（未持有优先；档内全持有则折灵石）
 *   · 派遣 / 召回 → 低概率拾得残卷（普通 10%，古修遗迹 25%）
 *   · 古修遗迹（surprise 秘境）结算时 roll 四态：机缘(灵石×2)/残卷/机关(减半且无材料)/寻常
 *   · resourceView.dispatchBase 只给"基础收益/小时"给面板展示（不再逐档罗列）
 *   · 功法授予经注入的 TechniqueSystem.grant（13.1②：不横向 import，只调公开方法）
 *
 * 存档子树：state.dungeonState（SaveSystem 已预留；认领表写作 state.dungeon，以代码为准）
 *   cleared: { tower: 最高塔层, 'res_xxx': 最高深度 }
 *   stars:   { 'res_xxx:深度': 评星 1~3 }
 *   dispatch: { runs: [{ id, dungeonId, depth, hours, startAt, renew }] }
 *   lastSweepWeek: 上次周扫荡周键（周一为界）
 *   —— V5.1 招牌秘境三叶子（ensure() 懒建，老档零迁移）：
 *   points:   秘境积分余额（试炼塔 30 层里程碑 / 招牌首通 / 招牌周期 / 周轮换产出）
 *   sig:      { 'sig_xxx': { first: true, cycleKey: '<轮键>' }, weekly: { week, id } }
 *   shopWeek: 商店购买计数（按周期键留痕，为后续限购/统计预留）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  TOWER, DEPTH_TABLE, RESOURCE_DUNGEONS, DISPATCH, STAR_RULE,
  TECH_BY_DEPTH, TECH_DROP_PCT, TECH_DUP_STONES_H, SURPRISE,
  SIGNATURE, SIGNATURE_DUNGEONS, DUNGEON_SHOP,
  towerPower, towerFirstClearH, towerWeeklyH, towerMilestone,
  getDungeon, getDepth, slotCountFor, dispatchHours, techPoolOf, rollSurprise,
  getSignature, sigFirstClearH, sigCycleH, sigCycleKey, sigCycleMsToNext,
  weeklySignatureId, getShopItem, shopCostOf
} from '../data/dungeon.js'
import { getLevelInfo, getRealmMeta, REALM_META } from '../data/realms.js'
// V5.1 招牌秘境：十二界本源映射（data→data 直读，纯函数；不 import 任何 system）
import { signatureStateOf, originSignaturesOf } from '../data/worlds.js'
import { getItem } from '../data/items.js'
import { stoneHourly } from '../data/events.js'
// 游戏历（主人 2026-09-17）：面板与日志里的时长一律游戏历文案
import { fmtGameDuration } from '../data/gametime.js'

const HOUR_MS = 3600 * 1000
const MIN_SETTLE_MS = 60 * 1000   // 召回低于 1 分钟按 0 结算（防刷）

/** 招牌洞天三态标签（V5.1；口径见 data/worlds.js SIGNATURE_ORIGIN） */
const SIG_STATE_NAME = { origin: '本源洞天', local: '游历洞天', foreign: '他界洞天' }

class DungeonSystem {
  /**
   * @param {object} state 存档状态树
   * @param {TechniqueSystem|null} tech 功法系统（秘境残卷/首通赠功法的落点；
   *        由 main.js 注入 —— 13.1②：System 之间不横向 import，注入引用只调其公开方法）
   * @param {Function|null} powerMul 战力乘区闭包（功法 / 灵兽等常驻加成；由 main.js 注入，
   *        本系统不 import 它们；测试不传则用基准战力）
   */
  constructor (state, tech = null, powerMul = null) {
    this.state = state
    this.tech = tech
    this.powerMul = powerMul
  }

  // ── 基础 ────────────────────────────────────────────────────────────────

  /** 秘境子树兜底（老档补字段）；返回 this 便于链式（照 EventSystem.ensure 惯例） */
  ensure () {
    const d = this.state.dungeonState
    if (!d || typeof d !== 'object') this.state.dungeonState = {}
    const ds = this.state.dungeonState
    if (!ds.cleared || typeof ds.cleared !== 'object') ds.cleared = {}
    if (!ds.stars || typeof ds.stars !== 'object') ds.stars = {}
    if (!ds.dispatch || typeof ds.dispatch !== 'object') ds.dispatch = {}
    if (!Array.isArray(ds.dispatch.runs)) ds.dispatch.runs = []
    if (!('lastSweepWeek' in ds)) ds.lastSweepWeek = ''
    // V5.1 招牌秘境：三个懒建叶子（老档零迁移，不动 SaveSystem 迁移链）
    if (!ds.sig || typeof ds.sig !== 'object') ds.sig = {}
    if (typeof ds.points !== 'number' || !Number.isFinite(ds.points)) ds.points = 0
    if (!ds.shopWeek || typeof ds.shopWeek !== 'object') ds.shopWeek = {}
    return this
  }

  get ds () {
    return this.ensure().state.dungeonState
  }

  get level () {
    return this.state.player.realm.level
  }

  /** 当前战力（基准 × 常驻乘区：功法 / 灵兽；战力校验用） */
  get power () {
    const base = getLevelInfo(this.level).combat.power
    return Math.round(base * (this.powerMul ? this.powerMul() : 1))
  }

  get realmIndex () {
    return Math.floor((this.level - 1) / 9)
  }

  /** 当前分身槽位（金丹 1 槽起） */
  get slotCount () {
    return slotCountFor(this.level)
  }

  /**
   * 分身槽位阶梯（视图用，纯读）：每个大境界给几具分身。
   * 主人 2026-09-17 要求把"分身随境界提高而增多"写明白。
   */
  slotLadder () {
    return REALM_META.map((m, i) => ({
      realmIndex: i,
      realmName: m.name,
      slots: slotCountFor(i * 9 + 1),
      current: i === this.realmIndex
    }))
  }

  /** 背包快捷访问（老档自愈） */
  get items () {
    const inv = this.state.inventory
    if (!inv || typeof inv !== 'object') this.state.inventory = { items: {} }
    if (!this.state.inventory.items || typeof this.state.inventory.items !== 'object') {
      this.state.inventory.items = {}
    }
    return this.state.inventory.items
  }

  // ── 当量折算（复用 events.stoneHourly，与事件系统同口径）──────────────

  /** 当量 h → 灵石 */
  hToStones (h) {
    return Math.max(0, Math.round(stoneHourly(this.level) * h))
  }

  /** 当量 h → 主题材料份数 */
  hToMats (d, h) {
    return Math.max(0, Math.round(h * d.matPerH))
  }

  // ── 功法残卷（V3.3.1：秘境也是功法的正经来源）────────────────────────────

  hasTech (id) {
    return !!(this.tech && this.tech.has(id))
  }

  /** 从某深度档的功法池里取一本尚未习得的；全持有返回 null */
  pickTech (depth) {
    if (!this.tech) return null
    return techPoolOf(depth).find((id) => !this.tech.has(id)) || null
  }

  /** 授予功法（幂等）；返回 {id, name} | null */
  _grantTech (id) {
    if (!id || !this.tech) return null
    const r = this.tech.grant(id)
    return r.ok ? { id, name: r.name } : null
  }

  /**
   * 派遣 / 首通时的「残卷拾得」roll
   * @returns {{techId:string, techName:string}|null}
   */
  _rollTechDrop (dungeonId, depth, pct) {
    if (!this.tech) return null
    const chance = pct != null
      ? pct
      : ((getDungeon(dungeonId) || {}).surprise ? TECH_DROP_PCT.res_guxiu : TECH_DROP_PCT.default)
    if (!(Math.random() < chance)) return null
    const hit = this._grantTech(this.pickTech(depth))
    return hit
  }

  // ── 古修遗迹的「惊喜与意外」（V3.3.1）───────────────────────────────────

  /**
   * 结算前 roll 一次惊喜/意外（仅带 surprise 标记的秘境）
   * @returns {{stones:number, mats:number, id:string, note:string}} 修正后的收益
   */
  _applySurprise (d, stones, mats) {
    if (!d || !d.surprise) return { stones, mats, id: 'normal', note: '' }
    const s = rollSurprise()
    if (s.id === 'jackpot') {
      return { stones: Math.round(stones * SURPRISE.jackpotMul), mats, id: s.id, note: `〔机缘〕${s.label}：灵石 ×${SURPRISE.jackpotMul}` }
    }
    if (s.id === 'trap') {
      return { stones: Math.round(stones * SURPRISE.trapStoneMul), mats: 0, id: s.id, note: `〔意外〕${s.label}：灵石减半且无材料` }
    }
    if (s.id === 'scroll') {
      const hit = this._grantTech(this.pickTech(4)) || this._grantTech(this.pickTech(3))
      if (hit) return { stones, mats, id: s.id, note: `〔机缘〕${s.label}：习得《${hit.name}》`, tech: hit }
      const bonus = this.hToStones(TECH_DUP_STONES_H)
      return { stones: stones + bonus, mats, id: s.id, note: `〔机缘〕${s.label}：功法已尽收，换作灵石 +${bonus}` }
    }
    return { stones, mats, id: s.id, note: '' }
  }

  // ── 试炼塔 ──────────────────────────────────────────────────────────────

  /** 已通最高层（0 = 尚未通关） */
  towerCleared () {
    return Math.max(0, Math.min(this.ds.cleared.tower | 0, TOWER.floors))
  }

  /** 下一待挑战层（已满则返回 null） */
  towerNextFloor () {
    const n = this.towerCleared() + 1
    return n <= TOWER.floors ? n : null
  }

  /** 挑战下一层（战力校验，确定性：达标即过） */
  challengeTower (now = Date.now()) {
    const next = this.towerNextFloor()
    if (next === null) return { ok: false, message: `已通第 ${TOWER.floors} 层，更高层随后续版本开放。` }
    const power = towerPower(next)
    if (this.power < power) {
      return { ok: false, needPower: power, message: '战力不足，尚不可挑战此层（回主线提升境界再来）。' }
    }

    const firstH = towerFirstClearH(next)
    let stones = this.hToStones(firstH)
    this.state.resources.stones += stones

    const ms = towerMilestone(next)
    let milestoneText = ''
    let milestonePoints = 0
    if (ms) {
      const bonus = this.hToStones(TOWER.milestoneBonusH)
      this.state.resources.stones += bonus
      stones += bonus
      // V5.1：第 30 层里程碑文案「秘境积分 ×100」接线（招牌积分商店的上游）
      milestonePoints = (TOWER.milestonePoints && TOWER.milestonePoints[next]) || 0
      if (milestonePoints > 0) this._addPoints(milestonePoints)
      milestoneText = `，${ms}：灵石 +${bonus}${milestonePoints ? `、秘境积分 +${milestonePoints}` : ''}`
    }

    this.ds.cleared.tower = next
    return {
      ok: true, floor: next, needPower: power, stones, milestone: ms || null, milestonePoints,
      points: this.points,
      message: `试炼塔第 ${next} 层已通：灵石 +${stones}${milestoneText}。`
    }
  }

  /** 距下次周扫荡（现实周一 0 点）的毫秒数（面板用游戏历倒计时） */
  nextSweepInMs (now = Date.now()) {
    const d = new Date(now)
    const day = (d.getDay() + 6) % 7            // 周一 = 0
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 7)
    return Math.max(0, next.getTime() - now)
  }

  /** 周一为界的周键（用于周扫荡去重） */
  weekKey (ts) {
    const d = new Date(ts)
    const day = (d.getDay() + 6) % 7            // 周一 = 0
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
    return Math.floor(monday.getTime() / 86400000)
  }

  /**
   * 周常扫荡：每周一按已通最高层发放（幂等；无通关则不发）。
   * @returns {object|null} 发放结果；本周已发过或无进度返回 null
   */
  ensureWeekly (now = Date.now()) {
    const key = this.weekKey(now)
    const ds = this.ds
    if (ds.lastSweepWeek === key) return null
    ds.lastSweepWeek = key
    const cleared = this.towerCleared()
    if (cleared <= 0) return null
    const h = towerWeeklyH(cleared)
    const stones = this.hToStones(h)
    this.state.resources.stones += stones
    return {
      ok: true, floor: cleared, h, stones,
      message: `试炼塔周常扫荡：已通 ${cleared} 层，灵石 +${stones}（每周一发放）。`
    }
  }

  // ── 资源秘境 ────────────────────────────────────────────────────────────

  /** 已通最高深度（0 = 未首通） */
  dungeonCleared (dungeonId) {
    return Math.max(0, Math.min(this.ds.cleared[dungeonId] | 0, DEPTH_TABLE.length))
  }

  /** 首通评星（0 = 未评星） */
  dungeonStars (dungeonId, depth) {
    return Math.max(0, this.ds.stars[`${dungeonId}:${depth}`] | 0)
  }

  /** 按战力溢出比例评 1~3 星 */
  rateStars (needPower) {
    const ratio = this.power / Math.max(1, needPower)
    let stars = 1
    for (let i = 0; i < STAR_RULE.tiers.length; i++) {
      if (ratio >= STAR_RULE.tiers[i]) stars = i + 1
    }
    return Math.min(stars, STAR_RULE.maxStars)
  }

  /** 首通资源秘境某深度（战力校验 + 评星 + 一次性当量奖励） */
  challengeResource (dungeonId, depth, now = Date.now()) {
    const d = getDungeon(dungeonId)
    if (!d) return { ok: false, message: '没有这座秘境。' }
    const dep = getDepth(depth)
    if (this.realmIndex < d.unlockRealm) {
      return { ok: false, message: `${d.name}需 ${getRealmMeta(d.unlockRealm).name}期方可入内。` }
    }
    const cur = this.dungeonCleared(dungeonId)
    if (dep.depth <= cur) return { ok: false, message: `已通${d.name}第 ${dep.depth} 层。` }
    if (dep.depth > cur + 1) return { ok: false, message: `需先通${d.name}第 ${cur + 1} 层，再入更深。` }
    if (this.power < dep.power) {
      return { ok: false, needPower: dep.power, message: `战力不足，尚不可探入${d.name}第 ${dep.depth} 层。` }
    }

    const stars = this.rateStars(dep.power)
    let stones = this.hToStones(dep.firstClearH)
    this.ds.cleared[dungeonId] = dep.depth
    this.ds.stars[`${dungeonId}:${dep.depth}`] = stars

    // V3.3.1（主人：秘境也拿不到功法）：首通必得该深度档的功法一本；
    //   该档已全持有 → 折算灵石（TECH_DUP_STONES_H 当量）作为替代奖励。
    let techId = null
    let techName = ''
    let techNote = ''
    const hit = this._grantTech(this.pickTech(dep.depth))
    if (hit) {
      techId = hit.id
      techName = hit.name
      techNote = `，得功法《${hit.name}》`
    } else if (this.tech) {
      const bonus = this.hToStones(TECH_DUP_STONES_H)
      stones += bonus
      techNote = `，残卷已尽收（折灵石 +${bonus}）`
    }
    this.state.resources.stones += stones

    return {
      ok: true, dungeon: d, depth: dep.depth, stars, stones, needPower: dep.power,
      techId, techName,
      message: `首通${d.name}·${dep.name}（${stars} 星）：灵石 +${stones}${techNote}，派遣收益永久 +${stars * 10}%。`
    }
  }

  // ── 分身派遣 ────────────────────────────────────────────────────────────

  /** 派出分身（需已首通该深度；同一秘境最多 1 槽） */
  dispatch (dungeonId, depth, hours, now = Date.now()) {
    if (this.slotCount <= 0) return { ok: false, message: '金丹期方得第一具分身，暂不可派遣。' }
    const d = getDungeon(dungeonId)
    if (!d) return { ok: false, message: '没有这座秘境。' }
    const dep = getDepth(depth)
    if (this.realmIndex < d.unlockRealm) {
      return { ok: false, message: `${d.name}需 ${getRealmMeta(d.unlockRealm).name}期方可入内。` }
    }
    if (dep.depth > this.dungeonCleared(dungeonId)) {
      return { ok: false, message: `需先首通${d.name}第 ${dep.depth} 层，方可派驻分身。` }
    }
    if (!DISPATCH.durations.includes(hours)) {
      return { ok: false, message: `派遣日程仅可选 ${DISPATCH.durations.join(' / ')} 小时档。` }
    }
    if (this.ds.dispatch.runs.length >= this.slotCount) {
      return { ok: false, message: `分身槽已满（${this.slotCount} 槽），先召回再派。` }
    }
    if (this.ds.dispatch.runs.some((r) => r.dungeonId === dungeonId)) {
      return { ok: false, message: `已有分身驻留${d.name}，一秘境只容一具。` }
    }

    const stars = this.dungeonStars(dungeonId, dep.depth)
    const rateH = dispatchHours(hours, dep.coef, stars)
    const run = {
      id: this._nextRunId(), dungeonId, depth: dep.depth, hours,
      startAt: now, renew: DISPATCH.autoRenew
    }
    this.ds.dispatch.runs.push(run)

    const mats = this.hToMats(d, rateH)
    return {
      ok: true, run, dungeonName: d.name, stars, rateH, stones: this.hToStones(rateH), mats,
      message: `分身已驻留${d.name}·${dep.name}（${fmtGameDuration(hours * HOUR_MS)}，预计当量 ${rateH.toFixed(2)}h ≈ 灵石 ${this.hToStones(rateH)}、${getItem(d.material).name} +${mats}）。`
    }
  }

  _nextRunId () {
    const ds = this.ds
    ds.dispatch.nextId = (ds.dispatch.nextId | 0) + 1
    return ds.dispatch.nextId
  }

  /** 结算一趟派遣（run.startAt ~ endAt，共 run.hours 小时） */
  _settleRun (run, endAt) {
    const d = getDungeon(run.dungeonId)
    const dep = getDepth(run.depth)
    const stars = this.dungeonStars(run.dungeonId, run.depth)
    const h = dispatchHours(run.hours, dep.coef, stars)
    // V3.3.1：古修遗迹等 surprise 秘境先 roll「惊喜与意外」，再叠残卷拾得
    const sup = this._applySurprise(d, this.hToStones(h), this.hToMats(d, h))
    const stones = sup.stones
    const mats = sup.mats
    this.state.resources.stones += stones
    if (mats > 0) this.items[d.material] = (this.items[d.material] | 0) + mats
    const drop = this._rollTechDrop(run.dungeonId, run.depth)
    const techText = drop ? `，拾得残卷《${drop.name}》` : ''
    const supText = sup.note ? `　${sup.note}` : ''
    return {
      ok: true, dungeonId: run.dungeonId, depth: run.depth, hours: run.hours,
      h, stones, mats, matId: d.material,
      techId: drop ? drop.id : null, techName: drop ? drop.name : null,
      surprise: sup.id,
      message: `分身归来：${d.name}（${run.hours} 时）灵石 +${stones}，${getItem(d.material).name} +${mats}${techText}。${supText}`
    }
  }

  /**
   * 主循环节拍：到期自动结算 + 续派（真实时间驱动，离线照算）。
   * @param {number} now 当前时间戳
   * @returns {Array} 本拍结算的结果数组（供装配层打日志/飘字）
   */
  tick (now = Date.now()) {
    const runs = this.ds.dispatch.runs
    const results = []
    for (const run of runs) {
      let guard = 0
      while (run.startAt + run.hours * HOUR_MS <= now && guard++ < 1000) {
        const dueAt = run.startAt + run.hours * HOUR_MS
        results.push(this._settleRun(run, dueAt))
        if (!run.renew) { run.done = true; break }
        run.startAt = dueAt
      }
    }
    // 清理不续派且已结算的 run（召回由 recall 单独移除）
    this.ds.dispatch.runs = runs.filter((r) => !r.done)
    return results
  }

  /** 召回（按已过时长比例结算，移除该槽） */
  recall (runIndex, now = Date.now()) {
    const runs = this.ds.dispatch.runs
    const run = runs[runIndex]
    if (!run) return { ok: false, message: '没有这趟派遣。' }
    const d = getDungeon(run.dungeonId)
    const dep = getDepth(run.depth)
    const stars = this.dungeonStars(run.dungeonId, run.depth)
    const elapsedMs = Math.max(0, now - run.startAt)
    const elapsedH = elapsedMs / HOUR_MS

    runs.splice(runIndex, 1)

    if (elapsedMs < MIN_SETTLE_MS) {
      return { ok: true, partial: true, h: 0, stones: 0, mats: 0,
        message: `已召回${d.name}的分身（驻留未满一刻，无所得）。` }
    }

    const h = dispatchHours(elapsedH, dep.coef, stars)
    const sup = this._applySurprise(d, this.hToStones(h), this.hToMats(d, h))
    const stones = sup.stones
    const mats = sup.mats
    this.state.resources.stones += stones
    if (mats > 0) this.items[d.material] = (this.items[d.material] | 0) + mats
    const drop = this._rollTechDrop(run.dungeonId, run.depth)
    const techText = drop ? `，拾得残卷《${drop.name}》` : ''
    const supText = sup.note ? `　${sup.note}` : ''
    return {
      ok: true, partial: true, h, stones, mats, matId: d.material,
      techId: drop ? drop.id : null, techName: drop ? drop.name : null, surprise: sup.id,
      message: `分身召回：${d.name}（驻留 ${fmtGameDuration(elapsedMs)}）灵石 +${stones}，${getItem(d.material).name} +${mats}${techText}。${supText}`
    }
  }

  // ── 招牌秘境（V5.1 · 内容批次 3 世界篇首步）────────────────────────────
  //  口径（已拍板，见 data/dungeon.js SIGNATURE 与 data/worlds.js SIGNATURE_ORIGIN）：
  //    本源洞天＝本界招牌（产出 100% + 门槛提前 1 大境界）；游历洞天＝空缺界的本界洞天
  //    （产出 60% + 门槛提前 1 境）；他界洞天＝其余（产出 60% + 原门槛）；12 条始终可见。
  //  四条链路：首通（一次性）/ 周期（每 30 游戏天一轮，每洞天每轮一次）/
  //           周轮换（当周限时秘境，产出 ×1.5，过期作废不可补打）/ 积分商店。
  // ────────────────────────────────────────────────────────────────────────

  /** 当前世界 id（只读直读，**不经懒建**——查询不该长出子树，照 WorldSystem.bonusView 惯例） */
  get worldId () {
    const w = this.state.world
    return (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : null
  }

  /** 招牌进度叶子（懒建；键为招牌 id，另有保留键 weekly＝当周限时秘境已探记录） */
  get sigState () {
    return this.ds.sig
  }

  /** 秘境积分余额 */
  get points () {
    return Math.max(0, Math.round(Number(this.ds.points) || 0))
  }

  /** 加减积分（内部；不做余额校验，校验在调用点） */
  _addPoints (n) {
    const ds = this.ds
    ds.points = Math.max(0, Math.round((Number(ds.points) || 0) + (Number(n) || 0)))
    return ds.points
  }

  /**
   * 某招牌洞天在当前世界下的入场口径
   * @returns {{state:'origin'|'local'|'foreign', stateName:string, mul:number, unlockRealm:number, unlocked:boolean}}
   */
  sigEntryOf (d) {
    const st = signatureStateOf(this.worldId, d.id)
    // 本源（提前 1 大境界）与游历（同样提前 1 境）都享门槛便利；他界按原门槛
    const unlockRealm = st === 'foreign'
      ? d.unlockRealm
      : Math.max(0, d.unlockRealm - SIGNATURE.localUnlockDiscount)
    return {
      state: st,
      stateName: SIG_STATE_NAME[st] || '他界洞天',
      mul: st === 'origin' ? SIGNATURE.originMul : SIGNATURE.foreignMul,
      unlockRealm,
      unlocked: this.realmIndex >= unlockRealm
    }
  }

  /** 招牌首通（一次性：本源全额 / 游历与他界六折；赠积分） */
  signatureFirstClear (id, now = Date.now()) {
    const d = getSignature(id)
    if (!d) return { ok: false, message: '没有这座洞天。' }
    const e = this.sigEntryOf(d)
    const s = this.sigState
    if (s[id] && s[id].first) return { ok: false, message: `${d.name}已首通过，不必再探。` }
    if (!e.unlocked) {
      return { ok: false, message: `${d.name}（${e.stateName}）需 ${getRealmMeta(e.unlockRealm).name}期方可入内。` }
    }

    const h = sigFirstClearH(d) * e.mul
    const stones = this.hToStones(h)
    const mats = this.hToMats(d, h)
    this.state.resources.stones += stones
    if (mats > 0) this.items[d.material] = (this.items[d.material] | 0) + mats
    const points = SIGNATURE.points.firstClear
    this._addPoints(points)
    s[id] = { first: true, cycleKey: sigCycleKey(now) }

    return {
      ok: true, kind: 'sig-first', id, dungeon: d, state: e.state, mul: e.mul, h, stones, mats,
      matId: d.material, matName: getItem(d.material).name, points,
      message: `首通${d.name}（${e.stateName} · 产出 ${Math.round(e.mul * 100)}%）：灵石 +${stones}，${getItem(d.material).name} +${mats}，秘境积分 +${points}。`
    }
  }

  /** 招牌周期结算（每 30 游戏天一轮；每洞天每轮一次，需已首通） */
  signatureCycle (id, now = Date.now()) {
    const d = getSignature(id)
    if (!d) return { ok: false, message: '没有这座洞天。' }
    const s = this.sigState
    const cur = s[id]
    if (!cur || !cur.first) return { ok: false, message: `${d.name}尚未首通——先首通，再来按轮探取。` }
    const e = this.sigEntryOf(d)
    const key = sigCycleKey(now)
    if (cur.cycleKey === key) {
      return { ok: false, waitMs: sigCycleMsToNext(now), message: `${d.name}本轮已探过，${fmtGameDuration(sigCycleMsToNext(now))}后再来。` }
    }

    const h = sigCycleH(d) * e.mul
    const stones = this.hToStones(h)
    const mats = this.hToMats(d, h)
    this.state.resources.stones += stones
    if (mats > 0) this.items[d.material] = (this.items[d.material] | 0) + mats
    const points = SIGNATURE.points.cycle
    this._addPoints(points)
    cur.cycleKey = key

    return {
      ok: true, kind: 'sig-cycle', id, dungeon: d, state: e.state, mul: e.mul, h, stones, mats,
      matId: d.material, matName: getItem(d.material).name, points,
      message: `${d.name}本轮探获：灵石 +${stones}，${getItem(d.material).name} +${mats}，秘境积分 +${points}。`
    }
  }

  /** 当周「限时秘境」条目（纯读；周 key 与试炼塔周扫荡同源，按 id 稳定哈希轮换） */
  weeklySignatureView (now = Date.now()) {
    const week = this.weekKey(now)
    const id = weeklySignatureId(week)
    const d = getSignature(id)
    const e = d ? this.sigEntryOf(d) : null
    const rec = this.sigState.weekly
    const done = !!(rec && typeof rec === 'object' && rec.week === week)
    const h = d && e ? sigCycleH(d) * e.mul * SIGNATURE.weeklyMul : 0
    return {
      week, id, name: d ? d.name : id, theme: d ? d.theme : '',
      state: e ? e.state : 'foreign', stateName: e ? e.stateName : '他界洞天',
      unlocked: e ? e.unlocked : false,
      unlockRealmName: e ? getRealmMeta(e.unlockRealm).name : '',
      done, mul: SIGNATURE.weeklyMul,
      stones: this.hToStones(h), mats: this.hToMats(d || { matPerH: 0 }, h),
      matName: d ? getItem(d.material).name : '',
      points: SIGNATURE.points.weekly,
      // 当周限定 · 过期作废不可补打：到期＝下次周扫荡边界
      nextInMs: this.nextSweepInMs(now)
    }
  }

  /** 打当周限时秘境（每周一次，产出 ×1.5；过期作废，不可补打） */
  signatureWeekly (now = Date.now()) {
    const v = this.weeklySignatureView(now)
    if (!v.unlocked) {
      return { ok: false, message: `${v.name}（本体为${v.stateName}）需 ${v.unlockRealmName}期方可入内。` }
    }
    if (v.done) return { ok: false, message: `本周的限时秘境（${v.name}）已探过，下周自会换一处。` }

    const d = getSignature(v.id)
    const e = this.sigEntryOf(d)
    const h = sigCycleH(d) * e.mul * SIGNATURE.weeklyMul
    const stones = this.hToStones(h)
    const mats = this.hToMats(d, h)
    this.state.resources.stones += stones
    if (mats > 0) this.items[d.material] = (this.items[d.material] | 0) + mats
    const points = SIGNATURE.points.weekly
    this._addPoints(points)
    this.sigState.weekly = { week: v.week, id: v.id }

    return {
      ok: true, kind: 'sig-weekly', id: v.id, dungeon: d, h, stones, mats,
      matId: d.material, matName: getItem(d.material).name, points,
      message: `限时秘境「${d.name}」已探（产出 ×${SIGNATURE.weeklyMul}）：灵石 +${stones}，${getItem(d.material).name} +${mats}，秘境积分 +${points}。`
    }
  }

  /** 积分商店货架（含定价与「买不买得起」） */
  shopView () {
    return DUNGEON_SHOP.map((e) => {
      const cost = shopCostOf(e)
      return {
        id: e.id, name: e.name, cost, kind: e.kind,
        itemId: e.item, itemName: e.item ? getItem(e.item).name : '', n: Math.max(1, e.n | 0),
        affordable: this.points >= cost
      }
    })
  }

  /** 购买货架项（积分只扣不返还；物品直接入行囊） */
  buyShopItem (id, now = Date.now()) {
    const e = getShopItem(id)
    if (!e) return { ok: false, message: '货架上没有这件东西。' }
    const cost = shopCostOf(e)
    if (this.points < cost) {
      return { ok: false, need: cost, have: this.points, message: `秘境积分不足：需 ${cost}，现有 ${this.points}。` }
    }
    this._addPoints(-cost)
    const n = Math.max(1, e.n | 0)
    this.items[e.item] = (this.items[e.item] | 0) + n
    return {
      ok: true, kind: 'shop', id, cost, itemId: e.item, itemName: getItem(e.item).name, n,
      points: this.points,
      message: `秘境积分 −${cost}，得${getItem(e.item).name} ×${n}（余额 ${this.points}）。`
    }
  }

  /** 招牌全景视图（面板用；纯读） */
  signatureView (now = Date.now()) {
    const s = this.sigState
    const key = sigCycleKey(now)
    const cycleInMs = sigCycleMsToNext(now)
    const rows = SIGNATURE_DUNGEONS.map((d) => {
      const e = this.sigEntryOf(d)
      const cur = s[d.id] || {}
      const firstH = sigFirstClearH(d) * e.mul
      const cycH = sigCycleH(d) * e.mul
      const item = getItem(d.material)
      return {
        id: d.id, name: d.name, theme: d.theme, source: d.source, desc: d.desc,
        state: e.state, stateName: e.stateName, mul: e.mul, mulPct: Math.round(e.mul * 100),
        unlocked: e.unlocked,
        unlockRealm: e.unlockRealm, unlockRealmName: getRealmMeta(e.unlockRealm).name,
        first: !!cur.first,
        firstH, firstStones: this.hToStones(firstH), firstMats: this.hToMats(d, firstH),
        materialName: item.name, matPerH: d.matPerH,
        cycleH: cycH, cycleStones: this.hToStones(cycH), cycleMats: this.hToMats(d, cycH),
        cycleReady: !!cur.first && cur.cycleKey !== key,
        cycleInMs,
        points: SIGNATURE.points
      }
    })
    return {
      rows,
      stateNames: SIG_STATE_NAME,
      cycleInMs,
      points: this.points,
      cleared: rows.filter((r) => r.first).length,
      total: rows.length,
      weekly: this.weeklySignatureView(now),
      shop: this.shopView()
    }
  }

  /** 招牌统计快照（装配层喂成就 metric 用；纯读） */
  signatureStats (now = Date.now()) {
    const s = this.sigState
    const cleared = SIGNATURE_DUNGEONS.filter((d) => s[d.id] && s[d.id].first).length
    const origins = originSignaturesOf(this.worldId)
    const originDone = origins.length > 0 && origins.every((id) => s[id] && s[id].first)
    const week = this.weekKey(now)
    const weeklyDone = !!(s.weekly && typeof s.weekly === 'object' && s.weekly.week === week)
    return {
      sigCleared: cleared,
      sigOriginTotal: origins.length,
      sigOriginDone: originDone ? 1 : 0,
      sigPoints: this.points,
      sigWeeklyDone: weeklyDone ? 1 : 0
    }
  }

  // ── 视图（装配层渲染用，纯读）──────────────────────────────────────────

  towerView () {
    const cleared = this.towerCleared()
    const next = this.towerNextFloor()
    let nextInfo = null
    if (next !== null) {
      const needPower = towerPower(next)
      const ms = towerMilestone(next)
      nextInfo = {
        floor: next, needPower, firstH: towerFirstClearH(next),
        stones: this.hToStones(towerFirstClearH(next)),
        milestone: ms,
        // 里程碑奖励内容（文本 + 折算灵石；主人 2026-09-17：秘境要标注奖励内容）
        milestoneStones: ms ? this.hToStones(TOWER.milestoneBonusH) : 0,
        canChallenge: this.power >= needPower
      }
    }
    const weeklyH = cleared > 0 ? towerWeeklyH(cleared) : 0
    return {
      cleared, floors: TOWER.floors, power: this.power, next: nextInfo,
      weekly: { h: weeklyH, stones: this.hToStones(weeklyH), nextInMs: this.nextSweepInMs() }
    }
  }

  resourceView () {
    return RESOURCE_DUNGEONS.map((d) => {
      const unlocked = this.realmIndex >= d.unlockRealm
      const cleared = this.dungeonCleared(d.id)
      const nextDepth = Math.min(cleared + 1, DEPTH_TABLE.length)
      const dep = getDepth(nextDepth)
      const stars = cleared > 0 ? this.dungeonStars(d.id, cleared) : 0
      const item = getItem(d.material)
      // 派遣收益按"已通最高深度"算（面板上的派遣按钮用的就是这个深度）
      const clearedDep = getDepth(Math.max(1, cleared))
      const clearedStars = cleared > 0 ? this.dungeonStars(d.id, cleared) : 0
      const dispatchOptions = DISPATCH.durations.map((h) => {
        const rateH = dispatchHours(h, clearedDep.coef, clearedStars)
        return {
          hours: h,
          rateH,
          stones: this.hToStones(rateH),
          mats: this.hToMats(d, rateH),
          matName: item.name
        }
      })
      // V3.3.1（主人：秘境只显示基础奖励即可，不用每个派遣时间都标注）：
      //   面板只标"基础收益/小时"，三档时长的具体数字不再逐档罗列（按钮上仍写着时长）。
      const baseRateH = dispatchHours(1, clearedDep.coef, clearedStars)
      // 首通必得的功法（本深度档里还没习得的那本；全持有则为 null）
      const techId = this.pickTech(dep.depth)
      return {
        id: d.id, name: d.name, theme: d.theme, desc: d.desc,
        material: d.material, materialName: item.name,
        surprise: !!d.surprise,
        unlocked, unlockRealmName: getRealmMeta(d.unlockRealm).name,
        cleared, stars,
        nextDepth, nextName: dep.name, nextPower: dep.power,
        nextFirstH: dep.firstClearH,
        // 首通奖励内容（主人 2026-09-17：秘境要标注奖励内容）
        nextStones: this.hToStones(dep.firstClearH),
        nextMats: this.hToMats(d, dep.firstClearH),
        techId: cleared < DEPTH_TABLE.length ? techId : null,
        techDepth: Math.min(cleared + 1, DEPTH_TABLE.length),
        techDropPct: d.surprise ? TECH_DROP_PCT.res_guxiu : TECH_DROP_PCT.default,
        matPerH: d.matPerH,
        dispatchBase: {
          stonesPerHour: this.hToStones(baseRateH),
          matsPerHour: this.hToMats(d, baseRateH),
          rateH: baseRateH,
          stars: clearedStars,
          depthName: clearedDep.name,
          matName: item.name
        },
        dispatchOptions,
        canChallenge: unlocked && cleared < DEPTH_TABLE.length && this.power >= dep.power,
        canDispatch: unlocked && cleared > 0
      }
    })
  }

  dispatchView (now = Date.now()) {
    const runs = this.ds.dispatch.runs.map((run, i) => {
      const d = getDungeon(run.dungeonId)
      const dep = getDepth(run.depth)
      const stars = this.dungeonStars(run.dungeonId, run.depth)
      const rateH = dispatchHours(run.hours, dep.coef, stars)
      const dueAt = run.startAt + run.hours * HOUR_MS
      const mats = d ? this.hToMats(d, rateH) : 0
      return {
        index: i, dungeonId: run.dungeonId, dungeonName: d ? d.name : run.dungeonId,
        depth: run.depth, depthName: dep.name, hours: run.hours, stars,
        rateH, stones: this.hToStones(rateH),
        mats, matId: d ? d.material : '', matName: d ? getItem(d.material).name : '',
        remainingMs: Math.max(0, dueAt - now), done: now >= dueAt
      }
    })
    return {
      slots: this.slotCount,
      used: runs.length,
      durations: DISPATCH.durations,
      ladder: this.slotLadder(),
      runs
    }
  }
}

export default DungeonSystem
