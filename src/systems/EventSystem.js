/**
 * EventSystem.js —— 随机事件与气运（纯逻辑层）(2.3)
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / 13.1）：禁止 import Phaser、禁止操作 DOM、禁止横向 import
 * 其他 System；只读写 state。产出换算所需的"有效产出/灵石时薪"由装配层（main.js）
 * 每次调用时传入（13.1② 装配层接线通道）。
 * 数据源：src/data/events.js；设计依据：《世界事件库 v1》《设计增补 v1.1》§三。
 *
 * 存档子树（13.1④；沿用存档骨架预留字段 state.eventState）：
 *   · pending  待抉择事件（绝/仙级"暂缓等玩家"）｜ book 近事录 ｜ dedupe 同事件冷却
 *   · repays   延迟兑现挂账（恩怨链）        ｜ causes 因果条目
 *   · tribCdExtraSec 渡劫冷却附加（2.5 消费）｜ fitDelta 契合累计（2.11 消费）
 *   另按 v1.1 §三 读写 state.player.luck（气运 0–100）与 settings.autoStrategy（自动策略）。
 * 共享通道注记：state.buffs 是《数据模型》§十四 的 buff 乘区公共通道（道伤亦在此），
 *   事件增益以 evtbuff_* id 写入，与突破/渡劫条目互不冲突。
 *
 * 频率口径：TRIGGER.onlinePerHour（护栏校准值，见 data/events.js 头注）。
 * 结算规则（V4.7 主人 2026-09-18 修订：**按等级**决定自动与否）：
 *   · 在线每秒按期望概率滚动触发；落在自动策略处置范围内的等级即时结算并记近事录
 *     （稳健＝凡/良｜均衡＝凡/良/珍｜激进＝凡~仙，见 data/events.js STRATEGY_AUTO）；
 *   · 超出范围的等级入 pending"暂缓等玩家"（事件簿点选，自动策略只作按钮推荐）；
 *   · 离线按 50% 累积（上限 12 起）回归时批量结算（settleOffline）；
 *   · 延迟兑现挂账到期即自动入账（现实时间）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  WORLD_POOLS, getEvent, getLuckTier, TRIGGER, QUALITY_NAME, CAT_NAME,
  LUCK_TIERS, nominalH,
  // V4.7：策略 → 等级处置范围 / 选项偏好序，与纪事消息共用同一张表（data 层单一真源）
  STRATEGY_PREF, isAutoQuality, strategyAutoLabel
} from '../data/events.js'
import { clamp } from '../util/num.js'   // 区间钳制单一真源（零依赖叶子层 src/util/）

export const STRATEGY_NAME = { steady: '稳健', balanced: '均衡', aggressive: '激进' }

/** 小数字格式化（消息文案用；与 main.js 的 fmt 同口径但不依赖 DOM 层） */
function fmtN (n) {
  const abs = Math.abs(n)
  if (abs < 1e4) return String(Math.round(n))
  if (abs < 1e8) return (n / 1e4).toFixed(2) + '万'
  if (abs < 1e12) return (n / 1e8).toFixed(2) + '亿'
  return (n / 1e12).toFixed(2) + '万亿'
}

class EventSystem {
  constructor (state) {
    this.state = state
  }

  /** 事件子树快捷访问（自动补全结构，老档不崩——照 AlchemySystem.items 兜底写法） */
  get es () {
    const s = this.state
    if (!s.eventState || typeof s.eventState !== 'object') s.eventState = {}
    const es = s.eventState
    if (!Array.isArray(es.pending)) es.pending = []
    if (!Array.isArray(es.book)) es.book = []
    if (!es.dedupe || typeof es.dedupe !== 'object') es.dedupe = {}
    if (!Array.isArray(es.repays)) es.repays = []
    if (!Array.isArray(es.causes)) es.causes = []
    if (typeof es.tribCdExtraSec !== 'number') es.tribCdExtraSec = 0
    if (typeof es.fitDelta !== 'number') es.fitDelta = 0
    if (typeof es.seq !== 'number') es.seq = 0
    return es
  }

  /**
   * 2.11 消费口：取走事件侧累计的契合增减（取后清零）。
   * 由装配层转交 LifespanSystem.addFit 入账——本系统不写 player.fit。
   */
  drainFitDelta () {
    const d = this.es.fitDelta
    this.es.fitDelta = 0
    return d
  }

  // ── 气运（v1.1 §三：0–100 主驱动）───────────────────────────────────────

