/**
 * CultivationSystem.js —— 挂机产出结算 + 突破/渡劫判定（纯逻辑层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：本层禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数值口径全部来自 src/data/realms.js（唯一参数源），本文件不写死任何魔法数字。
 *
 * 产出管线（数据模型 §十四）：
 *   基准产出 rate(L) → × 世界系数 × 灵根系数 × (1+功法) × (1+洞府) × (1+宗门)
 *                     × (1+buff 合计) × 契合度系数 = 有效产出 effRate（灵气/秒）
 *   MVP 仅实现 buff 乘区，其余乘区位置保留（阶段二逐项接入，接入后不影响本文件结构）。
 *
 * 突破判定：小重 → 固定概率；小瓶颈 → 低概率；渡劫 → 三道天雷过二即成。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  getLevelInfo,
  getNextBreakthrough,
  trialNodeIndex,
  breakthroughStoneReward,
  LEVEL_MAX,
  SUCCESS_RATE,
  FAILURE_PLAN,
  TRIBULATION,
  TRIAL_NODES,
  TRIAL_PREPS
} from '../data/realms.js'
import { MAT_DROPS } from '../data/alchemy.js'
// 游戏历（主人 2026-09-17）：调息冷却 / 道伤时长一律用游戏历文案
import { fmtGameDuration } from '../data/gametime.js'

/** 2.2 丹药系统实装：×3 / ×6 重小瓶颈冲关需消耗破境丹（设计库原文口径，背包已就位） */
const MVP_REQUIRE_PILL = true

/**
 * 修为积累加成（主人 2026-09-16 指令）：
 *   修为攒得越超出本级突破所需，突破/渡劫概率越高；境界越高，同样富余带来的加成越低。
 *   口径：overflow = 当前修为 ÷ 本级突破所需 − 1（只算"超出"部分；修为不足时恒为 0）
 *         bonus = perOverflow × min(overflow, maxOverflow) × 境界衰减
 *         境界衰减 = 1 / (1 + realmDecay × 大境界序)（炼气 ×1.0 → 筑基 ×0.67 → 金丹 ×0.5 … 大乘 ×0.18）
 * 设计取舍：与"修为"直接挂钩（攒灵气冲关有意义），且以"本级所需"为标尺——境界抬高后
 *   所需灵气指数上涨，同样倍数的富余越来越难攒，与衰减系数双重收敛，不会破坏概率预算。
 */
const QI_SURPLUS = {
  perOverflow: 0.05,   // 每多攒 1 倍"本级所需" → +5%
  maxOverflow: 4,      // 超出部分最多计 4 倍（炼气封顶 +20%）
  realmDecay: 0.5      // 境界衰减系数（见上）
}

/** 单次 tick 的最大结算时长（秒）：防止系统休眠/断点调试造成的异常大额入账（离线走 SaveSystem 结算） */
const MAX_TICK_SECONDS = 5

function clamp (v, min, max) {
  return Math.min(Math.max(v, min), max)
}

class CultivationSystem {
  /**
   * @param {object} state 存档状态树
   * @param {object|null} roots RootSystem 实例（提供灵根乘区）；为空视为无障碍无灵根
   * @param {object|null} tech TechniqueSystem 实例（提供功法乘区）；为空视为无功法
   * @param {object|null} sect SectSystem 实例（2.5：只调它的 trialAid / payTrialAid，不碰它的子树）
   * @param {object|null} beast BeastSystem 实例（2.8：只读它的 activePet / trialAidPct，不碰它的子树）
   * @param {object|null} world WorldSystem 实例（2.9：只读它的 rateMul / rootCostMul / trialMul，不碰它的子树）
   * @param {object|null} life LifespanSystem 实例（2.11：只读 fitRateMul / fitTrialPct，不碰寿元与任务子树）
   */
  constructor (state, roots = null, tech = null, sect = null, beast = null, world = null, life = null) {
    this.state = state
    this.roots = roots
    this.tech = tech
    this.sect = sect
    this.beast = beast
    this.world = world
    this.life = life
    this.lastTickAt = Date.now()
  }

  /** 灵根乘区（产出 rateMul / 突破成本 costMul）；未测灵根时均为 1 */
  get rootMods () {
    return this.roots ? this.roots.mods : { rateMul: 1, costMul: 1 }
  }

  /** 世界乘区（2.9：产出 rateMul / 天劫强度 trialMul）；未接世界均为中性 */
  get worldMods () {
    if (!this.world) return { rateMul: 1, trialMul: 1 }
    return { rateMul: this.world.rateMul, trialMul: this.world.trialMul }
  }

