/**
 * BeastSystem.js —— 灵兽系统（纯逻辑层）（2.8）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/beasts.js（品级 · 万兽林 · 孵化 · 喂养 · 产出 · 种类池）
 *
 * 口径（设计库《灵兽兽潮与大比 v1》§1.1~§1.4 + 开发计划 §四 2.8）：
 *   · 万兽林派遣（寻蛋）：金丹解锁，每轮 1 次 × 1h（一轮 = 30 游戏天 ≈ 现实 2 小时），
 *     产蛋一枚（品级 70/22/7/1）；autoTick 支持自动派遣 + 自动收蛋（主人 2026-09-18）
 *   · 孵化：V4.7 主人起 **2 个孵化位**（金丹解锁第 2 位），时长按品级 4/6/8/12h；妖丹 −1h/枚 加速；
 *     autoHatchTick 支持自动入孵 + 自动破壳（主人 2026-09-19，档位 settings.autoHatch）
 *   · 灵兽园 6 格；孵出即入园林；首只自动当主战（MVP 验收口径「孵出并生效加成」）
 *   · 出战编队（V4.7 主人）：**主战 1 只 + 辅助（元婴 1 / 合体 2）**——
 *     被动产出 0.2h/日 × 品级 × 等级 × 星级（上限 0.6h × 星级）随在线秒入账（离线不发）；
 *     战力：主战全额、辅助按 50%（品级 +4%/皇品 +8%，每星另 +0.5 个百分点）；
 *     渡劫助战：主战 +7%、辅助各 +3.5%，合计受 TRIAL_BEAST.cap 封顶
 *     （经装配层供 CultivationSystem 报价，本系统不读别人子树）
 *   · 升星（V4.7 主人）：同品级同种 2 合 1 → 星级 +1（上限 5 星）
 *   · 分解 / 杀鸡取卵（V4.7 主人）：返还妖丹（按品级）+ 灵石（按品级基准 × 等级系数）；随行中不可分解
 *   · 喂养：妖丹 → 升 1 级（1~9 级），每级 +10%；8% 悟性爆发本次连升 2 级
 *   · 血脉觉醒 / 化形 / 灵兽园扩容 / 代采 / 兽潮 ＝ 内容批次 2/3，不在本模块
 *
 * 存档子树：state.beast（null＝尚无灵兽资产；懒建兜底，老档自动补全）
 * 跨模块接线（13.1②，均由 main.js 中转）：
 *   · CultivationSystem 注入本实例 → 只调 activePet / TRIAL_BEAST 报价，不写 state.beast
 *   · SectSystem 注入 powerMul 闭包 → 战力任务定标/判定吃到灵兽战力加成
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GRADES, WANSHOU, HATCH, STAR, DECOMPOSE, ASSIST, FEED, GROWTH, OUTPUT, PARK_CAP, TRIAL_BEAST, dayKey, getGrade, getSpecies, rollGrade, speciesOfGrade } from '../data/beasts.js'
import { getLevelInfo } from '../data/realms.js'
import { getItem } from '../data/items.js'
// 游戏历（主人 2026-09-17）：剩余时长一律用游戏历文案，不再报现实时分
import { fmtGameDuration, fmtRefreshPeriod } from '../data/gametime.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const HOUR_MS = 3600 * 1000
/** 自动孵化"园满停手"的提示节流（10 分钟一次，免得每拍刷屏） */
const AUTO_HATCH_FULL_NOTE_MS = 10 * 60 * 1000

class BeastSystem {
  constructor (state) {
    this.state = state
  }

  // ── 存档子树（懒建：老档 beast 为 null 时补全结构）────────────────────────
  get s () {
    if (!this.state.beast || typeof this.state.beast !== 'object') {
      this.state.beast = {
        seq: 0,                 // uid 自增器（蛋与灵兽共用）
        eggs: [],               // [{ uid, grade, startAt }]  startAt>0 ＝ 孵化中
        pets: [],               // [{ uid, grade, speciesId, level, star }]  star 缺省＝1（V4.7）
        activeUid: null,        // **主战**灵兽
        assistUids: [],         // V4.7 辅助位名单（随境界解锁，见 ASSIST.slotsByRealm）
        lastDispatchDay: null,  // 万兽林派遣的轮次 key（30 游戏天 ≈ 现实 2 小时）
        dispatchStartAt: 0      // 派遣中起点；0 ＝ 空闲
      }
    }
    return this.state.beast
  }

