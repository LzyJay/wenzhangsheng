/**
 * SectSystem.js —— 宗门系统（纯逻辑层）（2.4）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/sect.js（云岚宗 · 职级 · 任务池 · 藏经阁 · 商店）
 *
 * 口径（设计库《宗门与弟子 v1》+ 开发计划 V2 §四 2.4）：
 *   · 任务板（3~5 槽）→ 挂机完成 → 领贡献 → 藏经阁/商店兑换（本模块验收闭环）
 *   · 职级六档：境界 + 累计贡献双门槛；晋升不扣贡献（贡献是可花货币，累计另记）
 *   · 俸禄＝每日「N 小时等效基准产出」的灵气，按在线时间随秒入账；离线不发
 *     （对齐既有口径：离线收益只补打坐，宗门活计不算闭关）
 *   · 战力校验任务：接取时按当时基准战力 × 系数定标，交付时按当前战力判成败
 *     （成长有回报）；概率 clamp 25%~95%，失败贡献减半、材料不发放
 *   · 任务板每轮刷新（**一轮 = 7 游戏天 ≈ 现实 7 分钟**，见 sect.SECT_REFRESH_DAYS）；
 *     交付后槽位本轮转空
 *
 * V3.3.1 修订（主人三条：① 贡献拿不到 ② 要能提前交 ③ 任务随境界变化、奖励增加）
 *   · **可提前提交**：running 状态随时可交，按已办妥比例结算（不足门槛不受理）
 *   · **随境界变化**：任务板只出 minRealm ≤ 当前大境界的任务（高境界解锁重赏活计）
 *   · **奖励随境界增加**：贡献 = 基础 × contribOf(realmIndex)（每晋一大境界 +60%）
 *   · **宗门按境界下发普通功法**：每晋一大境界，从该档池里补一本没习得的（见 grantTick）
 *
 * 2026-09-19 修订（主人第 7 条：任务逻辑整体优化）
 *   · **限时按游戏时辰**：任务时长 = def.hours（时辰），经 taskDurationMs 换算成现实毫秒
 *     （例：巡逻 2 时辰 ≈ 现实 10 秒）
 *   · **到点自动交差**：running 且已到时的槽位，在主循环 tick 里自动结算入账
 *     （走的是与手动交差同一套 _resolve，战力达标必成、不达标按概率判定）
 *   · **战力达标直接接取完成**：power 类任务接取瞬间若战力 ≥ 定标需求 → 立刻成事结账
 *   · **提前交差门槛放低**：≥ min(10% 时长, 1 秒) 即可交，不再出现"点了交不动"
 *
 * 存档子树：state.sect（null＝未入宗；mergeDefaults 对老档自动兜底）
 *   新增叶子 techGrants（realmIndex → 已下发功法 id / '—'），老档懒建兜底
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  SECT, RANKS, TASKS, LIBRARY, SHOP, sectDayKey, getTask,
  contribOf, REALM_GRANTS, realmGrant, taskDurationMs,
  SECT_REFRESH_DAYS, sectMsToNextRefresh, fmtSectRefreshPeriod
} from '../data/sect.js'
import { getLevelInfo, getRealmMeta, TRIAL_AID } from '../data/realms.js'
import { getItem } from '../data/items.js'
import { getTechnique, tierLabel } from '../data/techniques.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
/** 提前提交的最低受理比例：与"至少接手 1 秒"取小 —— 任务只有几个时辰（现实十几秒），
 *  若硬按 10% 算，1 时辰的活要等 0.5 秒、5 时辰的活要等 2.5 秒；取小后"随时可交"名副其实。 */
const MIN_CLAIM_RATIO = 0.1
const MIN_CLAIM_MS = 1000

class SectSystem {
  /**
   * @param {object} state 存档状态
   * @param {TechniqueSystem|null} tech 藏经阁借阅要落到功法系统（测试可传 null）
   * @param {Function|null} powerMul 战力乘区闭包（2.8 灵兽出战加成；由 main.js 注入，
   *        本系统不 import BeastSystem；测试不传则用基准战力）
   */
  constructor (state, tech = null, powerMul = null) {
    this.state = state
    this.tech = tech
    this.powerMul = powerMul
  }