  /** 世界对当前灵根档位的突破成本修正（青岚界伪灵根 +10%）；未接世界 = 中性 1 */
  get worldRootCostMul () {
    if (!this.world) return 1
    const rarity = this.roots && this.roots.drawn ? this.roots.tier.rarity : null
    return this.world.rootCostMul(rarity)
  }

  /** 功法乘区（已装备功法的产出加成合计，加法叠加）；未接功法时为 0 */
  get techPct () {
    return this.tech ? this.tech.ratePct() : 0
  }

  // ── 基础访问 ────────────────────────────────────────────────────────────

  get level () {
    return this.state.player.realm.level
  }

  /** 当前境界信息（来自 realms.js 生成表） */
  get info () {
    return getLevelInfo(this.level)
  }

  get isMaxLevel () {
    return this.level >= LEVEL_MAX
  }

  // ── 产出 ────────────────────────────────────────────────────────────────

  /**
   * 有效产出（灵气/秒）
   * @returns {{ base:number, mul:number, eff:number, parts:object }}
   */
  getEffRate (nowMs = Date.now()) {
    const base = this.info.output.qiPerSec
    const rootMods = this.rootMods
    const techPct = this.techPct
    const worldRateMul = this.worldMods.rateMul

    // 乘区：MVP 已实装 世界 / 灵根 / 功法 / buff（丹药/事件/道伤）；其余乘区待阶段二
    let buffPct = 0
    for (const buff of this.state.buffs) {
      if ((buff.endsAt || Infinity) <= nowMs) continue
      if (buff.mods && typeof buff.mods.qiRatePct === 'number') buffPct += buff.mods.qiRatePct
    }

    // 2.11 天道契合乘区：顺天值档位决定（天谴 ×0.8 … 天命 ×1.3）；未接 life 视为凡常 ×1
    const fitMul = this.life ? this.life.fitRateMul : 1

    // 公式（《数据模型》§十四）：基准产出 × 世界系数 × 灵根系数 × (1+功法加成) × (1+buff合计) × 契合度系数
    const mul = clamp(worldRateMul * rootMods.rateMul * (1 + techPct) * (1 + buffPct) * fitMul, 0.05, 100)
    return {
      base,
      mul,
      rootMul: rootMods.rateMul,
      techPct,
      eff: base * mul,
      parts: { world: worldRateMul, root: rootMods.rateMul, technique: techPct, dwelling: 0, sect: 0, buff: buffPct, fit: fitMul }
    }
  }

  /** 清理已到期 buff（道伤等） */
  pruneBuffs (nowMs = Date.now()) {
    const before = this.state.buffs.length
    this.state.buffs = this.state.buffs.filter(b => (b.endsAt || Infinity) > nowMs)
    return before - this.state.buffs.length
  }

  /**
   * 挂机结算：按真实流逝时间入账（每 100ms 调用一次，速率即"每秒增加修为"）
   * @returns {number} 本次结算的秒数（0 = 未结算）
   */
  tick (nowMs = Date.now()) {
    if (this.state.settings && this.state.settings.paused) {
      this.lastTickAt = nowMs
      return 0
    }

    let dt = (nowMs - this.lastTickAt) / 1000
    this.lastTickAt = nowMs
    if (!(dt > 0)) return 0
    if (dt > MAX_TICK_SECONDS) dt = MAX_TICK_SECONDS

    this.state.resources.qi += this.getEffRate(nowMs).eff * dt
    this.state.meta.playtimeSec += dt
    this._dropMats(dt)
    this.pruneBuffs(nowMs)
    return dt
  }

  /**
   * 挂机偶得材料（2.2 丹药线 MVP 产出：天地灵气凝出草木矿晶；离线不掉落）。
   * 掉落只改库存，不打断产出节奏；总量对齐 alchemy.js MAT_DROPS（⚖ 可调）。
   */
  _dropMats (dt) {
    const inv = this.state.inventory
    if (!inv || !inv.items || typeof inv.items !== 'object') return
    for (const [id, cfg] of Object.entries(MAT_DROPS)) {
      if (Math.random() < cfg.perSec * dt) {
        inv.items[id] = (inv.items[id] | 0) + 1
        this.state.stats.matDrops = (this.state.stats.matDrops | 0) + 1
      }
    }
  }

  // ── 突破 ────────────────────────────────────────────────────────────────