  /**
   * 老档补字段（V4.7；装配层 boot 时调一次，幂等）
   *   补：`assistUids`（辅助位名单，顺带清掉已失效 uid）、`pets[].star`（缺省 1 星）、
   *   `pets[].exp / gf`（V3.5.1 自动成长的计数叶子）。
   */
  ensure () {
    const b = this.s
    if (!Array.isArray(b.assistUids)) b.assistUids = []
    b.assistUids = b.assistUids.filter((u) => b.pets.some((p) => p && p.uid === u))
    for (const p of b.pets) {
      if (!(p.star >= 1)) p.star = 1
      if (p.exp == null) p.exp = 0
      if (p.gf == null) p.gf = 0
    }
    return b
  }

  // ── 基础查询 ─────────────────────────────────────────────────────────────

  /** 金丹期（realmIndex ≥ 2）解锁万兽林 */
  get unlocked () {
    return this.realmIndex >= WANSHOU.unlockRealmIndex
  }

  /** 出战灵兽（未设出战/uid 失效 → null，即无任何随行加成；跨模块只读报价用） */
  get activePet () {
    return this.s.pets.find((p) => p.uid === this.s.activeUid) || null
  }

  /** 灵兽园是否还有空位（蛋占位：孵化中也算，避免孵出时爆园） */
  get parkFull () {
    return this.s.pets.length + this.s.eggs.filter((e) => e.startAt > 0).length >= PARK_CAP
  }

  gradeMeta (petOrEgg) {
    return getGrade(petOrEgg && petOrEgg.grade)
  }

  /** 等级系数：1 + 0.1 × (level − 1)（设计库 §1.3 每级 +10% 全属性） */
  levelCoef (level) {
    return 1 + FEED.levelPct * (clamp(level | 0, 1, FEED.maxLevel) - 1)
  }

  // ── 出战编队：主战 + 辅助（V4.7 主人 2026-09-18）──────────────────────────

  /** 当前大境界序（炼气 0 起，每 9 重一境；与 unlocked 同口径） */
  get realmIndex () {
    return Math.floor((this.state.player.realm.level - 1) / 9)
  }

  /** 辅助位数量（元婴 1 / 合体 2；未解锁 0） */
  assistSlots () {
    let slots = 0
    for (const s of ASSIST.slotsByRealm) if (this.realmIndex >= s.from) slots = s.slots
    return slots
  }

  /** 辅助中的灵兽（名单在档；失效 uid 自动跳过） */
  get assistPets () {
    const list = Array.isArray(this.s.assistUids) ? this.s.assistUids : []
    return list.map((u) => this.s.pets.find((p) => p && p.uid === u)).filter(Boolean)
  }

  /**
   * 出战编队：主战（mul＝1）+ 辅助（mul＝ASSIST.mul）
   * @returns {Array<{pet:object, role:'main'|'assist', mul:number}>}
   */
  squad () {
    const out = []
    const main = this.activePet
    if (main) out.push({ pet: main, role: 'main', mul: 1 })
    for (const p of this.assistPets) {
      if (main && p.uid === main.uid) continue      // 主战不进辅助列
      out.push({ pet: p, role: 'assist', mul: ASSIST.mul })
    }
    return out
  }

  // ── 星级（V4.7 主人：相同灵兽用于升星）────────────────────────────────────

  /** 星级（1~STAR.maxStar；老档缺省 1） */
  starOf (pet) {
    return clamp((pet && pet.star) | 0 || 1, 1, STAR.maxStar)
  }

  /** 星级系数：1 + 0.10 × (star − 1)；1 星＝1.00（与旧档逐位相同） */
  starCoef (pet) {
    return 1 + STAR.outputPctPerStar * (this.starOf(pet) - 1)
  }

  /** 单只被动产出时数：0.2h/日 × 品级 × 等级 × **星级**，上限 0.6h/只 × 星级 */
  petOutputHours (pet) {
    const g = getGrade(pet && pet.grade)
    const k = this.starCoef(pet)
    return clamp(OUTPUT.baseHours * g.coef * this.levelCoef(pet && pet.level) * k, 0, OUTPUT.capHours * k)
  }

  /** 单只战力加成：品级基准（+4%，皇品 +8%）+ 每星 +0.5 个百分点 */
  petPowerPct (pet) {
    const g = getGrade(pet && pet.grade)
    return g.powerPct + STAR.powerPctPerStar * (this.starOf(pet) - 1)
  }

  // ── 万兽林派遣（寻蛋）────────────────────────────────────────────────────

