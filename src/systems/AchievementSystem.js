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
 *   · 成就 94 个（境界18/秘境19/宗门12/灵兽10/事件因果12/探索收集13/隐藏10），5~50 点
 *   · 五档阶梯（凡/灵/玄/王/皇）按累计成就点发放称号 + 外观碎片 + 少量材料；称号纯展示
 *   · 纪事：三频道（本界/宗门/天下）+「你」频道；定时汇总一批，玩家里程碑即时插入
 *   · V4.7 主人 2026-09-18 重构：消息逐条带**等级**（凡/良/珍/绝/仙，与事件同源）＋
 *     **逐条专属选项**（选项写在模板里，不再按频道套壳）；命中且等级在自动策略范围内时
 *     由系统按策略偏好代选并落档，超范围的一条都不动、置顶等玩家决断
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
// V4.7：等级语言与自动策略与事件系统同源（data 层单一真源，系统之间不互相 import）
import {
  QUALITY_ORDER, QUALITY_NAME, QUALITY_COLOR, STRATEGY_PREF, isAutoQuality, strategyAutoLabel
} from '../data/events.js'

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
    // V4.7 主人 2026-09-19：把老档里"按频道套壳"的互动条目换挂回它自己的模板选项（零错配）
    this._migrateLegacyInteractions()
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
    return this._withInteract(t, at)
  }

  /** 提到「你」的条目（隐藏成就「无名之辈」的来源） */
  _makeMention (at) {
    const t = CHRONICLE_MENTIONS[Math.floor(Math.random() * CHRONICLE_MENTIONS.length)]
    this.note('mention')
    return this._withInteract(t, at)
  }

  /**
   * 挂上**该条模板自带的专属选项**（V4.7 主人 2026-09-18：逐条专属，根治"牛头不对马嘴"）
   *   · 概率：按频道 chance（本界 0.45 / 宗门 0.40 / 天下 0.50），每批至多 1 条（防刷屏）；
   *   · 等级：命中后若该条等级落在**自动策略的处置范围**内，就按策略偏好替玩家选定并落档；
   *     超范围（或选项一个都付不起）则留在原位、置顶等玩家亲自决断 —— 与事件同一套口径。
   */
  _withInteract (tpl, at) {
    const base = { ch: tpl.ch, text: tpl.text, note: tpl.note, q: tpl.q }
    const conf = CHRONICLE_INTERACT[tpl.ch]
    const choices = Array.isArray(tpl.choices) ? tpl.choices : []
    // 不互动就是一条普通消息（**照常入库**）；命中才多挂该条模板自己的专属选项
    const canPick = !!(conf && conf.chance > 0 && choices.length) &&
      !this._batchInteractUsed &&                              // 本批已有一条互动，不再叠加
      Math.random() < conf.chance
    if (!canPick) return this.push(base, at)
    this._batchInteractUsed = true
    const item = this.push(Object.assign({}, base, { options: choices, tid: tpl.id }), at)
    if (!isAutoQuality(tpl.q, this.strategy)) return item   // 超范围 → 置顶等玩家
    const opt = this._pickChoice(choices)
    if (!opt) return item                                   // 都付不起 → 留给玩家
    const res = this.resolveChronicle(item.uid, opt.id)
    if (res.ok) item.autoResolved = true                    // 自动处置：UI 标注一句
    return item
  }

  /** 当前自动策略（未落档/脏值 → 均衡；与 EventSystem 同一兜底口径） */
  get strategy () {
    const s = this.state.settings && this.state.settings.autoStrategy
    return STRATEGY_PREF[s] ? s : 'balanced'
  }

  /** 自动策略能自动处置到哪个等级（面板写明给玩家看） */
  get strategyAutoLabel () {
    return strategyAutoLabel(this.strategy)
  }

  /** 自动策略挑纪事选项：按偏好序取首个"现有资源付得起"的；都付不起返回 null（留给玩家） */
  _pickChoice (choices) {
    const pref = STRATEGY_PREF[this.strategy] || STRATEGY_PREF.balanced
    const afford = (o) => {
      const stones = (this.state.resources && this.state.resources.stones) | 0
      if ((o.costStones | 0) > 0 && stones < (o.costStones | 0)) return false
      const inv = (this.state.inventory && this.state.inventory.items) || {}
      for (const n of o.needItems || []) if ((inv[n.id] | 0) < n.n) return false
      return true
    }
    for (const tag of pref) {
      const opt = choices.find((o) => o.tag === tag && afford(o))
      if (opt) return opt
    }
    return choices.find((o) => afford(o)) || null
  }

  /** 选项打包（结果文案随条目落档：占位符在此一次性填充，选定后再显示） */
  _packOptions (options) {
    return options.map((o) => ({
      id: o.id,
      label: o.label,
      hint: o.hint || '',
      good: !!o.good,
      costStones: o.costStones | 0,
      needItems: (o.needItems || []).map((x) => ({ id: x.id, n: x.n | 0 })),
      stones: o.stones | 0,
      items: (o.items || []).map((x) => ({ id: x.id, n: x.n | 0 })),
      result: this._fill(o.result || '')
    }))
  }

  /**
   * 老档一次性迁移（V4.7 主人 2026-09-19：「你目前的消息互动还是牛头不对马嘴」）
   *   病根不在新逻辑，而在**存档里旧条目的旧选项**：那批条目是"按频道整组套壳"时代生成的，
   *   选项（如「出手相帮 / 事不关己」）连同正文一起落了档，重启后照旧显示 —— 所以看着仍错配。
   * 处置：按**正文**匹配回它自己那条模板 → 换挂该模板的专属选项（零错配）；
   *   匹配不上的（文案后来改过）→ 摘掉选项、降级为普通旧闻，绝不硬配；
   *   换挂后再照新口径过一遍自动策略：落在自动档内的直接由系统代选并落档。
   * 幂等：带 tid 的条目（新生成的）直接跳过。
   * @returns {number} 被处置的条目数
   */
  _migrateLegacyInteractions () {
    const a = this.s
    const all = CHRONICLE_TEMPLATES.concat(CHRONICLE_MENTIONS)
    let changed = 0
    for (const e of a.chronicle) {
      if (!Array.isArray(e.options) || !e.options.length) continue
      if (e.tid) continue
      const tpl = all.find((t) => this._templateMatches(t.text, e.text))
      if (!tpl) {
        // 认不出是哪条模板 → 只留正文（旧闻），不再挂任何选项
        e.options = []
        e.resolved = null
        e.result = ''
        changed++
        continue
      }
      e.tid = tpl.id
      e.q = tpl.q
      e.options = this._packOptions(tpl.choices)
      e.resolved = null
      e.result = ''
      changed++
      if (!isAutoQuality(tpl.q, this.strategy)) continue   // 超出自动档 → 留给你决断
      const opt = this._pickChoice(tpl.choices)
      if (!opt) continue
      const r = this.resolveChronicle(e.uid, opt.id)
      if (r.ok) e.autoResolved = true
    }
    return changed
  }

  /** 模板正文 → 同源条目正则（占位符按"任意非空"通吃；编译结果缓存，迁移只在启动时跑一遍） */
  _templateMatches (tplText, text) {
    if (!this._tplRes) this._tplRes = new Map()
    let re = this._tplRes.get(tplText)
    if (!re) {
      const src = String(tplText)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')      // 先转义字面量
        .replace(/\\\{(\w+)\\}/g, '[\\s\\S]+?')       // 占位符 → 通吃（正文已被填充过）
      re = new RegExp('^' + src + '$')
      this._tplRes.set(tplText, re)
    }
    return re.test(String(text || ''))
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
      // V4.7：消息也带等级（凡/良/珍/绝/仙），与事件同一套语言；脏值兜底为凡
      q: QUALITY_ORDER.includes(entry.q) ? entry.q : 'fan',
      text: this._fill(entry.text || ''),
      note: entry.note ? this._fill(entry.note) : ''
    }
    if (Array.isArray(entry.options) && entry.options.length) {
      a.chronicleSeq = (a.chronicleSeq | 0) + 1
      item.uid = a.chronicleSeq
      item.eventId = entry.eventId || ''
      item.tid = entry.tid || ''          // V4.7：记住出自哪条模板（老档迁移与自查都靠它）
      item.options = this._packOptions(entry.options)
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
      // V4.7：等级（缺省凡）＋等级名/色，UI 按等级着色与置顶
      q: QUALITY_ORDER.includes(e.q) ? e.q : 'fan',
      qName: QUALITY_NAME[QUALITY_ORDER.includes(e.q) ? e.q : 'fan'] || '凡',
      qColor: QUALITY_COLOR[QUALITY_ORDER.includes(e.q) ? e.q : 'fan'] || '',
      text: e.text,
      note: e.note,
      interactive: !!(Array.isArray(e.options) && e.options.length),
      options: Array.isArray(e.options) ? e.options : [],
      resolved: e.resolved || null,
      result: e.result || '',
      auto: !!e.autoResolved,          // 自动策略替你定的（UI 会标一句）
      pending: !!(Array.isArray(e.options) && e.options.length && !e.resolved)   // 待决断 → 置顶
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