  /** 升级所需灵气：cost(当前级 + 1) × 灵根成本乘区；满级返回 Infinity */
  getNeeded () {
    if (this.isMaxLevel) return Infinity
    return getNextBreakthrough(this.level).costQi * this.rootMods.costMul * this.worldRootCostMul
  }

  /** 进度 0~1（灵气为单一池：既是进度也是库存） */
  getProgress () {
    const need = this.getNeeded()
    if (!Number.isFinite(need)) return 1
    return clamp(this.state.resources.qi / need, 0, 1)
  }

  getCooldownRemain (nowMs = Date.now()) {
    const until = this.state.player.cooldownUntil || 0
    return Math.max(0, Math.ceil((until - nowMs) / 1000))
  }

  /** 当前大境界序号（0 = 炼气 … 7 = 大乘） */
  getRealmIndex () {
    return Math.floor((this.level - 1) / 9)
  }

  /**
   * 修为积累加成（QI_SURPLUS）：修为超出"本级所需"越多，概率加成越高；境界越高衰减越大
   * @returns {{ overflow:number, bonus:number, decay:number, realmIndex:number }}
   *   overflow 富余倍数（qi/need − 1，可为负）｜ bonus 概率加成（0 ~ +20%）｜ decay 境界衰减系数
   */
  getSurplusBonus () {
    const realmIndex = this.getRealmIndex()
    const decay = 1 / (1 + QI_SURPLUS.realmDecay * realmIndex)
    const need = this.getNeeded()
    if (!Number.isFinite(need) || need <= 0) {
      return { overflow: 0, bonus: 0, decay, realmIndex }
    }
    const overflow = this.state.resources.qi / need - 1
    const bonus = Math.max(0, Math.min(overflow, QI_SURPLUS.maxOverflow)) * QI_SURPLUS.perOverflow * decay
    return { overflow, bonus, decay, realmIndex }
  }

  /**
   * 渡劫单雷通过率（游戏设计文档 §5.3）
   * P_base = clamp(0.35 + 0.30 × R_adj, 0.10, 0.90)；MVP 无战力系统，
   * 按"裸战力比"口径取 R_adj = 1 / Fk（战力加成系统接入后改为 我方战力 ÷ Req）。
   * @param {number} bonusPct 修为积累加成（垫劫补正/保底之后再叠加，最终仍受 0.05~0.95 钳制）
   */
  getTrialChance (nodeIndex, consecutiveFails = 0, bonusPct = 0) {
    const cfg = TRIBULATION
    const fk = cfg.fk[clamp(nodeIndex, 0, cfg.fk.length - 1)]
    // 世界天劫强度（破晓星域 +10%）：需求战力 ×trialMul → R_adj = 1 / (fk × trialMul)
    const rAdj = 1 / (fk * this.worldMods.trialMul)
    const fails = Math.max(0, consecutiveFails | 0)

    let p = clamp(cfg.pBase.a + cfg.pBase.b * rAdj, cfg.pBase.clamp[0], cfg.pBase.clamp[1])
    if (fails >= cfg.pity.fails) {
      p = Math.max(p, cfg.pity.fourthPBases) // 3 连败后第 4 次保底
    } else {
      p += Math.min(fails * cfg.failBonus.per, cfg.failBonus.cap) // 垫劫补正
    }
    // 修为积累加成（2.1 后）与渡劫准备加成（2.5）在此合流，最终仍受 0.05~0.95 钳制
    p = clamp(p + (bonusPct || 0), 0.05, 0.95)

    // 三道天雷、过二即成
    const pAll = Math.pow(p, 3) + 3 * Math.pow(p, 2) * (1 - p)
    return { fk, rAdj, fails, p, pAll, bonus: bonusPct || 0 }
  }