  // ── 基础 ────────────────────────────────────────────────────────────────

  /** 宗门子树（懒建：老档 sect 为 null 时补全结构，但不自动入宗） */
  get s () {
    if (!this.state.sect || typeof this.state.sect !== 'object') {
      this.state.sect = {
        joined: false, sectId: null, rank: 0,
        totalContrib: 0, lastDay: null, slots: [], techGrants: {}
      }
    }
    // V3.3.1：老档补「境界下发功法」台账 + 任务板字段兜底（懒建，不进迁移链）
    if (!this.state.sect.techGrants || typeof this.state.sect.techGrants !== 'object') {
      this.state.sect.techGrants = {}
    }
    if (!Array.isArray(this.state.sect.slots)) this.state.sect.slots = []
    return this.state.sect
  }

  /** 当前大境界下标（0 炼气 …）——任务解锁与奖励缩放共用 */
  get realmIndex () {
    return Math.floor((Math.max(1, this.state.player.realm.level | 0) - 1) / 9)
  }

  get joined () {
    return !!(this.state.sect && this.state.sect.joined)
  }

  get rankMeta () {
    return RANKS[clamp(this.s.rank | 0, 0, RANKS.length - 1)]
  }

  get contribution () {
    return this.state.resources.contribution | 0
  }

  /** **基准战力**（不含功法 / 灵兽乘区）：战力校验任务的定标基准。
   *  定标用基准值，判定用当前战力 —— 于是"把功法练上去 / 带上灵兽"就能越级碾压。 */
  get basePower () {
    return getLevelInfo(this.state.player.realm.level).combat.power
  }

  /** 当前战力（基准 × 战力乘区：功法 × 灵兽；由装配层注入闭包）。2.8/2026-09-19 口径 */
  get power () {
    return Math.round(this.basePower * (this.powerMul ? this.powerMul() : 1))
  }

  /** 入宗（免费；新手引导口径＝测灵根后由玩家自行拜入） */
  join (now = Date.now()) {
    if (this.joined) return { ok: false, message: '已在宗门之中。' }
    const s = this.s
    s.joined = true
    s.sectId = SECT.id
    s.rank = 0
    s.totalContrib = 0
    s.lastDay = sectDayKey(now)
    this.rerollTasks()
    // 主人 2026-09-18：入宗即按当前修为境界下发一本普通功法
    const grants = this.grantTick()
    return {
      ok: true,
      grants,
      message: `拜入${SECT.name}，列身外门。道统·${SECT.daoTong.name}：${SECT.daoTong.desc}；任务板已开放，做满贡献可在藏经阁借阅功法。`
    }
  }

  // ── 按境界下发普通功法（主人 2026-09-18）───────────────────────────────────

  /**
   * 宗门按修为境界下发普通功法（幂等，可反复调用）：
   *   从「炼气 → 当前境界」逐档检查，每档补一本该档池里尚未习得的功法；
   *   某档池已空则记 '—' 跳过。一档只发一次（台账 techGrants）。
   * @returns {Array<{realmIndex:number, realmName:string, techId:string, name:string}>}
   */
  grantTick () {
    if (!this.joined || !this.tech) return []
    const out = []
    const top = this.realmIndex
    for (let i = 0; i <= top; i++) {
      const key = String(i)
      if (this.s.techGrants[key]) continue
      const def = realmGrant(i)
      const id = (def.pool || []).find((x) => !this.tech.has(x))
      this.s.techGrants[key] = id || '—'
      if (!id) continue
      const g = this.tech.grant(id)
      if (g.ok) {
        out.push({ realmIndex: i, realmName: def.label || getRealmMeta(i).name, techId: id, name: g.name })
      }
    }
    return out
  }