  /**
   * 派遣寻蛋（每日 1 次 × 1h）
   * @returns {{ok:boolean, message:string}}
   */
  dispatch (now = Date.now()) {
    if (!this.unlocked) {
      const name = getLevelInfo(WANSHOU.unlockRealmIndex * 9 + 1).displayName
      return { ok: false, message: `万兽林凶险，${name}以上方可入林寻蛋。` }
    }
    if (this.s.dispatchStartAt > 0) {
      const left = this.dispatchProgress(now)
      if (!left.done) return { ok: false, message: `灵鹰已在林中搜寻，还差约 ${left.leftText}。` }
      return { ok: false, message: '林中已有收获，先去领蛋。' }
    }
    if (this.s.lastDispatchDay === dayKey(now)) {
      return { ok: false, message: `本轮已派遣过（每轮 1 次 · ${fmtRefreshPeriod()}一轮，下一轮再来）。` }
    }
    this.s.lastDispatchDay = dayKey(now)
    this.s.dispatchStartAt = now
    return { ok: true, message: `灵鹰携香饵入万兽林，寻一枚灵兽蛋回来（约 ${fmtGameDuration(WANSHOU.hours * HOUR_MS)}，游戏历）。` }
  }

  /** 派遣进度（running 才有） */
  dispatchProgress (now = Date.now()) {
    if (!(this.s.dispatchStartAt > 0)) return { running: false, done: false, elapsedMs: 0, totalMs: 0, leftText: '' }
    const totalMs = WANSHOU.hours * HOUR_MS
    const elapsedMs = Math.max(0, now - this.s.dispatchStartAt)
    return {
      running: true,
      done: elapsedMs >= totalMs,
      elapsedMs,
      totalMs,
      // 游戏历（主人 2026-09-17）：剩余时长不再报现实时分
      leftText: fmtGameDuration(totalMs - elapsedMs)
    }
  }

  /** 领蛋：满 1h 后按 70/22/7/1 roll 品级入笼（不进背包，灵兽面板内管理） */
  collectDispatch (now = Date.now()) {
    if (!(this.s.dispatchStartAt > 0)) return { ok: false, message: '并未派遣灵鹰入林。' }
    const prog = this.dispatchProgress(now)
    if (!prog.done) return { ok: false, message: `灵鹰尚未归巢，还差约 ${prog.leftText}。` }
    const grade = rollGrade()
    const uid = ++this.s.seq
    this.s.eggs.push({ uid, grade, startAt: 0 })
    this.s.dispatchStartAt = 0
    const g = getGrade(grade)
    return {
      ok: true,
      grade,
      message: `灵鹰归巢，带回一枚${g.name}灵兽蛋${grade === 'huang' ? ' —— 万中无一！' : '。'}`
    }
  }

  // ── 孵化 ─────────────────────────────────────────────────────────────────

  hatchHours (egg) {
    return getGrade(egg).hatchHours
  }

  /** 孵化位数量（V4.7 主人：1 → 2，金丹解锁第 2 位） */
  hatchSlots () {
    return this.realmIndex >= HATCH.slot2FromRealmIndex ? 2 : HATCH.slots
  }

  /** 正在孵的蛋 */
  get hatchingEggs () {
    return this.s.eggs.filter((e) => e.startAt > 0)
  }

  /** 入孵（V4.7 多孵化位：孵位满 / 园满则不孵） */
  startHatch (uid, now = Date.now()) {
    const egg = this.s.eggs.find((e) => e.uid === uid && e.startAt === 0)
    if (!egg) return { ok: false, message: '没有这枚待孵的蛋。' }
    const slots = this.hatchSlots()
    if (this.hatchingEggs.length >= slots) {
      return {
        ok: false,
        message: slots > 1
          ? `孵化位（${slots} 个）已满，先孵完一窝再入。`
          : '孵化位只有一个，先孵完这枚。'
      }
    }
    if (this.parkFull) return { ok: false, message: `灵兽园已满（${PARK_CAP} 位），腾出位置再孵。` }
    egg.startAt = now
    const g = getGrade(egg.grade)
    return {
      ok: true,
      message: `${g.name}灵兽蛋已入孵（约 ${fmtGameDuration(g.hatchHours * HOUR_MS)}，游戏历）` +
        `${slots > 1 ? `（同时可孵 ${slots} 枚，妖丹可催）` : '（妖丹可催）'}`
    }
  }