  /**
   * 生成当前可执行突破的完整预览（UI 只读此结果，不自行判断规则）
   * @returns {object} plan + probability + 可用状态
   */
  getBreakthroughPreview (nowMs = Date.now()) {
    const plan = getNextBreakthrough(this.level)
    // 成本乘区：灵根（真灵根 −5% / 天灵根 −15%）× 世界（青岚界伪灵根 +10%）
    plan.need = plan.costQi * this.rootMods.costMul * this.worldRootCostMul
    const need = plan.need
    const qi = this.state.resources.qi
    const cooldownSec = this.getCooldownRemain(nowMs)

    // 天灵根特权：结丹（第 3 大境界）无瓶颈 —— 本级的小瓶颈降级为普通小重
    // 节点语义：breakthrough.type 描述"离开本级时要过什么关"，故以当前级判定
    const isJindan = Math.floor((this.level - 1) / 9) === 2
    const heavenExempt = isJindan && plan.type === 'bottleneck' && !!this.roots && this.roots.noBottleneckOnJindan
    const effType = heavenExempt ? 'minor' : plan.type
    const isTrial = effType === 'tribulation' || effType === 'ascension'

    let probability = SUCCESS_RATE.minor
    let trial = null
    // 修为积累加成：修为超出本级所需越多，成功率越高（境界越高衰减越大）
    const surplus = this.getSurplusBonus()
    if (isTrial) {
      // 2.5：渡劫可提前准备（护劫丹 / 镇雷法宝 / 宗门援助…），准备加成与修为积累加成叠加计入单雷 P
      // 2.11：顺天值档位修正（天谴 −15% … 天命 +10%）在此一并合流，最终仍受 0.05~0.95 钳制
      const node = trialNodeIndex(this.level)
      const preps = this.prepSummary(node)
      const fitPct = this.life ? this.life.fitTrialPct : 0
      const bonus = surplus.bonus + preps.pct + fitPct
      trial = this.getTrialChance(node, this.state.trialState.consecutiveFails, bonus)
      trial.node = node
      trial.nodeName = this.trialNodeView(node).name
      trial.preps = preps
      trial.surplusBonus = surplus.bonus
      trial.fitPct = fitPct
      probability = trial.pAll
    } else if (effType === 'bottleneck') {
      probability = clamp(SUCCESS_RATE.bottleneck + surplus.bonus, 0, 0.95)
    } else {
      probability = clamp(SUCCESS_RATE.minor + surplus.bonus, 0, 0.98)
    }

    const pillRequired = MVP_REQUIRE_PILL && effType === 'bottleneck' && !!plan.pill
    const pillMissing = pillRequired && (this.state.inventory.items[plan.pill] | 0) <= 0
    const enoughQi = qi >= need
    const ascended = !!this.state.player.flags.ascended

    let blocked = null
    if (ascended) blocked = '已飞升'
    else if (pillMissing) blocked = '缺少破境丹'
    else if (cooldownSec > 0) blocked = '调息中'
    else if (!enoughQi) blocked = '修为不足'

    return {
      plan: { ...plan, type: effType },
      rawType: plan.type,
      heavenExempt,
      need,
      qi,
      progress: this.getProgress(),
      enoughQi,
      cooldownSec,
      pillRequired,
      pillMissing,
      ascended,
      isTrial,
      probability,
      trial,
      surplus,
      ready: !blocked,
      blocked
    }
  }

  /**
   * 执行一次突破
   * @returns {object} 结算结果（供 UI 打日志 / 播飘字）
   */
  attemptBreakthrough (nowMs = Date.now()) {
    const preview = this.getBreakthroughPreview(nowMs)
    const { plan } = preview

    if (preview.ascended) {
      return { ok: false, reason: 'ascended', message: '已飞升仙界，静待二期内容。' }
    }
    if (preview.pillMissing) {
      return { ok: false, reason: 'pill', message: `需要「破境丹」×1（炼丹系统将于阶段二开放）。` }
    }
    if (preview.cooldownSec > 0) {
      return { ok: false, reason: 'cooldown', message: `正在调息，还需 ${fmtGameDuration(preview.cooldownSec * 1000)}（游戏历）。` }
    }
    if (!preview.enoughQi) {
      return { ok: false, reason: 'qi', message: '修为不足，尚不可冲击此关。' }
    }

    // 首次渡劫 = 教学局，保底成功（游戏设计文档 §4.2②）
    const teaching = preview.isTrial && !this.state.player.flags.firstTrialDone

    // 小瓶颈冲关消耗破境丹（设计库原文口径：×3/×6 重必需；尝试即消耗，失败不退还）
    let usedPill = null
    if (preview.pillRequired) {
      const inv = this.state.inventory.items
      const pillId = preview.plan.pill
      inv[pillId] = Math.max(0, (inv[pillId] | 0) - 1)
      usedPill = pillId
    }

    const roll = Math.random()
    const success = teaching || roll < preview.probability

    const stats = this.state.stats
    stats.totalBreakthroughs += 1

    if (success) {
      return this._settleSuccess(preview, { teaching, roll, nowMs })
    }
    return this._settleFailure(preview, { roll, nowMs })
  }