  /** 尚有未下发的境界档（界面提示用） */
  pendingGrantTiers () {
    if (!this.joined) return []
    const out = []
    for (let i = 0; i <= this.realmIndex; i++) {
      const key = String(i)
      if (this.s.techGrants[key]) continue
      const def = realmGrant(i)
      if ((def.pool || []).some((x) => !this.tech || !this.tech.has(x))) out.push(def.label || getRealmMeta(i).name)
    }
    return out
  }

  // ── 贡献与晋升 ──────────────────────────────────────────────────────────

  /** 计入贡献（货币 + 累计门槛两条线） */
  earnContribution (n) {
    const v = Math.max(0, Math.round(n))
    this.state.resources.contribution = this.contribution + v
    this.s.totalContrib = (this.s.totalContrib | 0) + v
    return v
  }

  /** 晋升信息（下一职级的双门槛核算） */
  promoInfo () {
    const cur = this.rankMeta
    const next = RANKS[cur.idx + 1] || null
    if (!next) return { maxed: true, can: false }
    const realmIdx = this.realmIndex
    const realmOk = realmIdx >= next.realmIndex
    const contribOk = this.s.totalContrib >= next.contrib
    return {
      maxed: false,
      can: realmOk && contribOk,
      next,
      realmOk,
      contribOk,
      realmName: getRealmMeta(next.realmIndex).name,
      totalContrib: this.s.totalContrib | 0
    }
  }

  /** 晋升（境界 + 累计贡献达标；不扣贡献） */
  promote () {
    const info = this.promoInfo()
    if (info.maxed) return { ok: false, message: '已至掌门之位，宗门之内再无可晋。' }
    if (!info.realmOk) return { ok: false, message: `晋升${info.next.name}需 ${info.realmName}期修为。` }
    if (!info.contribOk) return { ok: false, message: `晋升${info.next.name}需累计贡献 ${info.next.contrib}（还差 ${info.next.contrib - info.totalContrib}）。` }
    this.s.rank = info.next.idx
    return {
      ok: true,
      message: `晋升${info.next.name}：俸禄 ${info.next.salaryHours} 时/日，${info.next.unlocks}。`
    }
  }

  // ── 俸禄 ────────────────────────────────────────────────────────────────

  /** 俸禄折算的灵气速率/秒（基准产出 × 俸禄小时 ÷ 24h；未入宗为 0） */
  salaryQiPerSec () {
    if (!this.joined) return 0
    const base = getLevelInfo(this.state.player.realm.level).output.qiPerSec
    return base * this.rankMeta.salaryHours / 86400
  }

  /** 每日俸禄合计（展示用） */
  salaryPerDay () {
    const base = getLevelInfo(this.state.player.realm.level).output.qiPerSec
    return this.joined ? base * this.rankMeta.salaryHours : 0
  }

  /**
   * 主循环节拍：俸禄随在线时间入账 + 任务板换轮 + **到点自动交差**
   * @param {number} now 当前时间戳
   * @param {number} dtSec 本拍经过的在线秒数（暂停/离线传 0 → 只做轮次与自动交差）
   * @returns {{salary:number, claims:Array<object>}} 本拍入账俸禄 + 自动交差结果（供装配层打日志）
   */
  tick (now, dtSec = 0) {
    const out = { salary: 0, claims: [] }
    if (!this.joined) return out
    this.ensureDaily(now)
    out.claims = this.autoClaimDue(now)
    if (dtSec > 0) {
      const gain = this.salaryQiPerSec() * dtSec
      if (gain > 0) {
        this.state.resources.qi += gain
        out.salary = gain
      }
    }
    return out
  }

  // ── 任务板 ──────────────────────────────────────────────────────────────

  /** 任务板换轮（同一轮内幂等；一轮 = 7 游戏天 ≈ 现实 7 分钟） */
  ensureDaily (now) {
    const key = sectDayKey(now)
    if (this.s.lastDay === key) return false
    this.s.lastDay = key
    this.rerollTasks()
    return true
  }