  /** 妖丹催孵：1 枚 −1h（不足一小时按一小时整段扣，不找零）；可指定某一枚（多孵位） */
  speedHatch (count = 1, uid = null) {
    const egg = uid == null ? this.hatchingEggs[0] : this.hatchingEggs.find((e) => e.uid === uid)
    if (!egg) return { ok: false, message: '孵化位空着，无需催孵。' }
    const n = Math.max(1, count | 0)
    const have = this.state.inventory.items[HATCH.speed.itemId] | 0
    if (have < n) return { ok: false, message: `${getItem(HATCH.speed.itemId).name}不足：催孵 1 次需 ${n} 枚。` }
    this.state.inventory.items[HATCH.speed.itemId] = have - n
    egg.startAt -= HATCH.speed.hoursPer * HOUR_MS * n
    return { ok: true, message: `以 ${n} 枚妖丹催动地火，孵期缩短 ${fmtGameDuration(HATCH.speed.hoursPer * n * HOUR_MS)}（游戏历）。` }
  }

  /** 孵化进度 */
  hatchProgress (egg, now = Date.now()) {
    const totalMs = this.hatchHours(egg) * HOUR_MS
    if (!(egg.startAt > 0)) return { hatching: false, done: false, elapsedMs: 0, totalMs, leftText: '' }
    const elapsedMs = Math.max(0, now - egg.startAt)
    return {
      hatching: true,
      done: elapsedMs >= totalMs,
      elapsedMs,
      totalMs,
      leftText: fmtGameDuration(totalMs - elapsedMs)   // 游戏历（同派遣口径）
    }
  }

  /** 破壳：满期领兽入园林（多孵位可指定某一枚）；首只自动当主战 */
  claimHatch (now = Date.now(), targetUid = null) {
    const egg = targetUid == null ? this.hatchingEggs[0] : this.hatchingEggs.find((e) => e.uid === targetUid)
    if (!egg) return { ok: false, message: '孵化位空着。' }
    const idx = this.s.eggs.indexOf(egg)
    const prog = this.hatchProgress(egg, now)
    if (!prog.done) return { ok: false, message: `还在壳里拱，还差约 ${prog.leftText}。` }
    const pool = speciesOfGrade(egg.grade)
    const species = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
    const g = getGrade(egg.grade)
    const uid = ++this.s.seq
    const pet = { uid, grade: egg.grade, speciesId: species ? species.id : '', level: 1, star: 1 }
    this.s.eggs.splice(idx, 1)
    this.s.pets.push(pet)
    let autoNote = ''
    if (!this.s.activeUid) {
      this.s.activeUid = uid
      autoNote = '已随行出战（主战）。'
    }
    return {
      ok: true,
      pet,
      message: `蛋壳轻响，一只${g.name}「${species ? species.name : '无名幼兽'}」破壳而出（1 级）。${autoNote}`
    }
  }

  // ── 喂养 ─────────────────────────────────────────────────────────────────