  get luck () {
    const v = this.state.player.luck
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 100) : 50
  }

  get luckTier () {
    return getLuckTier(this.luck)
  }

  get strategy () {
    const s = this.state.settings.autoStrategy
    return STRATEGY_PREF[s] ? s : 'balanced'
  }

  /** 切换自动策略（落档 settings.autoStrategy） */
  setStrategy (s) {
    if (!STRATEGY_PREF[s]) return { ok: false, message: '未知的自动策略。' }
    this.state.settings.autoStrategy = s
    return { ok: true, message: `自动策略已切换为「${STRATEGY_NAME[s]}」。` }
  }

  get pendingCount () {
    return this.es.pending.length
  }

  /** 老档补字段 / 新档校准（启动时由装配层调一次；幂等） */
  ensure () {
    void this.es // 触发兜底补全
    if (typeof this.state.player.luck !== 'number' || !Number.isFinite(this.state.player.luck)) {
      this.state.player.luck = 50
    }
    this.state.player.luck = clamp(Math.round(this.state.player.luck), 0, 100)
    this.state.settings.autoStrategy = this.strategy
    return this
  }

  // ── 采样（类别 → 品质 → 池 → 去重）─────────────────────────────────────

  /**
   * 从合并池采样一条事件。
   * ① 类别：机缘概率 = 气运档位 goodPct（替代基准 40%），其余按日常/恩怨/灾劫均分；
   * ② 机缘品质：权重 × qualCoef^i（良0/珍1/绝2/仙3），池内缺档向下回退；
   * ③ 池：世界池/通用池各 50%，缺档回退另一池；
   * ④ 去重：同事件 dedupeMs 内不重复；全部冷却中则放开去重兜底。
   */
  _sampleEvent (now) {
    const tier = this.luckTier
    let cat
    if (Math.random() < tier.goodPct) {
      cat = 'jiyuan'
    } else {
      const r = Math.random()
      cat = r < 1 / 3 ? 'richang' : (r < 2 / 3 ? 'enyuan' : 'zaijie')
    }

    let quality
    if (cat === 'jiyuan') {
      const order = ['liang', 'zhen', 'jue', 'xian']
      const weights = order.map((q, i) => {
        const base = { liang: 50, zhen: 30, jue: 15, xian: 5 }[q]
        return base * Math.pow(tier.qualCoef, i)
      })
      const total = weights.reduce((a, b) => a + b, 0)
      let r = Math.random() * total
      quality = order[order.length - 1]
      for (let i = 0; i < order.length; i++) {
        r -= weights[i]
        if (r <= 0) { quality = order[i]; break }
      }
    } else if (cat === 'richang') {
      quality = 'fan'
    } else if (cat === 'enyuan') {
      quality = 'zhen'
    } else {
      quality = Math.random() < 0.5 ? 'liang' : 'zhen'
    }

    const pools = Math.random() < TRIGGER.poolSplit ? ['qinglan', 'common'] : ['common', 'qinglan']
    const downgrades = { xian: 'jue', jue: 'zhen', zhen: 'liang', liang: null, fan: null }

    const pick = (poolId, q, respectDedupe) => {
      const cands = (WORLD_POOLS[poolId] || []).filter((e) =>
        e.cat === cat && e.quality === q &&
        (!respectDedupe || now - (this.es.dedupe[e.id] || 0) >= TRIGGER.dedupeMs))
      if (!cands.length) return null
      return cands[Math.floor(Math.random() * cands.length)]
    }

    let q = quality
    while (q) {
      for (const poolId of pools) {
        const hit = pick(poolId, q, true)
        if (hit) return hit
      }
      q = downgrades[q]
    }
    // 全部冷却中：放开去重再试一轮（保底不出空）
    q = quality
    while (q) {
      for (const poolId of pools) {
        const hit = pick(poolId, q, false)
        if (hit) return hit
      }
      q = downgrades[q]
    }
    return null
  }

  // ── 触发与结算 ──────────────────────────────────────────────────────────

  /**
   * 在线心跳：每秒概率滚动；到期挂账总是结算（现实时间）。
   * @param {number} nowMs 当前时间
   * @param {number} eff   当前有效产出（灵气/秒，装配层传入）
   * @param {number} stoneRate 灵石时薪（data/events.js stoneHourly，装配层传入）
   * @param {boolean} active 是否允许触发新事件（暂停/离线/未测灵根时 false）
   * @returns {Array<{kind:string, good:boolean, message:string}>}
   */
  tick (nowMs = Date.now(), eff = 0, stoneRate = 0, active = true) {
    const out = this._settleRepays(nowMs, eff, stoneRate)
    // 去重表瘦身：超过 64 条时清掉已出冷却期的键（长挂内存护栏）
    const dedupe = this.es.dedupe
    const keys = Object.keys(dedupe)
    if (keys.length > 64) {
      for (const k of keys) {
        if (nowMs - dedupe[k] >= TRIGGER.dedupeMs) delete dedupe[k]
      }
    }
    if (active && this.state.player.flags.rootDrawn) {
      const p = TRIGGER.onlinePerHour * this.luckTier.freqCoef / 3600
      if (Math.random() < p) out.push(...this._trigger(nowMs, eff, stoneRate))
    }
    return out
  }

  /**
   * 离线批量结算（回归 / 启动时调一次）：期望 = 离线小时 × 基准频率 × 50% × 频率系数，
   * 上限 TRIGGER.offlineCap；绝/仙级照旧入 pending 等玩家，其余按自动策略即时结算。
   */
  settleOffline (awaySec, eff = 0, stoneRate = 0, nowMs = Date.now()) {
    if (!this.state.player.flags.rootDrawn) return []
    const hours = Math.max(0, awaySec) / 3600
    const expected = hours * TRIGGER.onlinePerHour * TRIGGER.offlineFactor * this.luckTier.freqCoef
    let count = Math.floor(expected)
    if (Math.random() < expected - count) count += 1
    count = Math.min(count, TRIGGER.offlineCap)
    const out = []
    for (let i = 0; i < count; i++) out.push(...this._trigger(nowMs, eff, stoneRate))
    return out
  }

  /** 触发一条事件：绝/仙 → 待抉择；其余按自动策略即时结算（eff/stoneRate 缺省按 0，防 NaN 污染） */
  _trigger (nowMs, eff = 0, stoneRate = 0) {
    const ev = this._sampleEvent(nowMs)
    if (!ev) return []
    this.es.dedupe[ev.id] = nowMs
    this.state.stats.eventCount = (this.state.stats.eventCount | 0) + 1

    // V4.7 主人（拍板「全自动激进」）：能不能被自动消化，改由 **自动策略 × 事件等级** 决定 ——
    //   稳健＝自动处理 凡/良（珍起亲断）｜均衡＝凡/良/珍（绝/仙亲断）｜激进＝凡~仙全自动
    //   超出范围的一律入簿置顶，等玩家亲自决断（事件簿按钮仍按策略给推荐）。
    if (!isAutoQuality(ev.quality, this.strategy)) {
      this.es.seq = (this.es.seq | 0) + 1
      this.es.pending.push({ uid: this.es.seq, eventId: ev.id, at: nowMs })
      return [{
        kind: 'hold',
        good: true,
        message: `【${ev.name}·${QUALITY_NAME[ev.quality]}级】超出「${STRATEGY_NAME[this.strategy]}」自动处置范围（自动档：${strategyAutoLabel(this.strategy)}），已记入事件簿，待你亲自抉择。`
      }]
    }
    const opt = this._pickAuto(ev, stoneRate)
    return [this._resolve(ev, opt, nowMs, eff, stoneRate, true)]
  }

  /** 自动策略选选项：按偏好序取首个"灵石付得起"的选项 */
  _pickAuto (ev, stoneRate) {
    const pref = STRATEGY_PREF[this.strategy] || STRATEGY_PREF.balanced
    for (const tag of pref) {
      const opt = ev.options.find((o) => o.strategy === tag)
      if (opt && this.isAffordable(ev, opt, stoneRate)) return opt
    }
    return ev.options[0]
  }

  /** 只按策略偏好取选项（不考虑支付能力；UI 推荐标用） */
  _preferredOption (ev) {
    const pref = STRATEGY_PREF[this.strategy] || STRATEGY_PREF.balanced
    for (const tag of pref) {
      const opt = ev.options.find((o) => o.strategy === tag)
      if (opt) return opt
    }
    return ev.options[0]
  }

  /** 最坏情况下该选项需要的灵石（h 当量；赌性选项按更亏一侧计） */
  _worstStoneCost (fx) {
    if (!fx || typeof fx !== 'object') return 0
    let cost = 0
    if (typeof fx.stonesH === 'number' && fx.stonesH < 0) cost += -fx.stonesH
    if (fx.gamble) cost += Math.max(this._worstStoneCost(fx.gamble.win), this._worstStoneCost(fx.gamble.lose))
    if (fx.bonus) cost = Math.max(cost, this._worstStoneCost(fx.bonus.effects))
    return cost
  }

  /** 选项是否付得起（负灵石效果需要现银） */
  isAffordable (ev, opt, stoneRate) {
    void ev
    return this.state.resources.stones >= this._worstStoneCost(opt.effects) * stoneRate - 1e-9
  }

  /**
   * 结算一个选项：应用效果 → 记近事录 → 返回统一结果对象。
   * @param {boolean} autoMode true=自动策略即时结算；false=玩家在事件簿手选
   */
  _resolve (ev, opt, nowMs, eff = 0, stoneRate = 0, autoMode) {
    const parts = []
    let netH = 0
    const state = this.state
    const es = this.es

    const apply = (fx) => {
      if (!fx || typeof fx !== 'object') return
      if (typeof fx.qiH === 'number' && fx.qiH !== 0) {
        const amt = Math.round(fx.qiH * eff * 3600)
        state.resources.qi = Math.max(0, state.resources.qi + amt)
        netH += fx.qiH
        parts.push(`灵气 ${amt >= 0 ? '+' : '−'}${fmtN(Math.abs(amt))}`)
      }
      if (typeof fx.stonesH === 'number' && fx.stonesH !== 0) {
        const amt = Math.round(fx.stonesH * stoneRate)
        state.resources.stones = Math.max(0, state.resources.stones + amt)
        netH += fx.stonesH
        parts.push(`灵石 ${amt >= 0 ? '+' : '−'}${fmtN(Math.abs(amt))}`)
      }
      if (typeof fx.luck === 'number' && fx.luck !== 0) {
        const before = this.luck
        this.state.player.luck = clamp(before + fx.luck, 0, 100)
        parts.push(`气运 ${fx.luck > 0 ? '+' : '−'}${Math.abs(fx.luck)}（${before}→${this.luck}）`)
      }
      if (typeof fx.fit === 'number' && fx.fit !== 0) {
        es.fitDelta += fx.fit
        parts.push(`契合 ${fx.fit > 0 ? '+' : '−'}${Math.abs(fx.fit)}（天机有感）`)
      }
      if (fx.buff && fx.buff.hours > 0) {
        const bid = `evtbuff_${ev.id}`
        const endsAt = nowMs + fx.buff.hours * 3600 * 1000
        const existing = state.buffs.find((b) => b.id === bid)
        if (existing) {
          existing.mods.qiRatePct = fx.buff.qiRatePct
          existing.endsAt = endsAt
        } else {
          state.buffs.push({
            id: bid,
            name: fx.buff.name,
            kind: 'buff',
            mods: { qiRatePct: fx.buff.qiRatePct },
            endsAt,
            source: { type: 'event', ref: ev.id }
          })
        }
        netH += fx.buff.qiRatePct * fx.buff.hours
        parts.push(`「${fx.buff.name}」产出 +${Math.round(fx.buff.qiRatePct * 100)}%×${fx.buff.hours}h`)
      }
      if (fx.repay) {
        es.repays.push({
          dueAt: nowMs + fx.repay.days * 86400 * 1000,
          qiH: fx.repay.qiH || 0,
          stonesH: fx.repay.stonesH || 0,
          label: fx.repay.label || '旧账兑现'
        })
        netH += (fx.repay.qiH || 0) + (fx.repay.stonesH || 0)
        parts.push(`${fx.repay.days} 日后兑现（${fx.repay.label}）`)
      }
      if (typeof fx.tribCdExtraSec === 'number' && fx.tribCdExtraSec !== 0) {
        es.tribCdExtraSec += fx.tribCdExtraSec
        parts.push(`下次渡劫调息 +${Math.round(fx.tribCdExtraSec / 3600)}h（2.5 消费）`)
      }
      if (fx.cause) {
        es.causes.push({ name: fx.cause.name, val: fx.cause.val, at: nowMs })
        if (es.causes.length > TRIGGER.causeCap) es.causes = es.causes.slice(-TRIGGER.causeCap)
        parts.push(`因果「${fx.cause.name}」${fx.cause.val >= 0 ? '结下' : '记下'}`)
      }
      if (fx.gamble) {
        const won = Math.random() < fx.gamble.p
        parts.push(won ? '赌胜' : '失手')
        apply(fx.gamble[won ? 'win' : 'lose'])
      }
      if (fx.bonus && Math.random() < fx.bonus.p) {
        parts.push('另有意外之喜')
        apply(fx.bonus.effects)
      }
    }

    apply(opt.effects)

    const text = parts.join('，') || '按兵不动，风平浪静'
    es.book.push({
      at: nowMs,
      name: ev.name,
      q: ev.quality,
      cat: ev.cat,
      opt: opt.label,
      text,
      good: netH >= 0,
      auto: autoMode
    })
    if (es.book.length > TRIGGER.bookCap) es.book = es.book.slice(-TRIGGER.bookCap)

    return {
      ok: true,
      kind: 'event',
      good: netH >= 0,
      auto: autoMode,
      message: `【${ev.name}·${QUALITY_NAME[ev.quality]}级】${opt.label} —— ${text}`
    }
  }

  /** 延迟兑现到期结算（现实时间；当前时点的产出/灵石时薪入账） */
  _settleRepays (nowMs, eff, stoneRate) {
    const es = this.es
    if (!es.repays.length) return []
    const due = es.repays.filter((r) => r.dueAt <= nowMs)
    if (!due.length) return []
    es.repays = es.repays.filter((r) => r.dueAt > nowMs)
    return due.map((r) => {
      const parts = []
      let netH = 0
      if (r.qiH) {
        const amt = Math.round(r.qiH * eff * 3600)
        this.state.resources.qi = Math.max(0, this.state.resources.qi + amt)
        netH += r.qiH
        parts.push(`灵气 +${fmtN(amt)}`)
      }
      if (r.stonesH) {
        const amt = Math.round(r.stonesH * stoneRate)
        this.state.resources.stones = Math.max(0, this.state.resources.stones + amt)
        netH += r.stonesH
        parts.push(`灵石 +${fmtN(amt)}`)
      }
      es.book.push({ at: nowMs, name: r.label, q: null, cat: 'enyuan', opt: '兑现', text: parts.join('，') || '如约而至', good: netH >= 0, auto: true })
      if (es.book.length > TRIGGER.bookCap) es.book = es.book.slice(-TRIGGER.bookCap)
      return { kind: 'repay', good: netH >= 0, message: `因果兑现·${r.label}：${parts.join('，') || '如约而至'}` }
    })
  }

  // ── 玩家手选（事件簿）──────────────────────────────────────────────────

  /**
   * 结算一条待抉择事件。
   * @returns {{ok:boolean, good?:boolean, message:string}}
   */
  resolvePending (uid, optionId, eff = 0, stoneRate = 0, nowMs = Date.now()) {
    const es = this.es
    const idx = es.pending.findIndex((p) => p.uid === uid)
    if (idx < 0) return { ok: false, message: '该事件已不在待抉择之列。' }
    const ev = getEvent(es.pending[idx].eventId)
    if (!ev) {
      es.pending.splice(idx, 1)
      return { ok: false, message: '事件定义缺失，已从事件簿移除。' }
    }
    const opt = ev.options.find((o) => o.id === optionId)
    if (!opt) return { ok: false, message: '没有这个选项。' }
    if (!this.isAffordable(ev, opt, stoneRate)) return { ok: false, message: '灵石不够支付这个选项，换一个吧。' }
    es.pending.splice(idx, 1)
    return this._resolve(ev, opt, nowMs, eff, stoneRate, false)
  }

  // ── 视图（事件簿 UI）───────────────────────────────────────────────────

  view () {
    const es = this.es
    const tier = this.luckTier
    return {
      luck: this.luck,
      tierId: tier.id,
      tierName: tier.name,
      goodPct: tier.goodPct,
      qualCoef: tier.qualCoef,
      freqCoef: tier.freqCoef,
      strategy: this.strategy,
      strategyName: STRATEGY_NAME[this.strategy],
      strategyAutoLabel: strategyAutoLabel(this.strategy),   // V4.7：该档能自动处置的等级（面板写明）
      pendingCount: es.pending.length,
      pending: es.pending.slice().reverse().map((p) => {
        const ev = getEvent(p.eventId)
        if (!ev) return { uid: p.uid, broken: true, name: '未知事件', options: [] }
        return {
          uid: p.uid,
          at: p.at,
          name: ev.name,
          desc: ev.desc,
          quality: ev.quality,
          qualityName: QUALITY_NAME[ev.quality],
          catName: CAT_NAME[ev.cat],
          signature: !!ev.signature,
          recommended: this._preferredOption(ev),
          options: ev.options.map((o) => ({
            id: o.id,
            label: o.label,
            strategy: o.strategy,
            hint: o.hint,
            nominal: Math.round(nominalH(o.effects) * 10) / 10,
            cost: this._worstStoneCost(o.effects)   // 需支付灵石（h 当量）；装配层按时薪折算判付得起
          }))
        }
      }),
      book: es.book.slice().reverse(),
      causes: es.causes.slice().reverse(),
      repays: es.repays.slice(),
      tribCdExtraSec: es.tribCdExtraSec,
      fitDelta: es.fitDelta,
      luckTiers: LUCK_TIERS
    }
  }
}

export default EventSystem
