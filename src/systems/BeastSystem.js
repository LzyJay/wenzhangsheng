/**
 * BeastSystem.js —— 灵兽系统（纯逻辑层）（2.8）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/beasts.js（品级 · 万兽林 · 孵化 · 喂养 · 产出 · 种类池）
 *
 * 口径（设计库《灵兽兽潮与大比 v1》§1.1~§1.4 + 开发计划 V2 §四 2.8）：
 *   · 万兽林派遣（寻蛋）：金丹解锁，每轮 1 次 × 1h（一轮 = 30 游戏天 ≈ 现实 2 小时），
 *     产蛋一枚（品级 70/22/7/1）；autoTick 支持自动派遣 + 自动收蛋（主人 2026-09-18）
 *   · 孵化：1 个孵化位，时长按品级 4/6/8/12h；妖丹 −1h/枚 加速
 *   · 灵兽园 6 格；孵出即入园林；首次孵出自动出战（MVP 验收口径「孵出并生效加成」）
 *   · 出战 1 只：被动产出 0.2h/日 × 品级 × 等级系数（上限 0.6h）随在线秒入账（离线不发）；
 *     战力 +4%（皇品 +8%）；渡劫单雷 +7%（经装配层供 CultivationSystem 报价，本系统不读别人子树）
 *   · 喂养：妖丹 → 升 1 级（1~9 级），每级 +10%；8% 悟性爆发本次连升 2 级
 *   · 血脉觉醒 / 化形 / 灵兽园扩容 / 代采 / 兽潮 ＝ 版本 2/3，不在本模块
 *
 * 存档子树：state.beast（null＝尚无灵兽资产；懒建兜底，老档自动补全）
 * 跨模块接线（13.1②，均由 main.js 中转）：
 *   · CultivationSystem 注入本实例 → 只调 activePet / TRIAL_BEAST 报价，不写 state.beast
 *   · SectSystem 注入 powerMul 闭包 → 战力任务定标/判定吃到灵兽战力加成
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GRADES, WANSHOU, HATCH, FEED, GROWTH, OUTPUT, PARK_CAP, TRIAL_BEAST, dayKey, getGrade, getSpecies, rollGrade, speciesOfGrade } from '../data/beasts.js'
import { getLevelInfo } from '../data/realms.js'
import { getItem } from '../data/items.js'
// 游戏历（主人 2026-09-17）：剩余时长一律用游戏历文案，不再报现实时分
import { fmtGameDuration, fmtRefreshPeriod } from '../data/gametime.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const HOUR_MS = 3600 * 1000

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
        pets: [],               // [{ uid, grade, speciesId, level }]
        activeUid: null,        // 出战灵兽
        lastDispatchDay: null,  // 万兽林派遣的轮次 key（30 游戏天 ≈ 现实 2 小时）
        dispatchStartAt: 0      // 派遣中起点；0 ＝ 空闲
      }
    }
    return this.state.beast
  }

  // ── 基础查询 ─────────────────────────────────────────────────────────────

  /** 金丹期（realmIndex ≥ 2）解锁万兽林 */
  get unlocked () {
    return Math.floor((this.state.player.realm.level - 1) / 9) >= WANSHOU.unlockRealmIndex
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

  /** 入孵（同刻只孵一枚；园满不孵） */
  startHatch (uid, now = Date.now()) {
    const egg = this.s.eggs.find((e) => e.uid === uid && e.startAt === 0)
    if (!egg) return { ok: false, message: '没有这枚待孵的蛋。' }
    if (this.s.eggs.some((e) => e.startAt > 0)) return { ok: false, message: '孵化位只有一个，先孵完这枚。' }
    if (this.parkFull) return { ok: false, message: `灵兽园已满（${PARK_CAP} 位），腾出位置再孵。` }
    egg.startAt = now
    const g = getGrade(egg.grade)
    return { ok: true, message: `${g.name}灵兽蛋已入孵（约 ${fmtGameDuration(g.hatchHours * HOUR_MS)}，妖丹可催）。` }
  }

  /** 妖丹催孵：1 枚 −1h（不足一小时按一小时整段扣，不找零） */
  speedHatch (count = 1) {
    const egg = this.s.eggs.find((e) => e.startAt > 0)
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

  /** 破壳：满期领兽入园林；首次孵出自动出战 */
  claimHatch (now = Date.now()) {
    const idx = this.s.eggs.findIndex((e) => e.startAt > 0)
    if (idx < 0) return { ok: false, message: '孵化位空着。' }
    const egg = this.s.eggs[idx]
    const prog = this.hatchProgress(egg, now)
    if (!prog.done) return { ok: false, message: `还在壳里拱，还差约 ${prog.leftText}。` }
    const pool = speciesOfGrade(egg.grade)
    const species = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
    const g = getGrade(egg.grade)
    const uid = ++this.s.seq
    const pet = { uid, grade: egg.grade, speciesId: species ? species.id : '', level: 1 }
    this.s.eggs.splice(idx, 1)
    this.s.pets.push(pet)
    let autoNote = ''
    if (!this.s.activeUid) {
      this.s.activeUid = uid
      autoNote = '已随行出战。'
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

  /** 设为出战（换防：原先那只自动转待命） */
  setActive (uid) {
    const pet = this.s.pets.find((p) => p.uid === uid)
    if (!pet) return { ok: false, message: '园里没有这只灵兽。' }
    const prev = this.s.activeUid
    this.s.activeUid = uid
    if (prev === uid) return { ok: true, message: `「${this.petName(pet)}」已在随行出战。` }
    return { ok: true, message: `「${this.petName(pet)}」随行出战，原先那只转入待命。` }
  }

  // ── 三用途数值（设计库 §1.4；跨模块只读报价）─────────────────────────────

  /** 出战·产出折算：0.2h/日 × 品级系数 × 等级系数，上限 0.6h/只 */
  productionHours () {
    const pet = this.activePet
    if (!pet) return 0
    const g = getGrade(pet.grade)
    return clamp(OUTPUT.baseHours * g.coef * this.levelCoef(pet.level), 0, OUTPUT.capHours)
  }

  /** 被动产出速率/秒（同宗门俸禄口径：基准产出 × 时数 ÷ 24h；在线随秒入账，离线不发） */
  productionQiPerSec () {
    if (!this.activePet) return 0
    const base = getLevelInfo(this.state.player.realm.level).output.qiPerSec
    return base * this.productionHours() / 86400
  }

  /** 出战·战力加成（+4%，皇品 +8%） */
  powerBonusPct () {
    const pet = this.activePet
    return pet ? getGrade(pet.grade).powerPct : 0
  }

  /** 渡劫助战：单雷 +7%/只（上限 +14%；MVP 只出战 1 只 → 至多 +7%） */
  trialAidPct () {
    return this.activePet ? TRIAL_BEAST.pctPer : 0
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
      const rate = pet.uid === this.s.activeUid ? GROWTH.activeSecPerPoint : GROWTH.parkSecPerPoint
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
   *   **不管孵化与破壳**（孵位只有一个，自动孵会把蛋卡在单一品级上，留给玩家定夺）。
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

  // ── 视图（装配层渲染用，纯读）────────────────────────────────────────────

  overviewView (now = Date.now()) {
    return {
      unlocked: this.unlocked,
      parkCap: PARK_CAP,
      pets: this.s.pets.length,
      eggs: this.s.eggs.length,
      activeUid: this.s.activeUid,
      activeName: this.activePet ? this.petName(this.activePet) : null,
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

  /** 蛋 + 孵化位的合并视图（蛋列表 × 孵化进度） */
  eggsView (now = Date.now()) {
    const hatchingUid = this.s.eggs.some((e) => e.startAt > 0)
      ? this.s.eggs.find((e) => e.startAt > 0).uid
      : null
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
        isSlot: egg.uid === hatchingUid
      }
    })
  }

  petsView () {
    const activeUid = this.s.activeUid
    return this.s.pets.map((pet) => {
      const g = getGrade(pet.grade)
      const sp = getSpecies(pet.speciesId)
      const maxed = pet.level >= FEED.maxLevel
      const exp = pet.exp | 0
      return {
        uid: pet.uid,
        name: sp ? sp.name : '无名幼兽',
        desc: sp ? sp.desc : '',
        grade: pet.grade,
        gradeName: g.name,
        color: g.color,
        level: pet.level,
        levelCoef: this.levelCoef(pet.level),
        active: pet.uid === activeUid,
        outputHours: clamp(OUTPUT.baseHours * g.coef * this.levelCoef(pet.level), 0, OUTPUT.capHours),
        powerPct: g.powerPct,
        // 自动成长（V3.5.1）：升级进度与下一还差多久（在线挂机口径）
        growPct: maxed ? 1 : exp / GROWTH.expPerLevel,
        growText: maxed
          ? '圆满'
          : `成长 ${exp}/${GROWTH.expPerLevel}（${pet.uid === activeUid ? '出战 · 约 2 小时/级' : '待命 · 约 6 小时/级'}）`
      }
    })
  }
}

export default BeastSystem