  // ── 内部结算 ────────────────────────────────────────────────────────────

  _settleSuccess (preview, { teaching, roll, nowMs }) {
    const { plan } = preview
    const state = this.state
    const fromName = plan.fromName

    // 开销：清空本级所需灵气（含灵根成本乘区）
    state.resources.qi = Math.max(0, state.resources.qi - preview.need)

    if (plan.type === 'ascension') {
      state.player.flags.ascended = true
      state.player.flags.firstTrialDone = true
      state.trialState.consecutiveFails = 0
      state.player.cooldownUntil = nowMs + FAILURE_PLAN.ascension.cooldownSec * 1000
      this.pruneBuffs(nowMs)
      return {
        ok: true,
        success: true,
        type: 'ascension',
        label: '飞升',
        fromName,
        toName: plan.targetName,
        probability: preview.probability,
        teaching,
        lostQi: preview.need,
        gainedStones: 0,
        targetLevel: null,
        floatText: '羽化飞升！',
        detail: `羽化飞升！${fromName} 已是圆满，仙界之门暂封（二期内容）。`,
        outcome: '羽化飞升（里程碑）'
      }
    }

    // 升级
    state.player.realm.level += 1
    const info = getLevelInfo(state.player.realm.level)

    // 奖励：MVP 简化——突破成功得灵石（设计库中灵石来自秘境/坊市，阶段二接入）
    const stones = breakthroughStoneReward(info.level)
    state.resources.stones += stones

    let pillGain = 0
    if (preview.isTrial) {
      // 关口序号取"离开的那一级"（节点语义：breakthrough 描述离开本级时的关口）
      const node = trialNodeIndex(plan.fromLevel)
      state.trialState.node = Math.max(state.trialState.node, node + 1)
      state.trialState.consecutiveFails = 0
      state.trialState.lastAttemptAt = nowMs
      state.player.flags.firstTrialDone = true
      state.stats.totalTrials += 1
      // 渡劫成功补充洗髓丹（MVP 口径：阶段二改为任务/事件产出）
      if (this.roots) pillGain = this.roots.grantTrialDrop()
      this._recordTrial(node, true, preview.probability)
      this.clearPreps()   // 一份准备只对这一回天雷负责
    }

    const pct = (preview.probability * 100).toFixed(1)
    const exemptText = preview.heavenExempt ? '（天灵根·结丹无瓶颈）' : ''
    const pillText = pillGain > 0 ? `，洗髓丹 +${pillGain}` : ''
    const detail = preview.isTrial
      ? `天劫已渡！${fromName} → ${info.displayName}（三道天雷·过二即成，成功率 ${pct}%${teaching ? '，教学局保底' : ''}${pillText}）`
      : `${info.text.flavor}：${fromName} → ${info.displayName}${exemptText}（成功率 ${pct}%），灵石 +${stones}`

    return {
      ok: true,
      success: true,
      type: plan.type,
      label: plan.label,
      fromName,
      toName: info.displayName,
      probability: preview.probability,
      teaching,
      heavenExempt: preview.heavenExempt,
      lostQi: preview.need,
      gainedStones: stones,
      gainedPills: pillGain,
      targetLevel: info.level,
      realmChanged: info.stage === 1,   // 晋入新大境界（供寿元"破境续命"等使用）
      milestone: info.text.milestone,
      floatText: preview.isTrial ? '天劫已渡！' : '突破成功',
      detail,
      outcome: `${info.displayName}（灵石 +${stones}${pillGain ? `，洗髓丹 +${pillGain}` : ''}）`
    }
  }