  /** 喂妖丹升级：+1 级；悟性爆发（8%）连升 2 级（clamp 9） */
  feed (uid) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, message: '园里没有这只灵兽。' }
    if (pet.level >= FEED.maxLevel) return { ok: false, message: `「${this.petName(pet)}」已至 ${FEED.maxLevel} 级圆满。` }
    const have = this.state.inventory.items[FEED.itemId] | 0
    if (have < 1) return { ok: false, message: `${getItem(FEED.itemId).name}不足：喂养 1 次需 1 枚（挂机偶得 / 宗门商店）。` }
    this.state.inventory.items[FEED.itemId] = have - 1
    const burst = Math.random() < FEED.epiphany
    pet.level = clamp(pet.level + (burst ? 2 : 1), 1, FEED.maxLevel)
    return {
      ok: true,
      burst,
      level: pet.level,
      message: burst
        ? `「${this.petName(pet)}」忽而灵光大盛（悟性爆发），连升 2 级至 ${pet.level} 级！`
        : `「${this.petName(pet)}」食罢妖丹，升至 ${pet.level} 级。`
    }
  }

  petName (pet) {
    const sp = getSpecies(pet && pet.speciesId)
    return sp ? sp.name : '无名幼兽'
  }

  /** 设为主战（换防：原先那只转待命；被选中者若在辅助位则自动退出辅助） */
  setActive (uid) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, message: '园里没有这只灵兽。' }
    const prev = this.s.activeUid
    this.s.activeUid = uid
    if (Array.isArray(this.s.assistUids)) this.s.assistUids = this.s.assistUids.filter((u) => u !== uid)
    if (prev === uid) return { ok: true, message: `「${this.petName(pet)}」已是主战。` }
    return { ok: true, message: `「${this.petName(pet)}」升为主战，原先那只转入待命。` }
  }

  /**
   * 辅助位开关（V4.7 主人：出战拆为主战 + 辅助）
   *   门槛：辅助位随境界解锁（元婴 1 / 合体 2，见 ASSIST.slotsByRealm）；主战不能兼辅助；位满则拒绝。
   */
  setAssist (uid, on = true) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, message: '园里没有这只灵兽。' }
    if (!Array.isArray(this.s.assistUids)) this.s.assistUids = []
    const has = this.s.assistUids.includes(uid)
    if (this.s.activeUid === uid) return { ok: false, message: `「${this.petName(pet)}」已是主战，不能兼作辅助。` }
    if (on) {
      if (has) return { ok: true, message: `「${this.petName(pet)}」已在辅助位。` }
      const slots = this.assistSlots()
      if (slots <= 0) {
        const from = getLevelInfo(ASSIST.slotsByRealm[0].from * 9 + 1).displayName
        return { ok: false, message: `${from}期起方可另带辅助灵兽（晋境即扩容）。` }
      }
      if (this.s.assistUids.length >= slots) {
        return { ok: false, message: `辅助位已满（${slots} 位）：先撤下一只，或晋境扩容。` }
      }
      this.s.assistUids.push(uid)
      return { ok: true, message: `「${this.petName(pet)}」入辅助位（产出 / 战力按 ${Math.round(ASSIST.mul * 100)}% 生效）。` }
    }
    if (!has) return { ok: true, message: `「${this.petName(pet)}」本不在辅助位。` }
    this.s.assistUids = this.s.assistUids.filter((u) => u !== uid)
    return { ok: true, message: `「${this.petName(pet)}」已撤出辅助位，转待命。` }
  }

  // ── 升星 / 分解（V4.7 主人：相同灵兽可升星 · 不要的兽杀鸡取卵）──────────────

  /** 升星材料：同品级 + 同种类、且不在随行（主战 / 辅助）的另一只 */
  starMaterialOf (pet) {
    if (!pet) return null
    const assists = Array.isArray(this.s.assistUids) ? this.s.assistUids : []
    return this.s.pets.find((p) => p && p.uid !== pet.uid &&
      p.grade === pet.grade && p.speciesId === pet.speciesId &&
      p.uid !== this.s.activeUid && !assists.includes(p.uid)) || null
  }

  /** 升星可行性（面板置灰与悬停提示用，纯读） */
  canStarUp (uid) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, reason: '园里没有这只灵兽。' }
    if (this.starOf(pet) >= STAR.maxStar) return { ok: false, reason: `已至 ${STAR.maxStar} 星圆满。` }
    const mat = this.starMaterialOf(pet)
    if (!mat) {
      return {
        ok: false,
        reason: `需另一只同品级同种类的灵兽作材料（${this.petName(pet)} 目前独一份）：可再孵一只，或把不要的兽分解腾位置。`
      }
    }
    return { ok: true, materialUid: mat.uid, materialName: this.petName(mat) }
  }

  /**
   * 升星：同品级同种 2 合 1（消耗材料那只）→ 星级 +1（上限 STAR.maxStar）
   * @returns {{ok:boolean, message:string, star?:number, consumedUid?:number}}
   */
  starUp (uid, materialUid = null) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, message: '园里没有这只灵兽。' }
    if (this.starOf(pet) >= STAR.maxStar) return { ok: false, message: `「${this.petName(pet)}」已至 ${STAR.maxStar} 星圆满。` }
    const mat = materialUid == null
      ? this.starMaterialOf(pet)
      : this.s.pets.find((p) => p && p.uid === materialUid && p.uid !== uid)
    if (!mat) return { ok: false, message: '升星需一只同品级同种类的灵兽作材料。' }
    if (mat.grade !== pet.grade || mat.speciesId !== pet.speciesId) {
      return { ok: false, message: '材料灵兽须与本体同品级、同种类。' }
    }
    this.s.pets.splice(this.s.pets.indexOf(mat), 1)
    if (this.s.activeUid === mat.uid) this.s.activeUid = pet.uid                 // 材料竟是主战 → 本体顶上
    if (Array.isArray(this.s.assistUids)) this.s.assistUids = this.s.assistUids.filter((u) => u !== mat.uid)
    pet.star = this.starOf(pet) + 1
    const outPct = Math.round(STAR.outputPctPerStar * (pet.star - 1) * 100)
    const powPct = (STAR.powerPctPerStar * (pet.star - 1) * 100).toFixed(1)
    return {
      ok: true,
      star: pet.star,
      consumedUid: mat.uid,
      message: `「${this.petName(pet)}」吞下同类精气，升至 ${pet.star} 星（累计 产出 +${outPct}% · 战力 +${powPct}%）。`
    }
  }

  /** 分解（杀鸡取卵）：随行中不可分解；返妖丹（按品级）+ 灵石（按品级基准 × 等级系数） */
  decompose (uid) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, message: '园里没有这只灵兽。' }
    if (this.s.activeUid === uid) return { ok: false, message: `「${this.petName(pet)}」正随主战，先撤下来再动手。` }
    if ((this.s.assistUids || []).includes(uid)) return { ok: false, message: `「${this.petName(pet)}」在辅助位，先撤下来再动手。` }
    const g = getGrade(pet.grade)
    const star = this.starOf(pet)
    const yaodan = DECOMPOSE.yaodan[pet.grade] | 0
    const stones = Math.round((DECOMPOSE.stones[pet.grade] | 0) * this.levelCoef(pet.level))
    this.state.inventory.items.mat_yaodan = (this.state.inventory.items.mat_yaodan | 0) + yaodan
    this.state.resources.stones = (this.state.resources.stones | 0) + stones
    this.s.pets.splice(this.s.pets.indexOf(pet), 1)
    return {
      ok: true,
      yaodan,
      stones,
      message: `「${this.petName(pet)}」（${g.name}${star > 1 ? ` · ${star} 星` : ''} · ${pet.level} 级）就此了断：取妖丹 ×${yaodan}、灵石 +${stones}。`
    }
  }

  // ── 三用途数值（设计库 §1.4；跨模块只读报价）─────────────────────────────

  /** 出战·产出折算：Σ（单只产出 × 编队权重）—— 主战全额、辅助 50%（V4.7） */
  productionHours () {
    let sum = 0
    for (const { pet, mul } of this.squad()) sum += this.petOutputHours(pet) * mul
    return sum
  }

  /** 被动产出速率/秒（同宗门俸禄口径：基准产出 × 时数 ÷ 24h；在线随秒入账，离线不发） */
  productionQiPerSec () {
    const hours = this.productionHours()
    if (hours <= 0) return 0
    const base = getLevelInfo(this.state.player.realm.level).output.qiPerSec
    return base * hours / 86400
  }

  /** 战力加成：Σ（单只战力% × 编队权重）—— 主战全额、辅助 50%（V4.7） */
  powerBonusPct () {
    let sum = 0
    for (const { pet, mul } of this.squad()) sum += this.petPowerPct(pet) * mul
    return sum
  }

  /** 渡劫助战：主战 +7%、辅助各 +3.5%，合计受 TRIAL_BEAST.cap（+14%）封顶（V4.7） */
  trialAidPct () {
    let sum = 0
    for (const { mul } of this.squad()) sum += TRIAL_BEAST.pctPer * mul
    return Math.min(sum, TRIAL_BEAST.cap)
  }

  /**
   * 统一加成接口（V3.5.3）：本系统提供的加成行（只读，无副作用）。
   * 契约（V3.5.4 修订）：mul＝折叠后的乘法因子（1+战力%），pct 仅作展示。
   * 战力链一行，无出战灵兽时不出行。直读 this.state.beast，不经懒建兜底。
   */
  bonusView () {
    const b = this.state.beast
    if (!b || !Array.isArray(b.pets)) return []
    const main = b.pets.find((p) => p && p.uid === b.activeUid) || null
    if (!main) return []
    const assists = Array.isArray(b.assistUids) ? b.assistUids : []
    let pct = this.petPowerPct(main)
    let n = 0
    for (const u of assists) {
      const p = b.pets.find((x) => x && x.uid === u)
      if (!p || p.uid === main.uid) continue
      pct += this.petPowerPct(p) * ASSIST.mul
      n += 1
    }
    return [{
      kind: 'power',
      label: n > 0 ? `灵兽·${this.petName(main)} +${n} 辅` : `灵兽·${this.petName(main)}`,
      mul: 1 + pct,
      pct,
      note: n > 0
        ? '出战灵兽战力加成（主战全额 · 辅助按 50%；皇品 +8%，其余 +4%，每星 +0.5%）'
        : '出战灵兽战力加成（皇品 +8%，其余 +4%，每星 +0.5%）'
    }]
  }

  // ── 主循环节拍 ───────────────────────────────────────────────────────────

  /**
   * 被动产出随在线时间入账（离线/暂停传 dtSec=0 → 不入账）
   * V3.5.1 起同拍顺带结算灵兽自动成长（出战快、待命慢，见 beasts.GROWTH）；
   * 升级文案暂存 this._grew，装配层用 drainGrew() 取走打日志。
   * @returns {number} 本拍入账灵气
   */
  tick (now, dtSec = 0) {
    if (dtSec <= 0) return 0
    const grew = []
    this._growTick(dtSec, grew)
    if (grew.length) this._grew = (this._grew || []).concat(grew)
    const gain = this.productionQiPerSec() * dtSec
    if (gain > 0) this.state.resources.qi += gain
    return gain
  }

  /** 取走本段时间攒下的灵兽升级文案（取完即清） */
  drainGrew () {
    const out = this._grew || []
    this._grew = []
    return out
  }

  /** 自动成长结算（主人 2026-09-19：出战久了自动成长；园中待命缓慢成长） */
  _growTick (dtSec, out) {
    for (const pet of this.s.pets) {
      if (pet.level >= FEED.maxLevel) continue
      if (pet.exp == null) pet.exp = 0
      if (pet.gf == null) pet.gf = 0
      // 随行（主战 / 辅助）长得快，园中待命慢（V4.7：辅助视同随行）
      const withYou = pet.uid === this.s.activeUid ||
        (Array.isArray(this.s.assistUids) && this.s.assistUids.includes(pet.uid))
      const rate = withYou ? GROWTH.activeSecPerPoint : GROWTH.parkSecPerPoint
      pet.gf += dtSec / rate
      while (pet.gf >= 1) {
        pet.gf -= 1
        pet.exp += 1
        if (pet.exp >= GROWTH.expPerLevel) {
          pet.exp = 0
          pet.level = clamp(pet.level + 1, 1, FEED.maxLevel)
          out.push(`「${this.petName(pet)}」朝夕相伴、道气浸润，自行成长至 ${pet.level} 级（出战长得快，园中待命慢些）。`)
          if (pet.level >= FEED.maxLevel) { pet.gf = 0; break }
        }
      }
    }
  }

  /**
   * 自动寻蛋（主人 2026-09-18：可以自动寻蛋）
   * 口径：空闲且本轮未派遣 → 派灵鹰入林；已归巢 → 直接收蛋入笼。
   *   **不管孵化与破壳** —— 那是「自动孵化」开关的事（autoHatchTick，V4.7 主人 09-19）。
   * @returns {Array<{kind:'dispatch'|'egg', ok:boolean, message:string}>} 本拍发生的动作
   */
  autoTick (now = Date.now()) {
    const out = []
    if (!this.unlocked) return out
    const prog = this.dispatchProgress(now)
    if (prog.running) {
      if (prog.done) out.push({ kind: 'egg', ...this.collectDispatch(now) })
      return out
    }
    if (this.s.lastDispatchDay === dayKey(now)) return out   // 本轮已派过，不刷失败日志
    out.push({ kind: 'dispatch', ...this.dispatch(now) })
    return out
  }

  /**
   * 自动孵化（V4.7 主人 2026-09-19：「灵兽增加自动孵化」，默认开，档位 settings.autoHatch）
   * 口径：
   *   ① 先破壳 —— 孵满的蛋逐枚领兽入园（多孵位可同时完成，领完即腾出孵位）；
   *   ② 再入孵 —— 还有待孵的蛋、孵位（金丹起 2 位）有空、灵兽园未满，就把空位补满。
   * 停手条件：没蛋（静默）/ 孵位满（静默）/ 灵兽园满（**不入孵**，避免孵出时爆园；
   *   此情形每 10 分钟只提示一次，免得每拍刷屏）。
   * 妖丹催孵是花资源的手速活，自动不碰。
   * @returns {Array<{kind:'hatch'|'start', ok:boolean, message:string}>} 本拍真正发生的动作
   */
  autoHatchTick (now = Date.now()) {
    const out = []
    // ① 破壳（孵满的蛋一枚一枚领；`.slice()` 防遍历中被 splice 改动）
    for (const egg of this.hatchingEggs.slice()) {
      if (!this.hatchProgress(egg, now).done) continue
      out.push({ kind: 'hatch', ...this.claimHatch(now, egg.uid) })
    }
    // ② 入孵（补满空孵位）
    const idle = this.s.eggs.filter((e) => e.startAt === 0)
    if (!idle.length) return out
    const slots = this.hatchSlots()
    if (this.hatchingEggs.length >= slots) return out
    if (this.parkFull) {
      // 注意：毫秒时间戳不能走 `| 0`（32 位截断会得到负数 → 节流形同失效）
      const notedAt = Number(this._autoHatchFullNotedAt) || 0
      if (now - notedAt >= AUTO_HATCH_FULL_NOTE_MS) {
        this._autoHatchFullNotedAt = now
        out.push({
          kind: 'start',
          ok: false,
          message: `灵兽园已满（${PARK_CAP} 位），自动孵化暂且停下 —— 腾位（分解 / 升星）后自会续上。`
        })
      }
      return out
    }
    for (const egg of idle) {
      if (this.hatchingEggs.length >= slots) break
      out.push({ kind: 'start', ...this.startHatch(egg.uid, now) })
    }
    return out
  }

  // ── 视图（装配层渲染用，纯读）────────────────────────────────────────────

  overviewView (now = Date.now()) {
    return {
      unlocked: this.unlocked,
      parkCap: PARK_CAP,
      pets: this.s.pets.length,
      eggs: this.s.eggs.length,
      activeUid: this.s.activeUid,
      activeName: this.activePet ? this.petName(this.activePet) : null,
      // V4.7：主战 + 辅助编队 / 双孵位
      assistNames: this.assistPets.map((p) => this.petName(p)),
      assistSlots: this.assistSlots(),
      hatchSlots: this.hatchSlots(),
      hatching: this.hatchingEggs.length,
      productionHours: this.productionHours(),
      productionPerDay: this.productionQiPerSec() * 86400,
      powerBonusPct: this.powerBonusPct(),
      trialAidPct: this.trialAidPct()
    }
  }

  dispatchView (now = Date.now()) {
    const prog = this.dispatchProgress(now)
    return {
      unlocked: this.unlocked,
      hours: WANSHOU.hours,
      running: prog.running,
      done: prog.done,
      leftText: prog.leftText,
      collected: prog.running && prog.done
    }
  }

  /** 蛋 + 孵化位的合并视图（蛋列表 × 孵化进度；V4.7：多孵位） */
  eggsView (now = Date.now()) {
    const slots = this.hatchSlots()
    const slotFull = this.hatchingEggs.length >= slots
    return this.s.eggs.map((egg) => {
      const g = getGrade(egg.grade)
      const prog = this.hatchProgress(egg, now)
      return {
        uid: egg.uid,
        grade: egg.grade,
        gradeName: g.name,
        color: g.color,
        hatchHours: g.hatchHours,
        hatching: prog.hatching,
        done: prog.done,
        pct: prog.hatching ? Math.min(1, prog.elapsedMs / prog.totalMs) : 0,
        leftText: prog.leftText,
        isSlot: prog.hatching,      // 在孵者各占一个孵位（不再有"唯一孵位"语义）
        slotFull,                   // 待孵且孵位已满 → 面板显示「孵位已满」
        slots
      }
    })
  }

  petsView () {
    const activeUid = this.s.activeUid
    const assists = Array.isArray(this.s.assistUids) ? this.s.assistUids : []
    const assistSlots = this.assistSlots()
    return this.s.pets.map((pet) => {
      const g = getGrade(pet.grade)
      const sp = getSpecies(pet.speciesId)
      const maxed = pet.level >= FEED.maxLevel
      const exp = pet.exp | 0
      const star = this.starOf(pet)
      const isMain = pet.uid === activeUid
      const isAssist = assists.includes(pet.uid)
      const starUp = this.canStarUp(pet.uid)
      return {
        uid: pet.uid,
        name: sp ? sp.name : '无名幼兽',
        desc: sp ? sp.desc : '',
        grade: pet.grade,
        gradeName: g.name,
        color: g.color,
        level: pet.level,
        levelCoef: this.levelCoef(pet.level),
        // V4.7 星级（升星：同品级同种 2 合 1）
        star,
        starMax: STAR.maxStar,
        starCoef: this.starCoef(pet),
        starText: '★'.repeat(star) + '☆'.repeat(Math.max(0, STAR.maxStar - star)),
        canStarUp: starUp.ok,
        starReason: starUp.reason || '',
        starMaterialUid: starUp.materialUid || null,
        starMaterialName: starUp.materialName || '',
        active: isMain,
        // V4.7 编队：主战 / 辅助 / 待命
        assist: isAssist,
        roleText: isMain ? '主战' : (isAssist ? '辅助' : '待命'),
        assistSlots,
        canDecompose: !isMain && !isAssist,     // 随行中不可杀鸡取卵
        outputHours: this.petOutputHours(pet),
        powerPct: this.petPowerPct(pet),
        // 自动成长（V3.5.1）：升级进度与下一还差多久（在线挂机口径）
        growPct: maxed ? 1 : exp / GROWTH.expPerLevel,
        growText: maxed
          ? '圆满'
          : `成长 ${exp}/${GROWTH.expPerLevel}（${(isMain || isAssist) ? '随行 · 约 2 小时/级' : '待命 · 约 6 小时/级'}）`
      }
    })
  }
}

export default BeastSystem
