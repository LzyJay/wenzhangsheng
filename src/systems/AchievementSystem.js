/**
 * AchievementSystem.js —— 成就与纪事系统（纯逻辑层）（2.10）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM、禁止 import 其他 System。
 * 数据源：src/data/achievements.js（成就表 / 阶梯 / 纪事频道与模板）
 *
 * 存档子树：state.achievements（null＝老档；懒建兜底，字段缺失自动补）
 * 跨模块接线（13.1②，全部经装配层 main.js 中转）：
 *   · 判定所需的"他模块数值"一律由 main.js 现算成 metrics 快照传入 evaluate(metrics)
 *     ——本系统不读 state.sect / state.beast / state.dungeonState / state.inventory 等别人的子树
 *   · 奖励发放（灵石 / 物品）不自己写别人子树，走构造注入的 grant 回调（装配层接线）
 *   · 事件驱动计数（渡劫结果 / 因果兑现 / 善恶事件）由 main.js 调 note(kind)
 *
 * 口径（设计库《世界纪事与成就系统 v1》）：
 *   · 成就 90 个（境界18/秘境15/宗门12/灵兽10/事件因果12/探索收集13/隐藏10），5~50 点
 *   · 五档阶梯（凡/灵/玄/王/皇）按累计成就点发放称号 + 外观碎片 + 少量材料；称号纯展示
 *   · 纪事：三频道（本界/宗门/天下）+「你」频道；定时汇总一批，玩家里程碑即时插入
 *   · 隐藏成就未解锁只显示「???」与 hint，不剧透条件
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  ACHIEVEMENTS, ACHV_CATS, ACHV_TIERS, getAchievement,
  CHRONICLE, CHRONICLE_CHANNELS, CHRONICLE_TEMPLATES, CHRONICLE_MENTIONS,
  CHRONICLE_NAMES, CHRONICLE_PLACES, CHRONICLE_BEASTS, CHRONICLE_SECT_TITLES,
  CHRONICLE_INTERACT, shichenOf
} from '../data/achievements.js'
import { REALM_META } from '../data/realms.js'
import { SECT } from '../data/sect.js'
import { getItem } from '../data/items.js'

const DAY_MS = 24 * 3600 * 1000

class AchievementSystem {
  /**
   * @param {object} state 存档状态树
   * @param {object} opts  { grant?: (payload:{stones:number, items:[{id,n}]}) => void }
   *                       ——由装配层注入：奖励落到 resources / inventory 的唯一下游
   */
  constructor (state, opts = {}) {
    this.state = state
    this.grant = typeof opts.grant === 'function' ? opts.grant : null
  }

  // ── 存档子树（懒建：老档 achievements 缺失/null 时补结构）──────────────
  get s () {
    const st = this.state
    if (!st.achievements || typeof st.achievements !== 'object') st.achievements = {}
    const a = st.achievements
    if (!a.unlocked || typeof a.unlocked !== 'object') a.unlocked = {}
    if (!a.counters || typeof a.counters !== 'object') a.counters = {}
    if (!Array.isArray(a.titles)) a.titles = []
    if (!Array.isArray(a.chronicle)) a.chronicle = []
    if (!('equipped' in a)) a.equipped = null
    if (typeof a.tier !== 'number') a.tier = -1
    if (typeof a.nextBatchAt !== 'number') a.nextBatchAt = 0
    if (typeof a.seenAt !== 'number') a.seenAt = 0
    if (typeof a.lastTrial !== 'string') a.lastTrial = ''
    if (typeof a.nightDay !== 'string') a.nightDay = ''
    if (typeof a.chronicleSeq !== 'number') a.chronicleSeq = 0
    return a
  }

  /** 老档补字段 / 新档播种（启动时由装配层调一次；幂等） */
  ensure (now = Date.now()) {
    const a = this.s
    if (!a.chronicle.length) this.seed(now)
    if (!a.nextBatchAt) a.nextBatchAt = now + CHRONICLE.batchMs
    // 凡档（need 0）人人有份：称号「初入道途」在建档时即入袋
    this._checkTier(now)
    return a
  }

  // ── 点数与阶梯 ─────────────────────────────────────────────────────────

  /** 累计成就点（唯一真源＝已解锁表；不冗余存，避免两处打架） */
  get points () {
    const u = this.s.unlocked
    let p = 0
    for (const id of Object.keys(u)) {
      const def = getAchievement(id)
      if (def) p += def.points | 0
    }
    return p
  }

  get unlockedCount () {
    return Object.keys(this.s.unlocked).length
  }

  get tierIndex () {
    const p = this.points
    let idx = 0
    for (const t of ACHV_TIERS) if (p >= t.need) idx = t.idx
    return idx
  }

  get tier () {
    return ACHV_TIERS[this.tierIndex]
  }

  get nextTier () {
    return ACHV_TIERS[this.tierIndex + 1] || null
  }

  /** 已获称号（成就称号 + 阶梯称号） */
  get titles () {
    return this.s.titles.slice()
  }

  get equippedTitle () {
    const a = this.s
    if (!a.equipped) return null
    return a.titles.find((t) => t.id === a.equipped) || null
  }

  /** 佩戴称号（同时只可佩戴 1 个；纯展示，不涉任何数值） */
  equipTitle (id) {
    const a = this.s
    if (!id) return { ok: false, message: '未指定称号。' }
    const t = a.titles.find((x) => x.id === id)
    if (!t) return { ok: false, message: '你还没有这个称号。' }
    a.equipped = id
    return { ok: true, title: t, message: `已佩戴称号「${t.name}」（纯展示，不涉数值）。` }
  }

  clearTitle () {
    const a = this.s
    if (!a.equipped) return { ok: false, message: '当前并未佩戴称号。' }
    a.equipped = null
    return { ok: true, message: '已摘下称号。' }
  }

  // ── 判定 ──────────────────────────────────────────────────────────────

  /**
   * 批量判定：metric 达到 need 即解锁（>=）
   * @param {object} metrics 装配层现算的快照（含 counters 覆盖不到的累计量）
   * @returns {{unlocked:Array, tierUps:Array, points:number, tierIndex:number, tier:object}}
   */
  evaluate (metrics = {}, now = Date.now()) {
    const a = this.s
    const m = Object.assign({}, a.counters, metrics)

    // 夜半打坐（子时 23:00–01:00）：按日去重，一天只记一次
    const hour = Number(m.hour)
    if ((hour === 23 || hour === 0) && m.dayKey && a.nightDay !== m.dayKey) {
      a.nightDay = m.dayKey
      a.counters.nightSessions = (a.counters.nightSessions | 0) + 1
      m.nightSessions = a.counters.nightSessions
    }

    const unlocked = []
    for (const def of ACHIEVEMENTS) {
      if (a.unlocked[def.id]) continue
      m.unlockedCount = Object.keys(a.unlocked).length
      m.titlesOwned = a.titles.length
      m.chronicleCount = a.chronicle.length
      const v = Number(m[def.metric])
      if (Number.isFinite(v) && v >= def.need) unlocked.push(this._unlock(def, now))
    }
    const tierUps = this._checkTier(now)
    return { unlocked, tierUps, points: this.points, tierIndex: this.tierIndex, tier: this.tier }
  }

  _unlock (def, now = Date.now()) {
    const a = this.s
    a.unlocked[def.id] = now
    const out = { id: def.id, name: def.name, cat: def.cat, points: def.points, title: null, reward: null, chronicle: null }
    if (def.title) {
      const t = { id: `title_${def.id}`, name: def.title, from: def.name }
      a.titles.push(t)
      out.title = t
    }
    if (def.reward) out.reward = this._grant(def.reward)
    if (def.chronicle) out.chronicle = this.push({ ch: 'you', text: def.chronicle }, now)
    return out
  }

  _grant (reward) {
    const payload = {
      stones: reward.stones | 0,
      items: (reward.items || []).map((i) => ({ id: i.id, n: i.n | 0 }))
    }
    if (this.grant) this.grant(payload)
    return payload
  }

  /** 阶梯升档发奖（称号 + 外观碎片 + 少量材料），幂等：只发没发过的档 */
  _checkTier (now = Date.now()) {
    void now
    const a = this.s
    const target = this.tierIndex
    const ups = []
    while (a.tier < target) {
      a.tier += 1
      const t = ACHV_TIERS[a.tier]
      const title = { id: `tier_${t.id}`, name: t.title, from: `${t.name}阶 · 成就点 ${t.need}` }
      if (!a.titles.some((x) => x.id === title.id)) a.titles.push(title)
      const payload = { stones: 0, items: t.mats.map((m) => ({ id: m.id, n: m.n })) }
      if (t.shards > 0) payload.items.unshift({ id: 'frag_waiguan', n: t.shards })
      if (payload.items.length && this.grant) this.grant(payload)
      ups.push({ tier: t, title, reward: payload })
    }
    return ups
  }

  // ── 事件驱动计数（由装配层调用）─────────────────────────────────────────

  /**
   * 记一笔计数（渡劫结果 / 因果兑现 / 善恶事件 / 任务交差 …）
   * trialPass / trialFail 顺带维护连胜（trialStreak）与「败而后勇」（failThenPass）
   */
  note (kind, n = 1) {
    const a = this.s
    const c = a.counters
    c[kind] = (c[kind] | 0) + (n | 0)
    if (kind === 'trialPass') {
      if (a.lastTrial === 'fail') c.failThenPass = (c.failThenPass | 0) + 1
      a.lastTrial = 'pass'
      c.trialStreak = (c.trialStreak | 0) + 1
    } else if (kind === 'trialFail') {
      a.lastTrial = 'fail'
      c.trialStreak = 0
    }
    return c[kind]
  }

  counter (kind) {
    return this.s.counters[kind] | 0
  }

  // ── 纪事 ──────────────────────────────────────────────────────────────

  /** 新档播种：先铺一段"昨日旧闻"，面板不至空 */
  seed (now = Date.now()) {
    const n = Math.max(1, CHRONICLE.seedCount | 0)
    const step = Math.round((CHRONICLE.seedSpreadMs || DAY_MS) / n)
    for (let i = 0; i < n; i++) this._makeEntry(now - (n - i) * step)
    this.s.seenAt = now
  }

  /** 定时汇总：到点就生成一批（返回本次新增条目） */
  tick (now = Date.now()) {
    const a = this.s
    if (!a.nextBatchAt) { a.nextBatchAt = now + CHRONICLE.batchMs; return [] }
    if (now < a.nextBatchAt) return []
    const out = this._batch(now)
    a.nextBatchAt = now + CHRONICLE.batchMs
    return out
  }

  /** 距下一批的毫秒（UI 倒计时用） */
  nextBatchIn (now = Date.now()) {
    const a = this.s
    return Math.max(0, (a.nextBatchAt || now) - now)
  }

  _batch (now) {
    const lo = CHRONICLE.perBatch[0]
    const hi = CHRONICLE.perBatch[1]
    const n = lo + Math.floor(Math.random() * (hi - lo + 1))
    const out = []
    this._batchInteractUsed = false   // 每批至多 1 条互动（V3.2.2：防止整批都是"待抉择"刷屏）
    for (let i = 0; i < n; i++) {
      const at = now - (n - 1 - i) * 1000
      out.push(Math.random() < CHRONICLE.mentionChance ? this._makeMention(at) : this._makeEntry(at))
    }
    return out
  }

  _makeEntry (at) {
    const t = CHRONICLE_TEMPLATES[Math.floor(Math.random() * CHRONICLE_TEMPLATES.length)]
    return this.push(this._withInteract(t.ch, t), at)
  }

  /** 提到「你」的条目（隐藏成就「无名之辈」的来源） */
  _makeMention (at) {
    const t = CHRONICLE_MENTIONS[Math.floor(Math.random() * CHRONICLE_MENTIONS.length)]
    this.note('mention')
    return this.push(this._withInteract(t.ch, t), at)
  }

  /**
   * 按频道概率决定这条消息是否"可择"（主人 2026-09-18：所有类型都可能互动，但只按概率出现）
   * 命中则挂上一组该频道的通用选项；未命中就是一条普通新闻。
   */
  _withInteract (ch, base) {
    const conf = CHRONICLE_INTERACT[ch]
    if (!conf || !(conf.chance > 0) || !Array.isArray(conf.sets) || !conf.sets.length) return base
    if (this._batchInteractUsed) return base            // 本批已有一条互动，不再叠加
    if (Math.random() >= conf.chance) return base
    this._batchInteractUsed = true
    const set = conf.sets[Math.floor(Math.random() * conf.sets.length)]
    return { ch: base.ch, text: base.text, note: base.note, options: set.options }
  }

  /** 各频道互动概率（面板要把概率写明给玩家看） */
  get interactChances () {
    return CHRONICLE_CHANNELS.map((c) => ({
      id: c.id,
      name: c.name,
      chance: (CHRONICLE_INTERACT[c.id] || {}).chance || 0
    }))
  }

  /** 插入一条纪事（玩家里程碑走这里，即时推送；带 options 即互动纪事） */
  push (entry, now = Date.now()) {
    const a = this.s
    const ch = CHRONICLE_CHANNELS.some((c) => c.id === entry.ch) ? entry.ch : 'realm'
    const item = {
      at: now,
      ch,
      text: this._fill(entry.text || ''),
      note: entry.note ? this._fill(entry.note) : ''
    }
    if (Array.isArray(entry.options) && entry.options.length) {
      a.chronicleSeq = (a.chronicleSeq | 0) + 1
      item.uid = a.chronicleSeq
      item.eventId = entry.eventId || ''
      item.options = entry.options.map((o) => ({
        id: o.id,
        label: o.label,
        hint: o.hint || '',
        good: !!o.good,
        costStones: o.costStones | 0,
        needItems: (o.needItems || []).map((x) => ({ id: x.id, n: x.n | 0 })),
        stones: o.stones | 0,
        items: (o.items || []).map((x) => ({ id: x.id, n: x.n | 0 })),
        // 结果文案要随条目落档：选定后再显示（占位符在此一次性填充）
        result: this._fill(o.result || '')
      }))
      item.resolved = null
      item.result = ''
    }
    a.chronicle.push(item)
    this._trim()
    return item
  }

  /**
   * 抉择一条互动纪事（一个选项只可择一次）
   * @param {number} uid 条目 uid
   * @param {string} optId 选项 id
   * @returns {{ok:boolean, message:string, good?:boolean, reward?:object, cost?:number}}
   */
  resolveChronicle (uid, optId) {
    const a = this.s
    const entry = a.chronicle.find((e) => e.uid === (uid | 0))
    if (!entry || !Array.isArray(entry.options)) return { ok: false, message: '这条纪事已翻过页了。' }
    if (entry.resolved) return { ok: false, message: '此事你已经表过态了。' }
    const opt = entry.options.find((o) => o.id === optId)
    if (!opt) return { ok: false, message: '没有这个选项。' }

    const stones = this.state.resources.stones | 0
    if (opt.costStones > 0 && stones < opt.costStones) {
      return { ok: false, message: `灵石不足：此举需 ${opt.costStones}，现有 ${stones}。` }
    }
    const inv = (this.state.inventory && this.state.inventory.items) || {}
    for (const need of opt.needItems || []) {
      if ((inv[need.id] | 0) < need.n) {
        return { ok: false, message: `所备不足：需${getItem(need.id).name} ×${need.n}。` }
      }
    }

    if (opt.costStones > 0) this.state.resources.stones = stones - opt.costStones
    for (const need of opt.needItems || []) inv[need.id] = (inv[need.id] | 0) - need.n

    const payload = { stones: opt.stones | 0, items: (opt.items || []).map((i) => ({ id: i.id, n: i.n | 0 })) }
    if ((payload.stones > 0 || payload.items.length) && this.grant) this.grant(payload)

    entry.resolved = opt.id
    entry.result = opt.result
    return { ok: true, good: opt.good, reward: payload, cost: opt.costStones | 0, message: opt.result }
  }

  _trim () {
    const a = this.s
    if (a.chronicle.length > CHRONICLE.archiveMax) {
      a.chronicle.splice(0, a.chronicle.length - CHRONICLE.archiveMax)
    }
  }

  // ── 文案填充（占位符 → 词池）─────────────────────────────────────────────

  _pick (pool, used) {
    let v = pool[Math.floor(Math.random() * pool.length)]
    for (let i = 0; i < 6 && used && used.has(v); i++) v = pool[Math.floor(Math.random() * pool.length)]
    if (used) used.add(v)
    return v
  }

  _fill (text) {
    const used = new Set()
    const map = {
      name: () => this._pick(CHRONICLE_NAMES, used),
      name2: () => this._pick(CHRONICLE_NAMES, used),
      place: () => this._pick(CHRONICLE_PLACES, used),
      place2: () => this._pick(CHRONICLE_PLACES, used),
      beast: () => this._pick(CHRONICLE_BEASTS, used),
      title: () => this._pick(CHRONICLE_SECT_TITLES, used),
      realm: () => REALM_META[Math.floor(Math.random() * REALM_META.length)].name,
      sect: () => SECT.name,
      you: () => (this.state.player && this.state.player.name) || '无名散修',
      n: () => String(3 + Math.floor(Math.random() * 9)),
      years: () => String((3 + Math.floor(Math.random() * 9)) * 100)
    }
    return String(text).replace(/\{(\w+)\}/g, (all, k) => (map[k] ? map[k]() : all))
  }

  // ── 视图 ──────────────────────────────────────────────────────────────

  /** 纪事列表（新→旧）；ch='all' 不过滤 */
  chronicleView (ch = 'all', limit = 80) {
    const a = this.s
    const list = a.chronicle.filter((e) => ch === 'all' || e.ch === ch)
    return list.slice(-limit).reverse().map((e) => ({
      at: e.at,
      uid: e.uid | 0,
      ch: e.ch,
      chName: (CHRONICLE_CHANNELS.find((c) => c.id === e.ch) || {}).name || e.ch,
      shichen: shichenOf(e.at),
      text: e.text,
      note: e.note,
      interactive: !!(Array.isArray(e.options) && e.options.length),
      options: Array.isArray(e.options) ? e.options : [],
      resolved: e.resolved || null,
      result: e.result || ''
    }))
  }

  /** 待抉择的互动纪事条数（纪事按钮角标用） */
  get openInteractionCount () {
    return this.s.chronicle.filter((e) => Array.isArray(e.options) && e.options.length && !e.resolved).length
  }

  get chronicleCount () {
    return this.s.chronicle.length
  }

  /** 未读条数（面板打开即 markSeen） */
  get unreadCount () {
    const a = this.s
    return a.chronicle.filter((e) => e.at > (a.seenAt || 0)).length
  }

  markSeen (now = Date.now()) {
    this.s.seenAt = now
  }

  /**
   * 成就墙视图（装配层把 metrics 快照传进来才能算进度）
   */
  view (metrics = {}) {
    const a = this.s
    const m = Object.assign({}, a.counters, metrics)
    const points = this.points
    const tier = this.tier
    const next = this.nextTier
    return {
      points,
      tier,
      nextTier: next,
      tierProgress: next ? { cur: points - tier.need, need: next.need - tier.need } : { cur: 0, need: 0 },
      total: ACHIEVEMENTS.length,
      unlockedCount: this.unlockedCount,
      titles: a.titles.slice(),
      equipped: this.equippedTitle,
      unread: this.unreadCount,
      nextBatchIn: this.nextBatchIn(Date.now()),
      chronicleCount: this.chronicleCount,
      cats: ACHV_CATS.map((c) => {
        const list = ACHIEVEMENTS.filter((x) => x.cat === c.id).map((x) => {
          const got = !!a.unlocked[x.id]
          const cur = Number(m[x.metric])
          const masked = c.id === 'hidden' && !got
          return {
            id: x.id,
            name: masked ? '???' : x.name,
            desc: masked ? (x.hint || '？？？') : x.desc,
            hint: x.hint || '',
            points: x.points,
            got,
            at: a.unlocked[x.id] || 0,
            hidden: c.id === 'hidden',
            progress: { cur: Number.isFinite(cur) ? Math.max(0, Math.min(cur, x.need)) : 0, need: x.need }
          }
        })
        return { id: c.id, name: c.name, total: list.length, got: list.filter((x) => x.got).length, list }
      })
    }
  }
}

export default AchievementSystem