  /** 当前境界可接的任务池（V3.3.1：minRealm ≤ 大境界） */
  taskPool () {
    const r = this.realmIndex
    const pool = TASKS.filter((t) => (t.minRealm | 0) <= r)
    return pool.length ? pool : TASKS.filter((t) => (t.minRealm | 0) === 0)
  }

  /** 重掷任务板：槽数随职级、池随境界，尽量不与相邻槽重复 */
  rerollTasks () {
    const n = this.rankMeta.slots
    const pool = this.taskPool()
    const slots = []
    let prev = -1
    for (let i = 0; i < n; i++) {
      let k
      do { k = Math.floor(Math.random() * pool.length) } while (pool.length > 1 && k === prev)
      prev = k
      slots.push({ taskId: pool[k].id, state: 'open', startAt: 0, req: 0 })
    }
    this.s.slots = slots
    return slots
  }

  taskDefOf (slot) {
    return slot ? getTask(slot.taskId) : null
  }

  /** 该任务在当前境界的贡献悬赏（境界越高越厚） */
  contribOf (def) {
    return contribOf(def, this.realmIndex)
  }

  /**
   * 接任务（open → running；战力任务此刻定标）
   *   主人 2026-09-19：**战力达标者接取瞬间即完成**（不必再等时辰）
   */
  startTask (i, now = Date.now()) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    const slot = this.s.slots[i]
    const def = this.taskDefOf(slot)
    if (!slot || !def) return { ok: false, message: '没有这个任务槽。' }
    if (slot.state !== 'open') return { ok: false, message: '该槽位不在待命状态。' }
    slot.state = 'running'
    slot.startAt = now
    // 定标以**基准战力**为准（不含功法 / 灵兽加成）→ 加成够高者当场碾压
    if (def.kind === 'power') slot.req = Math.round(this.basePower * def.reqMul)