  _settleFailure (preview, { roll, nowMs }) {
    const { plan } = preview
    const state = this.state
    const lossPlan = FAILURE_PLAN[plan.type] || FAILURE_PLAN.minor

    // 失败：损失 30%（小重 20%）当前灵气储备，下限 0；不掉级、不遗失宝物
    const lostQi = state.resources.qi * lossPlan.qiLossPct
    state.resources.qi = Math.max(0, state.resources.qi - lostQi)
    state.player.cooldownUntil = nowMs + lossPlan.cooldownSec * 1000
    state.stats.totalFails = (state.stats.totalFails || 0) + 1

    let daoShangText = ''
    if (preview.isTrial) {
      state.trialState.consecutiveFails += 1
      state.trialState.lastAttemptAt = nowMs
      state.stats.totalTrials += 1
      this._recordTrial(trialNodeIndex(plan.fromLevel), false, preview.probability)
      this.clearPreps()   // 垫劫重来要重新准备（服过的丹已化入经脉）

      // 道伤：产出 −30%，持续 1 小时（可叠加刷新，不叠乘）
      const ds = TRIBULATION.daoShang
      state.player.cooldownUntil = nowMs + FAILURE_PLAN.tribulation.cooldownSec * 1000
      state.trialState.daoShangUntil = nowMs + ds.durationSec * 1000
      this._applyDaoShang(nowMs)
      daoShangText = `，${ds.name}加身（产出 −30%，持续 ${fmtGameDuration(ds.durationSec * 1000)}·游戏历）`
    }

    const pct = (preview.probability * 100).toFixed(1)
    const detail = preview.isTrial
      ? `渡劫失败：三道天雷未能过二（成功率 ${pct}%），损耗修为 ${Math.round(lostQi)}${daoShangText}`
      : `${plan.label}失败：${plan.targetName} 关卡未过（成功率 ${pct}%），损耗修为 ${Math.round(lostQi)}`

    return {
      ok: true,
      success: false,
      type: plan.type,
      label: plan.label,
      fromName: plan.fromName,
      toName: plan.targetName,
      probability: preview.probability,
      lostQi,
      targetLevel: plan.targetLevel,
      cooldownSec: Math.ceil((state.player.cooldownUntil - nowMs) / 1000),
      floatText: preview.isTrial ? '天雷难渡…' : '突破失败',
      detail,
      outcome: `失败（损耗修为 ${Math.round(lostQi)}）`
    }
  }

