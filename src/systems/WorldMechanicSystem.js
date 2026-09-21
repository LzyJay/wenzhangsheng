/**
 * WorldMechanicSystem.js —— 各世界专属机制（纯逻辑层）（V5.2 · P5.2 三界样板）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM、**禁止 import 任何 system**；
 *   只读写 state。参数与纯函数全部来自 src/data/worldMechanics.js（数据先行，本文件不另立数值）。
 *
 * 数据源：《设计增补 v1.2》§二 总表 / §三 详情卡（见 data/worldMechanics.js 文件头）。
 *
 * 存档（**只用 V2.9 已预留的两叶**，懒建兜底、零迁移、不动 SaveSystem 迁移链）：
 *   state.world.specialState  —— 动作冷却 / 次数 / 内部计分（族贡 / 剑意 / 剑阶）
 *   state.world.frictionState —— 摩擦项开关（望族族贡抽成）
 *   本系统**不 import WorldSystem**：老档 state.world 缺失时补出与 WorldSystem 同构的最小子树
 *   （{ worldId, specialState, frictionState }）——WorldSystem.s 的 `'worldId' in w` 判定会跳过
 *   老档迁移分支并补齐其余字段，两处的叶互不覆盖（自测断言）。
 *
 * 跨模块接线（13.1②：一律由 main.js 中转，本文件不 import 任何 system）：
 *   · main.js 注入 world（WorldSystem 实例）→ 只调公开方法 rootCostMul()，用于**展示联动**
 *     （青岚「伪灵根突破成本 +10%」已在突破报价里生效，机制侧不重复收费）
 *   · main.js 注入 powerMul 闭包 → 小天劫考核的需求战力与实际战力同口径（与秘境 / 宗门一致）；
 *     剑阶战力微加成经本系统 powerPct / bonusView() 反向喂回装配层战力乘区
 *
 * 周期口径：一律走 gametime（periodKeyOf / msToNextPeriod），与坊市 / 兽潮同一把尺，不另立时钟。
 * 产出口径：不发境界，只给灵石与既有材料（量级护栏见 data/worldMechanics.js）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  MECH, mechanicsOf, actsOf, getAct, cycleMsOf, cycleKeyOf,
  stonesOfH, matsTextOf, pointKeysOf, pointNameOf,
  quotaOf, rankOf, rankThresholdsOf, tributeRateOf, needPowerOf,
  staticDailyH, staticDailyHCap, worldMetaOf
} from '../data/worldMechanics.js'
import { getLevelInfo, getRealmMeta } from '../data/realms.js'
import { getItem } from '../data/items.js'
import { fmtGameDuration } from '../data/gametime.js'

class WorldMechanicSystem {
  /**
   * @param {object} state 存档状态树
   * @param {WorldSystem|null} world 世界系统实例（**只调公开方法 rootCostMul()**，用于摩擦展示联动；
   *        由 main.js 注入 —— 13.1②：System 之间不横向 import）
   * @param {Function|null} powerMul 战力乘区闭包（功法 / 灵兽 / 剑阶等常驻加成；由 main.js 注入）
   */
  constructor (state, world = null, powerMul = null) {
    this.state = state
    this.worldSys = world
    this.powerMul = powerMul
  }

  // ── 存档子树（懒建兜底；不覆盖既有叶）────────────────────────────────────
  ensure () {
    let w = this.state.world
    if (!w || typeof w !== 'object') {
      // 与 WorldSystem 同构的最小子树（worldId 存在 → WorldSystem 走「补字段」分支，不走老档迁移）
      w = this.state.world = { worldId: null, specialState: {}, frictionState: {} }
    }
    if (!w.specialState || typeof w.specialState !== 'object') w.specialState = {}
    if (!w.frictionState || typeof w.frictionState !== 'object') w.frictionState = {}
    const sp = w.specialState
    if (!sp.acts || typeof sp.acts !== 'object') sp.acts = {}
    if (!Number.isFinite(sp.tribute)) sp.tribute = 0
    if (!Number.isFinite(sp.donated)) sp.donated = 0
    if (!Number.isFinite(sp.jianYi)) sp.jianYi = 0
    if (!Number.isFinite(sp.jianJie)) sp.jianJie = 0
    if (typeof w.frictionState.tributeOn !== 'boolean') w.frictionState.tributeOn = true
    return this
  }

  get s () { return this.ensure().state.world }
  get special () { return this.ensure().s.specialState }
  get frictionState () { return this.ensure().s.frictionState }
  /** 背包快捷访问（与 DungeonSystem.items 同法，老档自愈） */
  get items () {
    const inv = this.state.inventory
    if (!inv || typeof inv !== 'object') this.state.inventory = { items: {} }
    if (!this.state.inventory.items || typeof this.state.inventory.items !== 'object') {
      this.state.inventory.items = {}
    }
    return this.state.inventory.items
  }

  // ── 基础查询 ────────────────────────────────────────────────────────────
  /** 当前世界 id（只读直读，**不经懒建**——查询不该长出子树，照 WorldSystem.bonusView 惯例） */
  get worldId () {
    const w = this.state.world
    return (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : null
  }

  /** 本界机制参数块（未实装世界返回 null；只读直读，不懒建） */
  get block () {
    const w = this.state.world
    const id = (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : null
    return id ? mechanicsOf(id) : null
  }

  get level () {
    return this.state.player.realm.level
  }

  /** 大境界序（REALM_META 下标） */
  get realmIndex () {
    return Math.min(Math.max(Math.floor((this.level - 1) / 9), 0), 8)
  }

  /** 当前战力（基准 × 常驻乘区；与秘境 / 宗门同一口径） */
  get power () {
    const base = getLevelInfo(this.level).combat.power
    return Math.round(base * (this.powerMul ? this.powerMul() : 1))
  }

  /** 剑阶（青云法宝成长线；其余界恒 0） */
  get skillLevel () {
    const v = this.special.jianJie
    return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0
  }

  /** 剑阶战力微加成（每阶 +0.5%）——经 main.js 接线进战力乘区 */
  get powerPct () {
    const b = this.block
    const act = b ? getAct(b.id, 'qingyun_refine') : null
    if (!act || !act.powerPctPer) return 0
    return act.powerPctPer * this.skillLevel
  }

  /** 族贡余额 / 终身纳贡（望族；其余界恒 0） */
  get tribute () { return Math.max(0, Number(this.special.tribute) || 0) }
  get donated () { return Math.max(0, Number(this.special.donated) || 0) }

  /** 族贡抽成开关（望族摩擦项；默认开） */
  get tributeOn () { return this.frictionState.tributeOn !== false }

  /** 当前职级（望族；未登记返回 null） */
  get rank () {
    const b = this.block
    if (!b || !b.ranks) return null
    return rankOf(b, this.donated, this.tributeOn)
  }

  get rankIdx () {
    const r = this.rank
    return r ? r.idx : 0
  }

  /** 本界内部计分（面板显示用） */
  pointsView () {
    const b = this.block
    if (!b || !b.points) return []
    return Object.keys(b.points).map((k) => ({
      key: k,
      name: pointNameOf(b, k),
      unit: b.points[k].unit || '',
      value: Math.max(0, Number(this.special[k]) || 0)
    }))
  }

  // ── 动作状态 / 可用性 ──────────────────────────────────────────────────
  /** 单动作存档状态（**只读**：查询不长出子树，照 WorldSystem.bonusView 惯例） */
  _actState (actId) {
    const acts = this.special.acts
    const a = acts[actId]
    if (!a || typeof a !== 'object') return { lastAt: 0, key: '', used: 0 }
    return {
      lastAt: Number.isFinite(a.lastAt) ? a.lastAt : 0,
      key: typeof a.key === 'string' ? a.key : '',
      used: Number.isFinite(a.used) ? a.used : 0
    }
  }

  /** 单动作存档状态（**写入**：真正动手时才懒建并落档） */
  _actStateForWrite (actId) {
    const acts = this.special.acts
    let a = acts[actId]
    if (!a || typeof a !== 'object') a = acts[actId] = { lastAt: 0, key: '', used: 0 }
    if (!Number.isFinite(a.lastAt)) a.lastAt = 0
    if (typeof a.key !== 'string') a.key = ''
    if (!Number.isFinite(a.used)) a.used = 0
    return a
  }

  /** 门槛：动作解锁所需大境界是否已到 */
  _unlocked (act) {
    return act.unlockRealm == null ? true : this.realmIndex >= act.unlockRealm
  }

  /** 每周期剩余次数（无 quota 的动作返回 null＝不限次） */
  _quotaLeft (act, now) {
    const q = quotaOf(act, this.rankIdx)
    if (q == null) return null
    const st = this._actState(act.id)
    return st.key === cycleKeyOf(act, now) ? Math.max(0, q - (st.used | 0)) : q
  }

  /**
   * 冷却剩余毫秒。
   * ⚠ 口径（自测抓到的真缺陷）：**带「每周期额度」的动作不吃周期冷却**——额度本身就是"本轮可用几次"，
   *   再叠一层「整轮只能用一次」会把额度废掉（望族纳贡/兑换原本永远只能用 1 次）。
   *   无额度的动作（催熟 / 参悟 / 考核 / 祭炼）才按周期冷却。
   */
  _cdLeftOf (act, now) {
    if (quotaOf(act, this.rankIdx) != null) return 0
    const st = this._actState(act.id)
    return Math.max(0, Number(st.lastAt) + cycleMsOf(act) - now)
  }

  /**
   * 支出 / 收入明细（面板与结算共用同一份算法——不会出现"显示的价与扣的价"两套）
   * 抽成只对本界**登记了 tribute 摩擦**的世界生效（望族），且只作用于本界灵石产出：
   *   到手 ×(1−rate)，上缴额按 pointPerH 折族贡回流。
   */
  _flowsOf (act) {
    const b = this.block
    const cost = act.cost || {}
    const gain = act.gain || {}
    const scale = 1 + (Number(gain.hPerSkillLevel) || 0) * this.skillLevel
    const taxed = !!(b && b.frictionRule && b.frictionRule.kind === 'tribute')
    const rate = taxed ? tributeRateOf(b, this.rankIdx, this.tributeOn) : 0
    const grossH = (Number(gain.h) || 0) * scale
    const taxH = rate > 0 ? grossH * rate : 0
    return {
      scale,
      rate,
      costH: Number(cost.h) || 0,
      costStones: stonesOfH(cost.h, this.level),
      costMats: Array.isArray(cost.mats) ? cost.mats : [],
      costPoints: pointKeysOf({ cost }).map((k) => ({ key: k, n: Number(cost[k]) || 0 })),
      gainH: grossH - taxH,
      gainStones: stonesOfH(grossH - taxH, this.level),
      gainMats: Array.isArray(gain.mats) ? gain.mats : [],
      gainPoints: pointKeysOf({ gain }).map((k) => ({ key: k, n: Number(gain[k]) || 0 })),
      taxH,
      taxPoints: taxH > 0 ? Math.round(taxH * MECH.pointPerH) : 0
    }
  }

  /** 资源是否够（灵石 / 材料 / 计分） */
  _affordable (act) {
    const f = this._flowsOf(act)
    if ((this.state.resources.stones | 0) < f.costStones) return false
    for (const m of f.costMats) if ((this.items[m.id] | 0) < (m.n | 0)) return false
    for (const p of f.costPoints) if ((this.special[p.key] | 0) < p.n) return false
    return true
  }

  /** 支出文案（回执与错误提示共用） */
  _costTextOf (act) {
    const b = this.block
    const f = this._flowsOf(act)
    return [
      f.costStones > 0 ? `灵石 ${f.costStones}` : '',
      matsTextOf(f.costMats),
      f.costPoints.map((p) => `${pointNameOf(b, p.key)} ${p.n}`).join(' · ')
    ].filter(Boolean).join(' · ') || '无'
  }

  /**
   * 单动作视图（面板渲染用，纯读）
   * @returns {{id,kind,label,note,cycleDays,cycleText,unlocked,unlockName,ready,inMs,quota,quotaLeft,
   *   costs:Array,costText,gains:Array,gainText,affordable,disabledReason,ratePct,pass?,needPower?,power?,
   *   level?,maxLevel?,powerPctPer?,ratePctPer?,canLevel?}}
   */
  actInfo (actId, now = Date.now()) {
    const b = this.block
    const act = b ? getAct(b.id, actId) : null
    if (!act) return null
    const f = this._flowsOf(act)
    const unlocked = this._unlocked(act)
    const quotaLeft = this._quotaLeft(act, now)
    const cdLeft = this._cdLeftOf(act, now)
    const affordable = this._affordable(act)

    const costs = []
    if (f.costStones > 0) costs.push({ text: `灵石 ${f.costStones}` })
    for (const m of f.costMats) costs.push({ text: `${getItem(m.id).name} ×${m.n}` })
    for (const p of f.costPoints) costs.push({ text: `${pointNameOf(b, p.key)} ${p.n}` })
    const gains = []
    if (f.gainStones > 0) gains.push({ text: `灵石 ${f.gainStones}` })
    for (const m of f.gainMats) gains.push({ text: `${getItem(m.id).name} ×${m.n}` })
    for (const p of f.gainPoints) gains.push({ text: `${pointNameOf(b, p.key)} ${p.n}` })
    if (f.taxPoints > 0) gains.push({ text: `抽成回流 ${pointNameOf(b, 'tribute')} ${f.taxPoints}` })

    const info = {
      id: act.id,
      kind: act.kind,
      label: act.label,
      note: act.note || '',
      cycleDays: act.cycleDays || MECH.dayGameDays,
      cycleText: `${act.cycleDays || MECH.dayGameDays} 游戏天`,
      unlocked,
      unlockName: act.unlockRealm == null ? '' : getRealmMeta(act.unlockRealm).name,
      inMs: cdLeft,
      quota: quotaOf(act, this.rankIdx),
      quotaLeft,
      costs,
      costText: costs.map((c) => c.text).join(' · '),
      gains,
      gainText: gains.map((g) => g.text).join(' · '),
      affordable,
      ratePct: f.rate,
      taxPoints: f.taxPoints
    }
    let reason = ''
    if (!unlocked) reason = `需 ${info.unlockName}期`
    else if (quotaLeft === 0) reason = '本轮额度已用尽'
    else if (cdLeft > 0) reason = `${fmtGameDuration(cdLeft)}后再来`
    else if (!affordable) reason = `资源不足（${info.costText}）`
    if (act.kind === 'check') {
      info.needPower = needPowerOf(act, this.level)
      info.power = this.power
      info.pass = this.power >= info.needPower
      if (!reason && !info.pass) reason = `战力不足（需 ${info.needPower}）`
    }
    if (act.kind === 'refine') {
      info.level = this.skillLevel
      info.maxLevel = act.maxLevel || 0
      info.powerPctPer = act.powerPctPer || 0
      info.ratePctPer = act.ratePctPer || 0
      info.canLevel = this.skillLevel < (act.maxLevel || 0)
      if (!info.canLevel) reason = `${info.maxLevel} 阶已封顶`
    }
    info.disabledReason = reason
    info.ready = !reason
    return info
  }

  /** 本界全部动作视图 */
  actList (now = Date.now()) {
    const b = this.block
    return b ? b.acts.map((a) => this.actInfo(a.id, now)).filter(Boolean) : []
  }

  /**
   * 执行动作（面板点击入口；系统内完成全部结算，返回明细供面板回执 + 归因）
   * @returns {{ok:boolean, message:string, actId?:string, kind?:string, failed?:boolean,
   *   stones?:number, gainStones?:number, costStones?:number, mats?:Array<{id,n}>,
   *   points?:object, refund?:object, level?:number, powerPct?:number}}
   */
  doAct (actId, now = Date.now()) {
    const b = this.block
    if (!b) return { ok: false, message: '此界尚无专属机制（内容批次 2/3 世界篇余项 · 待 A4a 铺量）。' }
    const act = getAct(b.id, actId)
    if (!act) return { ok: false, message: `未登记的世界机制动作：${actId}` }
    if (!this._unlocked(act)) {
      return { ok: false, message: `尚未到 ${getRealmMeta(act.unlockRealm).name}期，此机制未启。` }
    }
    const quotaLeft = this._quotaLeft(act, now)
    if (quotaLeft === 0) return { ok: false, message: `${act.label}：本轮额度已用尽，下轮再来。` }
    const cdLeft = this._cdLeftOf(act, now)
    if (cdLeft > 0) return { ok: false, message: `${act.label}：${fmtGameDuration(cdLeft)}后再来。` }
    if (act.kind === 'refine' && this.skillLevel >= (act.maxLevel || 0)) {
      return { ok: false, message: `${act.label}：法宝已至 ${act.maxLevel} 阶封顶。` }
    }
    if (!this._affordable(act)) {
      return { ok: false, message: `${act.label}：资源不足（需 ${this._costTextOf(act)}）。` }
    }

    const f = this._flowsOf(act)

    // 战力校验型：不过则本轮空过（冷却照走，奖励不发）
    if (act.kind === 'check' && this.power < needPowerOf(act, this.level)) {
      this._markUsed(act, now)
      return {
        ok: false,
        failed: true,
        actId: act.id,
        kind: act.kind,
        power: this.power,
        needPower: needPowerOf(act, this.level),
        message: `小天劫未过：需战力 ${needPowerOf(act, this.level)}（当前 ${this.power}）。本轮空过，下轮再来。`
      }
    }

    // ① 扣支出
    if (f.costStones > 0) this.state.resources.stones -= f.costStones
    for (const m of f.costMats) this.items[m.id] = (this.items[m.id] | 0) - (m.n | 0)
    for (const p of f.costPoints) this.special[p.key] = (this.special[p.key] | 0) - p.n

    // ② 发收入
    const matsOut = []
    if (f.gainStones > 0) this.state.resources.stones = (this.state.resources.stones | 0) + f.gainStones
    for (const m of f.gainMats) {
      this.items[m.id] = (this.items[m.id] | 0) + (m.n | 0)
      matsOut.push({ id: m.id, n: m.n })
    }
    const pointsOut = {}
    for (const p of f.gainPoints) {
      this.special[p.key] = (this.special[p.key] | 0) + p.n
      pointsOut[p.key] = p.n
      if (p.key === 'tribute') this.special.donated = (this.special.donated | 0) + p.n
    }

    // ②b V6.10 批 H：**实物型收益**（寿元 / 气运）—— 不是界内计分，单独入账
    const gain = act.gain || {}
    const extra = []
    if (Number.isFinite(gain.years) && gain.years > 0) {
      const lf = this.state.player.lifespan
      if (lf && typeof lf === 'object') {
        const cap = Number.isFinite(lf.maxYears) ? lf.maxYears : Infinity
        const before = Number(lf.remainYears) || 0
        lf.remainYears = Math.min(cap, before + gain.years)
        extra.push(`寿元 +${Math.round((lf.remainYears - before) * 10) / 10} 年`)
      }
    }
    if (Number.isFinite(gain.luck) && gain.luck !== 0) {
      const before = Number(this.state.player.luck) || 0
      this.state.player.luck = Math.max(0, Math.min(100, before + gain.luck))
      extra.push(`气运 ${this.state.player.luck >= before ? '+' : '−'}${Math.abs(this.state.player.luck - before)}（${before}→${this.state.player.luck}）`)
    }

    // ②c V6.10 批 H：**真随机档位**（通天「天道」/ 六面「天劫盲盒」）—— 命中才额外发放；
    //   期望值由 data 层对齐（确定部分 + p × 随机部分 ＝ 旧固定值），护栏按期望计入。
    let gambleHit = false
    if (act.gamble && act.gamble.gain) {
      gambleHit = Math.random() < (Number(act.gamble.p) || 0)
      if (gambleHit) {
        const bh = (Number(act.gamble.gain.h) || 0) * f.scale * (1 - f.rate)
        const bs = stonesOfH(bh, this.level)
        this.state.resources.stones = (this.state.resources.stones | 0) + bs
        extra.push(`天道开眼，额外 +${bs} 灵石`)
      } else {
        extra.push('这一回没讲成价')
      }
    }
    // ②d V6.10 批 H：**一次性突破成本修正**（通天「天道讲价」）
    //   写入本界 specialState，由 CultivationSystem.mechCostMul 读取、突破结算时消费并清除。
    if (act.priceMul) {
      const v = gambleHit ? Number(act.priceMul.hit) : Number(act.priceMul.miss)
      if (Number.isFinite(v) && v > 0) {
        this.special.tiandaoMul = v
        extra.push(v < 1 ? `下次突破成本 ×${v}（讲成了价）` : `下次突破成本 ×${v}（失手加价）`)
      }
    }
    // ③ 抽成回流（望族「上缴换权益」）：上缴的灵石额折族贡回流，同时累计纳贡
    const refund = {}
    if (f.taxPoints > 0) {
      this.special.tribute = (this.special.tribute | 0) + f.taxPoints
      this.special.donated = (this.special.donated | 0) + f.taxPoints
      refund.tribute = f.taxPoints
    }
    // ④ 升阶（青云祭炼）
    if (act.kind === 'refine') {
      this.special.jianJie = Math.min(act.maxLevel || 0, this.skillLevel + 1)
      pointsOut.jianJie = this.special.jianJie
    }

    this._markUsed(act, now)

    const gainText = [
      f.gainStones > 0 ? `灵石 +${f.gainStones}` : '',
      matsTextOf(matsOut),
      Object.keys(pointsOut).filter((k) => k !== 'jianJie')
        .map((k) => `${pointNameOf(b, k)} +${pointsOut[k]}`).join(' · '),
      refund.tribute ? `抽成回流 ${pointNameOf(b, 'tribute')} +${refund.tribute}` : ''
    ].filter(Boolean).join('，')
    const spendText = this._costTextOf(act)

    const extraText = extra.length ? extra.join('，') : ''
    const message = act.kind === 'refine'
      ? `${act.label}：法宝晋至 ${this.skillLevel} 阶（战力 +${(this.powerPct * 100).toFixed(1)}%、剑冢产出 +${(act.ratePctPer * this.skillLevel * 100).toFixed(0)}%），耗 ${spendText}。`
      : `${act.label}：${[gainText, extraText].filter(Boolean).join('，') || '—'}${spendText !== '无' ? `（耗 ${spendText}）` : ''}。`

    return {
      ok: true,
      actId: act.id,
      kind: act.kind,
      message,
      stones: f.gainStones - f.costStones,
      gainStones: f.gainStones,
      costStones: f.costStones,
      mats: matsOut,
      points: pointsOut,
      refund,
      level: act.kind === 'refine' ? this.skillLevel : undefined,
      powerPct: this.powerPct
    }
  }

  _markUsed (act, now) {
    const st = this._actStateForWrite(act.id)
    const key = cycleKeyOf(act, now)
    if (st.key !== key) { st.key = key; st.used = 0 }
    st.used = (st.used | 0) + 1
    st.lastAt = now
  }

  /** 摩擦项开关（目前只有望族族贡抽成；其余界返回 ok:false） */
  setTribute (on) {
    const b = this.block
    const rule = b && b.frictionRule
    if (!rule || rule.kind !== 'tribute' || !rule.toggle) {
      return { ok: false, message: '此界摩擦项不可开关（只做标记与展示）。' }
    }
    const next = !!on
    const prev = this.tributeOn
    this.frictionState.tributeOn = next
    if (next === prev) return { ok: true, changed: false, message: `族贡抽成已是「${next ? '上缴' : '免缴'}」。` }
    return {
      ok: true,
      changed: true,
      on: next,
      message: next
        ? '族贡抽成已开（上缴）：本界灵石产出按职级抽成，上缴额折族贡回流、职级门槛 −10%。'
        : '族贡抽成已关（免缴）：所得全额到手，但无族贡回流、无职级门槛折扣。'
    }
  }

  /** 摩擦项视图（三种：别处已生效的展示联动 / 只做标记 / 可开关） */
  frictionView () {
    const b = this.block
    if (!b) {
      return { kind: 'none', toggle: false, enabled: false, label: '本界专属机制未实装', ratePct: 0, note: '' }
    }
    const rule = b.frictionRule || {}
    if (rule.kind === 'rootCost') {
      // 展示联动：真实值从 WorldSystem 取（未注入时用数据层同源值兜底，两值一致由自测盯）
      const meta = worldMetaOf(b.id) || {}
      const live = (this.worldSys && typeof this.worldSys.rootCostMul === 'function')
        ? this.worldSys.rootCostMul(rule.rarity)
        : ((meta.rootCost && meta.rootCost[rule.rarity]) || 1)
      return {
        kind: rule.kind,
        toggle: false,
        enabled: live > 1,
        label: rule.label,
        mul: live,
        ratePct: live - 1,
        note: rule.note
      }
    }
    if (rule.kind === 'tribute') {
      const r = this.rank
      const ranks = b.ranks || []
      return {
        kind: rule.kind,
        toggle: !!rule.toggle,
        enabled: this.tributeOn,
        label: rule.label,
        ratePct: this.tributeOn ? tributeRateOf(b, this.rankIdx, true) : 0,
        rateTable: ranks.map((x) => `${x.name} ${Math.round(x.rate * 100)}%`).join(' / '),
        rankName: r ? r.name : '',
        rankIdx: this.rankIdx,
        note: rule.note
      }
    }
    return {
      kind: rule.kind || 'mark',
      toggle: false,
      enabled: true,
      label: rule.label || '',
      ratePct: 0,
      note: rule.note || ''
    }
  }

  /** 界内统计（面板头部与自测用；只读） */
  stats () {
    const b = this.block
    if (!b) return { implemented: false }
    const out = { implemented: true, worldId: b.id, name: b.name, source: b.source, points: this.pointsView() }
    if (b.points && b.points.jianYi) {
      out.jianYi = Math.max(0, Number(this.special.jianYi) || 0)
      out.jianJie = this.skillLevel
      out.powerPct = this.powerPct
    }
    if (b.points && b.points.tribute) {
      out.tribute = this.tribute
      out.donated = this.donated
      out.rank = this.rank
      out.tributeOn = this.tributeOn
      if (b.ranks) {
        const th = rankThresholdsOf(b, this.tributeOn)
        out.rankTable = b.ranks.map((r, i) => `${r.name}（${th[i]} 贡 · 抽成 ${Math.round(r.rate * 100)}%）`).join(' → ')
      }
    }
    return out
  }

  /** 静态日产出（当量 h/日）——量级护栏口径，供面板脚注与自测 */
  staticDailyH () {
    const b = this.block
    if (!b) return { h: 0, rows: [] }
    return staticDailyH(b.id, {
      level: this.level,
      rankIdx: this.rankIdx,
      skillLevel: this.skillLevel,
      tributeOn: this.tributeOn
    })
  }

  /** 静态日产出上限（护栏断言用） */
  staticDailyHCap () {
    const b = this.block
    return b ? staticDailyHCap(b.id) : 0
  }

  /**
   * 统一加成接口（V3.5.3 形状）：只报**剑阶战力微加成**一行，无加成时不出行。
   * 只读直读 this.state.world，不经懒建兜底——查询不该长出子树（照 WorldSystem.bonusView 惯例）。
   */
  bonusView () {
    const pct = this.powerPct
    if (!pct) return []
    return [{
      kind: 'power',
      label: `剑冢法宝（${this.skillLevel} 阶）`,
      mul: 1 + pct,
      pct,
      note: '青云古界「剑冢」法宝成长线的战力微加成（每阶 +0.5%，九阶封顶 +4.5%）'
    }]
  }

  /** 面板视图（纯读） */
  view (now = Date.now()) {
    const id = this.worldId
    if (!id) {
      return {
        drawn: false, worldId: null, implemented: false, name: '未定世界',
        acts: [], frictionRow: this.frictionView(), stats: { implemented: false },
        static: { h: 0, rows: [] }, staticCap: 0, points: [],
        note: '开局抽定世界后，此界专属机制（核心＋摩擦）在此开启。'
      }
    }
    const b = this.block
    const meta = worldMetaOf(id) || {}
    const sd = this.staticDailyH()
    return {
      drawn: true,
      worldId: id,
      implemented: !!b,
      name: (b && b.name) || meta.name || id,
      tag: meta.tag || '',
      color: meta.color || '',
      identity: meta.identity || '',
      exclusive: (b && b.exclusive) || meta.exclusive || '',
      friction: (b && b.friction) || meta.friction || '',
      source: (b && b.source) || '（本界专属机制属内容批次 2/3 世界篇余项）',
      acts: this.actList(now),
      frictionRow: this.frictionView(),
      stats: this.stats(),
      points: this.pointsView(),
      static: sd,
      staticCap: this.staticDailyHCap(),
      staticStones: stonesOfH(sd.h, this.level),
      note: b
        ? '机制产出不发境界，只给灵石与既有材料；量级按「每小时当量 → 折灵石 → 与派遣线对比」静态核算（见回执-A3）。'
        : '本界专属机制＝内容批次 2/3（世界篇）余项 —— A4a 批按 src/data/worldMechanics.js 的模板铺量。'
    }
  }
}

export { actsOf }

export default WorldMechanicSystem