    // 战力达标 → 当场办妥（口径：能碾压的活不必耗时辰）
    if (def.kind === 'power' && this.power >= slot.req) {
      const res = this._resolve(slot, def, now, { full: true, instant: true })
      return {
        ...res,
        instant: true,
        message: `接下「${def.name}」——战力胜于定标 ${slot.req}，当场办妥：贡献 +${res.contrib}${res.matText}。`
      }
    }
    return { ok: true, message: `接下「${def.name}」（限时 ${def.hours} 时辰），到点自会办妥；中途也可提前交差。` }
  }

  /** 可交差门槛（毫秒）：min(10% 时长, 1 秒) —— 见 MIN_CLAIM_MS 注释 */
  claimGateMs (def) {
    const total = taskDurationMs(def)
    return Math.min(total * MIN_CLAIM_RATIO, MIN_CLAIM_MS)
  }

  /** 任务进度（running 才有）；ratio＝已办妥比例（提前交差按它折算） */
  progressOf (slot, now = Date.now()) {
    const def = this.taskDefOf(slot)
    if (!slot || !def || slot.state !== 'running') {
      return { running: false, done: false, elapsedMs: 0, totalMs: 0, ratio: 0 }
    }
    const totalMs = taskDurationMs(def)
    const elapsedMs = Math.max(0, now - slot.startAt)
    return {
      running: true,
      done: elapsedMs >= totalMs,
      elapsedMs,
      totalMs,
      ratio: clamp(totalMs > 0 ? elapsedMs / totalMs : 0, 0, 1)
    }
  }

  /**
   * 交差（running 随时可交，按已办妥比例折算悬赏）
   *   · 门槛：已办时长 ≥ min(10% 时长, 1 秒)，否则不受理
   *   · 贡献 = 境界缩放后的悬赏 × 比例；材料份数同样按比例向下取整
   *   · 战力任务此时判定成败：**战力达标必成**；不达标按概率（25%~95%），
   *     失败按 failHalf 再减半且不发材料
   * 返回 ok=true 时槽位转 empty（本轮不再刷新，下一轮重来）
   */
  claimTask (i, now = Date.now()) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    const slot = this.s.slots[i]
    const def = this.taskDefOf(slot)
    if (!slot || !def) return { ok: false, message: '没有这个任务槽。' }
    if (slot.state !== 'running') return { ok: false, message: '这个任务还没接。' }

    const prog = this.progressOf(slot, now)
    const gateMs = this.claimGateMs(def)
    if (prog.elapsedMs < gateMs) {
      const waitMs = Math.ceil(gateMs - prog.elapsedMs)
      return {
        ok: false,
        ratio: prog.ratio,
        message: `「${def.name}」才刚接手（${(prog.elapsedMs / 1000).toFixed(1)} 秒），至少办够 ${(gateMs / 1000).toFixed(1)} 秒才好交差（约 ${Math.max(1, Math.ceil(waitMs / 1000))} 秒后）。`
      }
    }
    return this._resolve(slot, def, now, {})
  }

  /**
   * 结算一个 running 槽位（手动交差 / 到点自动交差 / 接取即完成三处共用）
   * @param {object} slot 槽位
   * @param {object} def 任务定义
   * @param {number} now 当前时间戳
   * @param {{full?:boolean, auto?:boolean, instant?:boolean}} opts
   *        full＝按满额结算（到点 / 接取即完）｜auto＝自动交差｜instant＝战力碾压当场办妥
   */
  _resolve (slot, def, now, opts = {}) {
    const prog = this.progressOf(slot, now)
    const ratio = opts.full ? 1 : prog.ratio
    const early = !opts.full && !prog.done

    let success = true
    let rate = 1
    let outmatched = false
    if (def.kind === 'power') {
      const req = Math.max(1, slot.req | 0)
      rate = clamp(this.power / req, 0.25, 0.95)
      outmatched = this.power >= req
      // 战力达标 → 必成（主人口径：达标就该办得成）；不达标才按概率
      success = outmatched ? true : Math.random() < rate
    }

    const base = this.contribOf(def)
    let contrib = Math.max(0, Math.round(base * ratio))
    let matText = ''
    if (!success) {
      if (def.failHalf) contrib = Math.floor(contrib / 2)
      else contrib = 0
    } else if (def.material) {
      const m = def.material
      const rolled = m.min + Math.floor(Math.random() * (m.max - m.min + 1))
      const n = Math.floor(rolled * ratio)
      if (n > 0) {
        const inv = this.state.inventory.items
        inv[m.id] = (inv[m.id] | 0) + n
        matText = `，${getItem(m.id).name} +${n}`
      }
    }
    this.earnContribution(contrib)
    slot.state = 'empty'
    slot.startAt = 0
    slot.req = 0

    const verdict = def.kind !== 'power'
      ? ''
      : (success ? (outmatched ? '（战力压过定标，顺利办妥）' : '') : '（战力不济，出了岔子）')
    const tag = opts.instant
      ? '接取即办妥'
      : (opts.auto ? '时辰已到 · 自动交差' : (early ? `提前交差（办妥 ${Math.round(ratio * 100)}%）` : '交差'))
    return {
      ok: true,
      index: this.s.slots.indexOf(slot),
      taskId: def.id,
      taskName: def.name,
      auto: !!opts.auto,
      instant: !!opts.instant,
      success,
      contrib,
      rate,
      ratio,
      early,
      matText,
      message: `「${def.name}」${tag}${verdict}：贡献 +${contrib}${matText}。`
    }
  }

  /**
   * 到点自动交差（主循环每拍调用）：所有 running 且走到时限的槽位一律结算
   * @returns {Array<object>} 结算结果（供装配层打日志 / 飘字）
   */
  autoClaimDue (now = Date.now()) {
    const out = []
    if (!this.joined) return out
    const slots = this.s.slots || []
    for (const slot of slots) {
      if (!slot || slot.state !== 'running') continue
      const def = this.taskDefOf(slot)
      if (!def) continue
      const prog = this.progressOf(slot, now)
      if (!prog.done) continue
      out.push(this._resolve(slot, def, now, { full: true, auto: true }))
    }
    return out
  }

  // ── 藏经阁 / 商店 ───────────────────────────────────────────────────────

  /** 贡献兑换功法（落到 tech.ownedTechniques，1 级；去功法面板自行装备） */
  buyLibrary (id) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    const entry = LIBRARY.find((x) => x.id === id)
    if (!entry) return { ok: false, message: '藏经阁没有这部功法。' }
    const t = getTechnique(id)
    if (!t) return { ok: false, message: '功法登记缺失，暂不可借阅。' }
    if (this.rankMeta.idx < entry.rank) return { ok: false, message: `${RANKS[entry.rank].name}方可入${entry.rank === 1 ? '二' : '一'}层借阅。` }
    if (this.tech && this.tech.has(id)) return { ok: false, message: `《${t.name}》已在囊中。` }
    if (this.contribution < entry.cost) {
      return { ok: false, message: `贡献不足：借阅《${t.name}》需 ${entry.cost}，还差 ${entry.cost - this.contribution}。` }
    }
    this.state.resources.contribution = this.contribution - entry.cost
    if (this.tech) this.tech.owned[id] = { level: 1 }
    return { ok: true, message: `以 ${entry.cost} 贡献借得《${t.name}》——去功法面板装槽即可生效。` }
  }

  /** 商店价（职级折扣；藏经阁不打折） */
  shopPrice (entry) {
    const d = this.joined ? this.rankMeta.discount : 0
    return Math.max(1, Math.round(entry.cost * (1 - d)))
  }

  /** 贡献兑换丹药/材料 → 背包 */
  buyShop (id) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    const entry = SHOP.find((x) => x.id === id)
    if (!entry) return { ok: false, message: '商店没有这件货。' }
    const price = this.shopPrice(entry)
    if (this.contribution < price) {
      const it = getItem(id)
      return { ok: false, message: `贡献不足：换 ${it.name} 需 ${price}，还差 ${price - this.contribution}。` }
    }
    this.state.resources.contribution = this.contribution - price
    const inv = this.state.inventory.items
    inv[entry.id] = (inv[entry.id] | 0) + (entry.n || 1)
    const it = getItem(entry.id)
    return {
      ok: true,
      message: `以 ${price} 贡献换得 ${it.name} ×${entry.n || 1}（已入行囊）。`
    }
  }

  // ── 2.5 渡劫援助（跨模块唯一接口：只读报价 + 由本系统自己扣贡献）─────────
  // 说明：CultivationSystem 不得读写 state.sect；由 main.js 注入本实例后调用这两个方法。

  /** 请同门结阵护法的价码与资格（纯读；设计口径「宗门援助 单雷 +5%」） */
  trialAid (nodeIndex = 0) {
    const idx = Math.max(0, nodeIndex | 0)
    const raw = TRIAL_AID.contribBase * Math.pow(TRIAL_AID.contribGrowth, idx)
    const discount = this.joined ? this.rankMeta.discount : 0
    const cost = Math.max(1, Math.round(raw * (1 - discount)))
    return {
      joined: this.joined,
      cost,
      listCost: Math.max(1, Math.round(raw)),
      discount,
      rankName: this.joined ? this.rankMeta.name : '',
      have: this.contribution,
      affordable: this.joined && this.contribution >= cost
    }
  }

  /** 支付结阵贡献（写本模块子树：resources.contribution） */
  payTrialAid (nodeIndex = 0) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门，无人可请。' }
    const info = this.trialAid(nodeIndex)
    if (this.contribution < info.cost) {
      return { ok: false, cost: info.cost, message: `贡献不足：请同门结阵需 ${info.cost} 贡献（现有 ${this.contribution}）。` }
    }
    this.state.resources.contribution = this.contribution - info.cost
    return { ok: true, cost: info.cost, message: `${info.rankName}同门闻讯赶来，结阵护法（贡献 −${info.cost}）：` }
  }

  // ── 视图（装配层渲染用，纯读）────────────────────────────────────────────

  infoView (now = Date.now()) {
    if (!this.joined) {
      return { joined: false, sect: SECT }
    }
    const cur = this.rankMeta
    const promo = this.promoInfo()
    return {
      joined: true,
      sect: SECT,
      rank: cur,
      contribution: this.contribution,
      totalContrib: this.s.totalContrib | 0,
      salaryPerDay: this.salaryPerDay(),
      salaryPerSec: this.salaryQiPerSec(),
      slots: cur.slots,
      promo,
      realmName: getRealmMeta(this.realmIndex).name,
      // 任务板轮次（主人 2026-09-19：宗门独立周期 7 游戏天 ≈ 现实 7 分钟）
      refreshDays: SECT_REFRESH_DAYS,
      refreshText: fmtSectRefreshPeriod(),
      nextRefreshInMs: sectMsToNextRefresh(now),
      // V3.3.1：宗门按境界下发功法的进度（面板提示用）
      realmGrants: REALM_GRANTS.filter((g) => (g.pool || []).length > 0).map((g) => ({
        realmIndex: g.realmIndex,
        label: g.label || getRealmMeta(g.realmIndex).name,
        unlocked: this.realmIndex >= g.realmIndex,
        techId: this.s.techGrants[String(g.realmIndex)] || null
      })),
      pendingGrants: this.pendingGrantTiers()
    }
  }

  tasksView (now = Date.now()) {
    if (!this.joined) return []
    const power = this.power
    return (this.s.slots || []).map((slot, i) => {
      const def = this.taskDefOf(slot)
      if (!def) return { index: i, broken: true }
      const prog = this.progressOf(slot, now)
      const liveRate = (def.kind === 'power' && slot.state === 'running')
        ? clamp(power / Math.max(1, slot.req), 0.25, 0.95)
        : null
      // 提前交差的折算预览（面板要能"看得见交出去能拿多少"）
      const ratio = slot.state === 'running' ? prog.ratio : 0
      const claimRatio = Math.max(prog.done ? 1 : ratio, 0)
      const gateMs = this.claimGateMs(def)
      return {
        index: i,
        def,
        state: slot.state,           // open | running | empty
        req: slot.req || 0,
        elapsedMs: prog.elapsedMs,
        totalMs: prog.totalMs,
        done: prog.done,
        ratio,
        gateMs,
        // 交差门槛＝min(10% 时长, 1 秒)；到点会自动交差，故 running 且过门槛即可点
        claimable: slot.state === 'running' && prog.elapsedMs >= gateMs,
        autoInMs: slot.state === 'running' ? Math.max(0, prog.totalMs - prog.elapsedMs) : 0,
        // 战力已达定标（面板提示"接取即办妥"）
        outmatched: def.kind === 'power' && slot.state === 'open'
          ? this.power >= Math.round(this.basePower * def.reqMul)
          : (def.kind === 'power' && slot.state === 'running' ? this.power >= (slot.req | 0) : false),
        contrib: this.contribOf(def),              // 满额悬赏（已按境界缩放）
        previewContrib: Math.round(this.contribOf(def) * claimRatio),
        liveRate
      }
    })
  }

  libraryView () {
    return LIBRARY.map((e) => {
      const t = getTechnique(e.id)
      return {
        ...e,
        name: t ? t.name : e.id,
        tierLabel: t ? tierLabel(t) : '—',
        owned: this.tech ? this.tech.has(e.id) : false,
        rankLocked: this.joined && this.rankMeta.idx < e.rank
      }
    })
  }

  shopView () {
    const d = this.joined ? this.rankMeta.discount : 0
    return SHOP.map((e) => {
      const it = getItem(e.id)
      return {
        ...e,
        name: it.name,
        unit: it.unitLabel || '',
        price: this.shopPrice(e),
        discounted: d > 0
      }
    })
  }
}

export default SectSystem