  /** 写入/刷新道伤 debuff */
  _applyDaoShang (nowMs) {
    const ds = TRIBULATION.daoShang
    const state = this.state
    const existing = state.buffs.find(b => b.id === ds.id)
    if (existing) {
      existing.endsAt = nowMs + ds.durationSec * 1000
      return
    }
    state.buffs.push({
      id: ds.id,
      name: ds.name,
      kind: 'debuff',
      mods: { qiRatePct: ds.qiRatePct },
      endsAt: nowMs + ds.durationSec * 1000,
      source: { type: 'trial', ref: `L${this.level}` }
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2.5 渡劫完整版 —— 独立区块（8 关口全开 · 准备加成 · 静养疗伤）
  // 存档子树：state.player.tribul（本模块私有，他人勿写）
  // 常量源：TRIAL_NODES（八关口）/ TRIAL_PREPS（准备项）/ TRIBULATION.prepCap、cure
  // ════════════════════════════════════════════════════════════════════════

  /** 库存快捷访问（老档缺结构时自愈，照 AlchemySystem.items 的兜底写法） */
  get items () {
    const inv = this.state.inventory
    if (!inv || typeof inv !== 'object') this.state.inventory = { items: {} }
    if (!this.state.inventory.items || typeof this.state.inventory.items !== 'object') {
      this.state.inventory.items = {}
    }
    return this.state.inventory.items
  }

  /** 渡劫子树兜底：老档补字段，永远返回可用对象 */
  ensureTribul () {
    const p = this.state.player
    if (!p.tribul || typeof p.tribul !== 'object') {
      p.tribul = { preps: {}, nodeStats: {}, history: [], total: { hujie: 0, sect: 0, cure: 0 } }
    }
    const t = p.tribul
    if (!t.preps || typeof t.preps !== 'object') t.preps = {}
    if (!t.nodeStats || typeof t.nodeStats !== 'object') t.nodeStats = {}
    if (!Array.isArray(t.history)) t.history = []
    if (!t.total || typeof t.total !== 'object') t.total = { hujie: 0, sect: 0, cure: 0 }
    return t
  }

  get tribul () {
    return this.ensureTribul()
  }

  /** 当前所处关口序号（0~7）；不在渡劫节点返回 -1 */
  get trialNode () {
    return trialNodeIndex(this.level)
  }

  /** 已渡关口数（0~8）：以等级推导为主，trialState.node 与已飞升标志兜底校准 */
  get trialCleared () {
    const byLevel = Math.min(Math.floor((this.level - 1) / 9), TRIAL_NODES.length)
    const flagged = this.state.player.flags.ascended
      ? TRIAL_NODES.length
      : Math.min(((this.state.trialState || {}).node | 0), TRIAL_NODES.length)
    return Math.max(byLevel, flagged)
  }

  /** 单关口档案（含战绩；index 越界自动收敛） */
  trialNodeView (index = this.trialNode) {
    const i = Math.min(Math.max(index | 0, 0), TRIAL_NODES.length - 1)
    const st = this.tribul.nodeStats[String(i)] || { tries: 0, passes: 0 }
    return { ...TRIAL_NODES[i], total: TRIAL_NODES.length, tries: st.tries, passes: st.passes }
  }

  /** 八关口全览：passed 已渡 ｜ current 当前 ｜ locked 尚未行至 */
  nodesView () {
    const cleared = this.trialCleared
    const cur = this.trialNode
    return TRIAL_NODES.map((n, i) => {
      const st = this.tribul.nodeStats[String(i)] || { tries: 0, passes: 0 }
      return {
        ...n,
        index: i,
        total: TRIAL_NODES.length,
        tries: st.tries,
        passes: st.passes,
        passed: i < cleared,
        current: i === cur,
        locked: i > cleared
      }
    })
  }

  /** 准备项视图（UI 只读此结果，不自行判断规则） */
  prepViews (nodeIndex = this.trialNode) {
    const t = this.tribul
    const idx = Math.max(0, nodeIndex | 0)
    return TRIAL_PREPS.map((p) => {
      const count = p.itemId ? (this.items[p.itemId] | 0) : 0
      const costStones = p.kind === 'stone'
        ? Math.round(p.stonesBase * Math.pow(p.stonesGrowth, idx))
        : 0
      const picked = !!t.preps[p.id]
      const pct = `${Math.round(p.bonusPct * 100)}%`
      const v = { ...p, nodeIndex: idx, costStones, count, picked, active: false, appliedPct: 0, state: '', message: '' }

      if (p.kind === 'hold') {
        v.active = count > 0
        v.appliedPct = v.active ? p.bonusPct : 0
        v.state = v.active ? 'active' : 'off'
        v.message = v.active ? `持有 ${count} 件 · 已自动生效（+${pct}）` : '尚无此宝 · 持有即自动生效'
      } else if (p.kind === 'contrib') {
        // 宗门援助：价码由 SectSystem 报价（本模块不读也不写 state.sect）
        const aid = this.sect ? this.sect.trialAid(idx) : null
        v.costContrib = aid ? aid.cost : 0
        v.active = picked
        v.appliedPct = picked ? p.bonusPct : 0
        if (!aid || !aid.joined) {
          v.state = 'locked'
          v.message = '尚未拜入宗门（先去「宗门」报到）'
        } else if (picked) {
          v.state = 'active'
          v.message = `结阵已就位 · 单雷 +${pct}`
        } else if (!aid.affordable) {
          v.state = 'lack'
          v.message = `需 ${aid.cost} 贡献（现有 ${aid.have}）`
        } else {
          v.state = 'ready'
          v.message = `需 ${aid.cost} 贡献` + (aid.discount ? `（${aid.rankName} ${Math.round(aid.discount * 100)}% 折）` : '')
        }
      } else if (p.kind === 'system') {
        // 2.8 灵兽助战已实装：出战灵兽即自动生效（hold 性质，不必点「备妥」）
        if (p.id === 'beast' && this.beast) {
          const pet = this.beast.activePet
          v.active = !!pet
          v.appliedPct = v.active ? p.bonusPct : 0
          v.state = v.active ? 'active' : 'locked'
          v.message = v.active
            ? `「${this.beast.petName(pet)}」随行护法 · 单雷 +${pct}`
            : '灵兽园空空：孵出灵兽并设为出战后自动生效（见「灵兽」面板）'
        } else {
          v.state = 'locked'
          v.message = `${p.module} 上线后开放`
        }
      } else if (p.kind === 'consume') {
        v.active = picked
        v.appliedPct = picked ? p.bonusPct : 0
        v.state = picked ? 'active' : (count > 0 ? 'ready' : 'lack')
        v.message = picked
          ? `已服下 · 单雷 +${pct}`
          : (count > 0 ? `囊中 ${count} 枚 · 可服下` : '囊中无此丹 · 丹房可炼')
      } else {
        v.state = 'locked'
        v.message = '此路尚不可行'
      }
      return v
    })
  }

  /** 准备加成合计（含"是否撞到 +35% 上限"的明细） */
  prepSummary (nodeIndex = this.trialNode) {
    const views = this.prepViews(nodeIndex)
    const cap = TRIBULATION.prepCap
    const raw = views.reduce((s, v) => s + (v.active ? v.bonusPct : 0), 0)
    return { pct: Math.min(raw, cap), raw, cap, capped: raw > cap + 1e-9, views }
  }

  /**
   * 备好一项渡劫准备（消耗在点击即刻发生：服丹 / 结阵付费）
   * @returns {{ok:boolean, message:string, bonusPct?:number, cost?:number}}
   */
  prepare (id, nodeIndex = this.trialNode) {
    const p = TRIAL_PREPS.find((x) => x.id === id)
    if (!p) return { ok: false, message: '未登记的准备项' }
    if (nodeIndex < 0) return { ok: false, message: '此处并非渡劫关口，不必准备。' }
    if (p.kind === 'hold') return { ok: false, message: `${p.name}持有即生效，不必另行准备。` }
    if (p.kind === 'system') {
      if (p.id === 'beast' && this.beast && this.beast.activePet) {
        return { ok: false, message: `${p.name}：出战灵兽随行护法，持有即生效，不必另行准备。` }
      }
      return { ok: false, message: `${p.name}：${p.module} 上线后开放。` }
    }

    const t = this.tribul
    if (t.preps[id]) return { ok: false, message: `${p.name}已备妥当。` }
    const pct = `${Math.round(p.bonusPct * 100)}%`

    if (p.kind === 'consume') {
      const have = this.items[p.itemId] | 0
      if (have <= 0) return { ok: false, message: `囊中没有${p.name}（${p.from}）。` }
      this.items[p.itemId] = have - 1
      t.total.hujie = (t.total.hujie | 0) + 1
      t.preps[id] = true
      return { ok: true, bonusPct: p.bonusPct, message: `服下${p.name}：单雷通过率 +${pct}（已化入经脉，成败皆不退还）。` }
    }

    if (p.kind === 'contrib') {
      if (!this.sect) return { ok: false, message: '宗门系统尚未接入，无人可请。' }
      const pay = this.sect.payTrialAid(nodeIndex)
      if (!pay.ok) return { ok: false, cost: pay.cost, message: pay.message }
      t.total.sect = (t.total.sect | 0) + 1
      t.preps[id] = true
      return { ok: true, cost: pay.cost, bonusPct: p.bonusPct, message: `${pay.message}单雷通过率 +${pct}。` }
    }

    return { ok: false, message: `${p.name}暂不可备。` }
  }

  /** 引雷后清空准备：一份准备只对这一回天雷负责 */
  clearPreps () {
    const t = this.tribul
    const had = Object.keys(t.preps).length
    t.preps = {}
    return had
  }

  /** 静养资费：随大境界水涨船高 */
  cureCost () {
    const c = TRIBULATION.cure
    return Math.round(c.stonesBase * Math.pow(c.stonesGrowth, this.getRealmIndex()))
  }

  hasDaoShang (nowMs = Date.now()) {
    const b = this.state.buffs.find((x) => x.id === TRIBULATION.daoShang.id)
    return !!(b && (b.endsAt || Infinity) > nowMs)
  }

  /** 静养：花灵石立即清除道伤（游戏设计文档 §4.2②） */
  cureDaoShang (nowMs = Date.now()) {
    if (!this.hasDaoShang(nowMs)) return { ok: false, message: '身上并无道伤，不必静养。' }
    const cost = this.cureCost()
    if ((this.state.resources.stones | 0) < cost) {
      return { ok: false, cost, message: `灵石不足：静养一次需 ${cost} 灵石。` }
    }
    this.state.resources.stones -= cost
    this.state.buffs = this.state.buffs.filter((x) => x.id !== TRIBULATION.daoShang.id)
    if (this.state.trialState) this.state.trialState.daoShangUntil = 0
    this.tribul.total.cure = (this.tribul.total.cure | 0) + 1
    return { ok: true, cost, message: `静养两个时辰：道伤尽去，产出恢复如常（灵石 −${cost}）。` }
  }

  /** 战绩写档：八关口全览里"试过几次、过了没有"的数据源 */
  _recordTrial (nodeIndex, ok, pAll) {
    if (!(nodeIndex >= 0)) return
    const t = this.tribul
    const key = String(nodeIndex)
    const st = t.nodeStats[key] || { tries: 0, passes: 0 }
    st.tries += 1
    if (ok) st.passes += 1
    t.nodeStats[key] = st
    t.history.push({ node: nodeIndex, ok: !!ok, at: Date.now(), p: Number((pAll || 0).toFixed(4)) })
    if (t.history.length > 20) t.history.splice(0, t.history.length - 20)
  }
}

export default CultivationSystem
