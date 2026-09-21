/**
 * SectSystem.js —— 宗门系统（纯逻辑层）（2.4）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/sect.js（云岚宗 · 职级 · 任务池 · 藏经阁 · 商店）
 *
 * 口径（设计库《宗门与弟子 v1》+ 开发计划 §四 2.4）：
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
 *
 * ── V5.5 弟子线首批（收徒 / 培养 / 职权 / 贡献）────────────────────────────
 *   数据源：src/data/disciples.js（设计库《宗门与弟子 v1》第二部分）
 *   · **四件事闭环**：收徒（观礼 / 相看）→ 培养（传功升级）→ 职权（派岗）→ 贡献（上缴）
 *   · 存档叶子 state.sect.**disciples**（本类 `s` getter 懒建兜底，**零迁移**，不动 SaveSystem）
 *   · 产出只给**材料 / 宗门贡献 / 灵石**，**不发境界**（§七 硬护栏）
 *   · 归因：灵石入账发生在主循环 `tick()` 内（装配层快照窗口）→ 自动落既有 `sect` 线，
 *     不新增归因线；贡献 / 材料同既有宗门任务口径（非 qi/stones，不入台账）
 *   · 上限：全部弟子合计当量 h/日 封顶 DISCIPLE_CAP_H_PER_DAY（设计库第三部分 2.4h/日 → 主人 2026-09-19 拍板下调至 2.0h/日）
 *   预留（后续批 B2）：助战 / 代管（设计库 §2.3）、出师门客（§2.4）、师徒风险事件（§2.5）、
 *     藏经阁分层与个人洞府（§1.4）—— 见 data/disciples.js 的 POSTS_RESERVED
 *
 * ── V5.5.1 弟子线后续批（B2：经营 / 事件）──────────────────────────────────
 *   数据源：data/sect.js 的 DABI / OFFERING + data/disciples.js 的 LOYALTY / DISC_EVENTS
 *   · **周常·供奉**（§1.3「捐献材料 → 贡献 ×1.2 折算」）：每 7 游戏天一次、每次至多 10 份，
 *     贡献 = 货值 × 份数 × 1.2 —— 每轮限一次堵「商店买符纸 → 供奉回血」的刷贡献回路；
 *     只动贡献（不入 §七 灵石台账）
 *   · **周常·宗门大比**（§1.3「周结算 贡献 300~1000＋灵石＋头衔」）：每 7 游戏天一届，
 *     战力比率内插贡献带（同任务板 CONTRIB_GROWTH 境界口径）＋头衔/魁首计数；
 *     设计稿的「＋灵石」按压缩日历放大 ~205 倍/日必破 §七 → **本批裁除灵石奖**（需拍板，见回执）
 *   · **忠诚与师徒风险事件**（§2.5）：每名弟子 loyalty 0~100（入门 70），低于 30 叛离（轻惩罚）；
 *     事件轮 7 游戏天、每名弟子 3% 概率掷四条（闯祸赔灵石 / 被掳（可救援）/ 带宝而归 / 恩义+贡献）；
 *     传功 +5 忠诚。赔付取小值 + 材料只出灵草，静态预估不顶破 §七（见回执-B2 §4 量级表）
 *   · 新存档叶子（全部懒建兜底、零迁移，不改 B1 已有叶子名与语义）：
 *     state.sect.offerKey / state.sect.dabi{key,wins,best,title} /
 *     state.sect.disciples.evtKey / .log / 弟子记录.loyalty / .captured
 *   · 首个事件轮只记键不掷事件（老档 / 新收徒接入不当拍爆，见 _tickDiscipleEvents）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  SECT, RANKS, TASKS, LIBRARY, SHOP, sectDayKey, getTask,
  shopOf,              // V7.3：宗门商店按界补货（常驻 10 条 ＋ 本界 2 件）
  contribOf, REALM_GRANTS, realmGrant, taskDurationMs, CONTRIB_GROWTH,
  SECT_REFRESH_DAYS, sectMsToNextRefresh, fmtSectRefreshPeriod,
  DABI, dabiKeyOf, dabiMsToNext, dabiContribOf, OFFERING, offeringContrib,
  dabiTitleOf,  // V6.4 批 D3：大比头衔按世界分叉（未登记界回落原字面）
  CONTRIB_REALM_CAP,   // V6.12 批 G5a：境界倍率上界（**与职级档数解耦**，加档不改数值）
  taskTextOf           // V6.12 批 G5c：任务按职位分叉的名称 / 描述
} from '../data/sect.js'
// V6.12 批 G4：多宗（12 界 × 8 宗 ＝ 96 宗）。data→data 单向；系统不横向 import 任何 system。
import { getSect, defaultSectOf, sectsOfWorld, normalizeSectId, SECT_DAO, rankTitlesOf } from '../data/worldSects.js'
import { sectTechsOf, SECT_TECH_LEVELS } from '../data/sectTechniques.js'
// V5.5 弟子线（首批：收徒 / 培养 / 职权 / 贡献）——数据先行，参数全在 data 层
import {
  RECRUIT, recruitCooldownMs, slotsOf,
  APTITUDES, PITY, POSTS, POSTS_RESERVED, DISCIPLE_LV, DISCIPLE_CAP_H_PER_DAY, DAY_SEC,
  LOYALTY, DISC_EVENTS, discEventKeyOf, rollDiscEvent, rescueCostOf,
  aptById, witById, specById, postById, rollAptitude, rollWits, rollSpecialty,
  rollName, specMaterial, discipleGrowth, discipleOutput, specFitsPost, discipleRateH,
  trainCostH, capScale
} from '../data/disciples.js'
import { getGoodsValue } from '../data/market.js'   // V5.5.1 供奉：材料货值表（data 层同源）
import { getLevelInfo, getRealmMeta, TRIAL_AID } from '../data/realms.js'
import { getItem } from '../data/items.js'
import { getTechnique, tierLabel } from '../data/techniques.js'
import { stoneHourly } from '../data/events.js'   // 当量 h → 灵石（与秘境 / 事件同一口径）
import { clamp, fmtShort } from '../util/num.js'   // 区间钳制 + 大数简写（零依赖叶子层 src/util/）

// 大数简写：本地 fmtBig 已删除，日志与面板文案统一走 util/num.js 的 fmtShort
//（批2 口径统一：<1万 由四舍五入改为向下取整；单位前的空格一并去掉，与主界面一致；负数归零语义保留）。
/** 提前提交的最低受理比例：与"至少接手 1 秒"取小 —— 任务只有几个时辰（现实十几秒），
 *  若硬按 10% 算，1 时辰的活要等 0.5 秒、5 时辰的活要等 2.5 秒；取小后"随时可交"名副其实。 */
const MIN_CLAIM_RATIO = 0.1
const MIN_CLAIM_MS = 1000
/** V5.5.1：忠诚值收敛到 [0, LOYALTY.max] */
const clampLoyalty = (v) => Math.max(0, Math.min(LOYALTY.max, Number(v) || 0))

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
        totalContrib: 0, lastDay: null, slots: [], techGrants: {}, disciples: null
      }
    }
    // V3.3.1：老档补「境界下发功法」台账 + 任务板字段兜底（懒建，不进迁移链）
    if (!this.state.sect.techGrants || typeof this.state.sect.techGrants !== 'object') {
      this.state.sect.techGrants = {}
    }
    if (!Array.isArray(this.state.sect.slots)) this.state.sect.slots = []
    // V5.5.1：周常（供奉 / 大比）子叶兜底（懒建，不改 B1 已有叶子名与语义）
    if (typeof this.state.sect.offerKey !== 'string') this.state.sect.offerKey = ''
    if (!this.state.sect.dabi || typeof this.state.sect.dabi !== 'object') {
      this.state.sect.dabi = { key: '', wins: 0, best: 0, title: '' }
    }
    // V5.5：弟子线子树兜底（懒建，不进迁移链；老档 sect 存在但没有该叶子）
    const dl = this.state.sect.disciples
    if (!dl || typeof dl !== 'object') {
      this.state.sect.disciples = { list: [], pity: 0, gazeAt: 0, seq: 0, accC: 0, accS: 0, accM: {} }
    } else {
      if (!Array.isArray(dl.list)) dl.list = []
      if (typeof dl.pity !== 'number' || !isFinite(dl.pity)) dl.pity = 0
      if (!dl.gazeAt) dl.gazeAt = 0
      if (!dl.seq) dl.seq = 0
      if (typeof dl.accC !== 'number' || !isFinite(dl.accC)) dl.accC = 0
      if (typeof dl.accS !== 'number' || !isFinite(dl.accS)) dl.accS = 0
      if (!dl.accM || typeof dl.accM !== 'object') dl.accM = {}
      // V5.5.1：忠诚 / 被掳 / 事件台账兜底（老档弟子逐个补默认值）
      if (typeof dl.evtKey !== 'string') dl.evtKey = ''
      if (!Array.isArray(dl.log)) dl.log = []
      for (const x of dl.list) {
        if (!x || typeof x !== 'object') continue
        if (typeof x.loyalty !== 'number' || !isFinite(x.loyalty)) x.loyalty = LOYALTY.start
        if (typeof x.captured !== 'boolean') x.captured = false
      }
    }
    // V6.12 批 G5b：**换界散修化（懒检测）** —— 所入宗门不在当前界 → 自动转散修。
    //   放在这里可**一次覆盖三条换界路径**（GM 自选世界 / 界镜道具 / 转世换界），
    //   不必给任何 UI 加回调；幂等（转一次后 joined=false，之后不再触发）。
    //   ⚠ 只吃 sec 对象、不读 this.s（防 getter 递归）。
    const sec = this.state.sect
    if (sec.joined && sec.sectId) {
      const cur = getSect(normalizeSectId(sec.sectId))
      const w = this.state.world && this.state.world.worldId
      if (cur && w && cur.worldId !== w) this._turnRogue(sec)
    }
    return this.state.sect
  }

  /**
   * V6.12 批 G5b：**转散修**（换界后自动执行）。
   *   · **清**：宗门归属 / 职级 / 累计贡献 / 任务板 / 授功台账 / 周常键 / 大比 —— 本宗事务一笔勾销
   *   · **留**：贡献**货币**（已赚的钱）、门下弟子、已习得功法（跨宗资产跟着人走）
   *   只吃传入的 `sec` 对象、**不读 `this.s`** —— 避免在 `s` getter 内递归。
   */
  _turnRogue (sec) {
    sec.joined = false
    sec.sectId = null
    sec.rank = 0
    sec.totalContrib = 0
    sec.slots = []
    sec.techGrants = {}
    sec.offerKey = ''
    sec.dabi = { key: '', wins: 0, best: 0, title: '' }
    return true
  }

  /**
   * V6.12 批 G5b：显式同步「宗门 ↔ 当前界」（装配层在换界后可直接调用；懒检测已覆盖，此处为双保险）。
   *   触发一次 `this.s` 即完成检测 —— 界别不符会自动转散修。
   */
  syncWorld () {
    const s = this.s
    return { attached: !!s.joined, sectId: s.sectId || null, worldId: this.worldId }
  }

  /** 当前大境界下标（0 炼气 …）——任务解锁与奖励缩放共用 */
  get realmIndex () {
    return Math.floor((Math.max(1, this.state.player.realm.level | 0) - 1) / 9)
  }

  get joined () {
    return !!(this.state.sect && this.state.sect.joined)
  }

  /**
   * 当前职级。V6.12 批 G5a：**称号按「宗 > 界 > 阵营」三级取**（`worldSects.rankTitlesOf`）——
   *   数值（门槛 / 俸禄 / 槽位 / 折扣 / unlocks）仍一律来自 `RANKS`，此处只覆盖 `name`。
   *   故各宗称号不同而数值口径完全同源。
   */
  get rankMeta () {
    const r = RANKS[clamp(this.s.rank | 0, 0, RANKS.length - 1)]
    const titles = rankTitlesOf(this.s.sectId, null)
    return { ...r, name: titles[r.idx] || r.name }
  }

  get contribution () {
    return this.state.resources.contribution | 0
  }

  // ── V6.12 批 G4：多宗（12 界 × 8 宗 ＝ 96 宗）────────────────────────────

  /**
   * 当前所在宗（名册条目）；未入宗时返回 null。
   *   老档 `sectId='sect_yunlan'`（旧表 id）由 `normalizeSectId` 映射到 `'sect_ql_yunlan'` ——
   *   不映射则 `getSect()` 返回 null，按宗查道统 / 名册 / 传承会**静默失效**。
   */
  get currentSect () {
    if (!this.joined) return null
    return getSect(normalizeSectId(this.s.sectId)) || null
  }

  /** 面板用的「本界默认宗」（未入宗时作推荐入口；无世界信息时回落旧表 SECT） */
  get homeSect () {
    const w = this.worldId
    return (w && defaultSectOf(w)) || getSect('sect_ql_yunlan') || SECT
  }

  /**
   * 道统加成（V6.12 批 G4 实装）。**未入宗 → 全 0**（不白给加成）。
   *   数值唯一真源在 `data/worldSects.js` 的 `SECT_DAO[dao].bonus`，本处只读不算。
   *   各乘区按 key 取：`power` 战力 / `qi` 挂机产出 / `pill` 丹药 / `event` 事件收益。
   */
  get daoBonus () {
    const cur = this.currentSect
    const b = (cur && SECT_DAO[cur.dao] && SECT_DAO[cur.dao].bonus) || null
    return {
      power: (b && b.power) || 0,
      qi: (b && b.qi) || 0,
      pill: (b && b.pill) || 0,
      event: (b && b.event) || 0
    }
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

  /**
   * 入宗（免费；新手引导口径＝测灵根后由玩家自行拜入）。
   * V6.12 批 G4：**可指定宗门** `sectId`（名册 id 或老档别名）；省略则取**本界默认宗**。
   *   ⚠ 签名由 `join(now)` 变为 `join(sectId, now)`：既有调用（面板 / 自测）一律无参 →
   *     `sectId` 为 null → 走默认宗，**行为与改造前完全一致**。
   */
  join (sectId = null, now = Date.now()) {
    if (this.joined) return { ok: false, message: '已在宗门之中。' }
    const pick = getSect(normalizeSectId(sectId)) || this.homeSect
    if (!pick) return { ok: false, message: '未找到该宗门。' }
    // V6.12 批 G5b：只能拜**本界**宗门（名册按界给，跨界的宗不在本界名册内）
    const w = this.worldId
    if (w && pick.worldId && pick.worldId !== w) {
      return { ok: false, message: `${pick.name}不在本界，无从拜入。` }
    }
    const s = this.s
    s.joined = true
    s.sectId = pick.id
    s.rank = 0
    s.totalContrib = 0
    s.lastDay = sectDayKey(now)
    this.rerollTasks()
    // 主人 2026-09-18：入宗即按当前修为境界下发一本普通功法
    const grants = this.grantTick()
    const dao = SECT_DAO[pick.dao] || { name: '散修', desc: '无道统加成' }
    return {
      ok: true,
      sectId: pick.id,
      sectName: pick.name,
      grants,
      message: `拜入${pick.name}，列身外门。道统·${dao.name}：${dao.desc}；任务板已开放，做满贡献可在藏经阁借阅功法。`
    }
  }

  /**
   * 换宗（V6.12 批 G4）：照 `WorldSystem.changeWorld / _swapAtomic` 的**原子范式** ——
   *   一次性写完「宗门 + 本宗事务归零」，不留半成品状态。
   *   · **重置**（本宗事务，类比换界清「熟练度与世数」）：职级 / 累计贡献 / 任务板 /
   *     授功台账 / 周常键 / 大比战绩
   *   · **保留**（类比跨界资产）：贡献**货币**（`resources.contribution`，已赚的钱）、
   *     门下弟子、已习得功法与装备
   *   ⚠ 换宗会清职级，属**不可撤销**的重操作 —— 二次确认在 UI 层（照 WorldPanel 的
   *     `pendingSwap` 闭包标志范式），系统层只做原子切换、不弹确认。
   * @returns {{ok:boolean, message:string, from?:string, to?:string, sect?:object}}
   */
  changeSect (sectId, now = Date.now()) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门，请先入宗。' }
    const pick = getSect(normalizeSectId(sectId))
    if (!pick) return { ok: false, message: '未登记此宗门。' }
    // V6.12 批 G5b：换宗同样限**本界**（跨界的宗不在本界名册内）
    const w = this.worldId
    if (w && pick.worldId && pick.worldId !== w) {
      return { ok: false, message: `${pick.name}不在本界，无从改投。` }
    }
    const cur = this.currentSect
    if (cur && cur.id === pick.id) return { ok: false, message: `你已在${pick.name}。` }
    const from = cur ? cur.name : '（无）'
    const s = this.s
    s.sectId = pick.id
    s.rank = 0
    s.totalContrib = 0
    s.slots = []
    s.techGrants = {}
    s.lastDay = sectDayKey(now)
    s.offerKey = ''
    s.dabi = { key: '', wins: 0, best: 0, title: '' }
    this.rerollTasks()
    const grants = this.grantTick()
    const dao = SECT_DAO[pick.dao] || { name: '散修', desc: '无道统加成' }
    return {
      ok: true,
      from,
      to: pick.id,
      sect: pick,
      grants,
      message: `改投${pick.name}：职级与累计贡献重头来，贡献余额与门下弟子仍归你。道统·${dao.name}：${dao.desc}。`
    }
  }

  /** 名册视图（本界 8 宗 ＋ 当前宗标记；供面板「宗门名册 / 换宗」区渲染，纯读） */
  rosterView () {
    const w = this.worldId
    const curId = this.currentSect ? this.currentSect.id : null
    return sectsOfWorld(w).map((x) => {
      const dao = SECT_DAO[x.dao] || { name: '—', desc: '' }
      return {
        id: x.id,
        name: x.name,
        dao: x.dao,
        daoName: dao.name,
        daoDesc: dao.desc,
        align: x.align,
        intro: x.intro,
        isCurrent: x.id === curId,
        isHome: !!x.defaultForWorld,
        techCount: sectTechsOf(x.id).length
      }
    })
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
    if (info.maxed) return { ok: false, message: `已至${this.rankMeta.name}之位，宗门之内再无可晋。` }
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
   * 主循环节拍：俸禄随在线时间入账 + 任务板换轮 + **到点自动交差** + 弟子产出（V5.5）
   * @param {number} now 当前时间戳
   * @param {number} dtSec 本拍经过的在线秒数（暂停/离线传 0 → 只做轮次与自动交差）
   * @returns {{salary:number, claims:Array<object>, disciples:{contrib:number, stones:number, mats:number}}}
   *          本拍入账俸禄 + 自动交差结果 + 弟子产出（供装配层打日志）
   *   注意：弟子产出的**灵石**在本方法内入账 —— 装配层对 sect.tick 已做快照归因，
   *         故灵石自动落既有 `sect` 线，无需新增归因点（§13.4 · §七）。
   */
  tick (now, dtSec = 0) {
    const out = { salary: 0, claims: [], disciples: { contrib: 0, stones: 0, mats: 0 } }
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
    out.disciples = this._tickDisciples(now, dtSec)
    // V5.5.1：师徒风险事件（同一拍结算；闯祸赔的灵石在快照窗口内 → 落既有 sect 线）
    out.disciples.events = this._tickDiscipleEvents(now)
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

  /**
   * 当前可接的任务池。V3.3.1：`minRealm ≤ 大境界`；V6.12 批 G5c 追加**职位门槛** `minRank`。
   *   双门槛都过才进池 —— 低职级只出粗活，高职级才出重赏与**职责任务**；
   *   职位不够者**连看都看不到**（而非「看得到接不了」）。
   */
  taskPool () {
    const r = this.realmIndex
    const rank = this.s.rank | 0
    const pool = TASKS.filter((t) => (t.minRealm | 0) <= r && (t.minRank | 0) <= rank)
    return pool.length ? pool : TASKS.filter((t) => (t.minRealm | 0) === 0 && (t.minRank | 0) === 0)
  }

  /**
   * V6.12 批 G5c：任务在**当前职位**下的显示名（日志 / 提示 / 面板统一走它）。
   *   名称与描述按「满足 `minRank` 的最高一档变体」取，真源见 `data/sect.js` 的 `taskTextOf`。
   */
  _taskName (def) {
    return taskTextOf(def, this.s.rank | 0).name
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
        message: `接下「${this._taskName(def)}」——战力胜于定标 ${slot.req}，当场办妥：贡献 +${res.contrib}${res.matText}。`
      }
    }
    return { ok: true, message: `接下「${this._taskName(def)}」（限时 ${def.hours} 时辰），到点自会办妥；中途也可提前交差。` }
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
        message: `「${this._taskName(def)}」才刚接手（${(prog.elapsedMs / 1000).toFixed(1)} 秒），至少办够 ${(gateMs / 1000).toFixed(1)} 秒才好交差（约 ${Math.max(1, Math.ceil(waitMs / 1000))} 秒后）。`
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
      message: `「${this._taskName(def)}」${tag}${verdict}：贡献 +${contrib}${matText}。`
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

  // ── 一键操作（V4.7 主人 2026-09-18：任务板一键接取 / 一键提交）─────────────
  // 口径：等价于把每个槽位逐个点一遍，不新增任何数值口径 —— 一键接取走 startTask
  //       （战力达标的照旧当场办妥）；一键提交**只交已到点的满额任务**，
  //       未到期的不替玩家折损（想折损仍逐个点「提前交差」）。

  /**
   * 一键接取：把当前所有待接（open）的槽位一次接完
   * @returns {{ok:boolean, started:number, instant:number, contrib:number, results:object[]}}
   */
  startAllOpen (now = Date.now()) {
    const out = { ok: false, started: 0, instant: 0, contrib: 0, results: [] }
    if (!this.joined) {
      out.results.push({ ok: false, message: '尚未拜入宗门。' })
      return out
    }
    const slots = this.s.slots || []
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i] || slots[i].state !== 'open') continue
      const r = this.startTask(i, now)
      out.results.push({ ...r, index: i })
      if (r.ok) {
        out.started += 1
        if (r.instant) { out.instant += 1; out.contrib += r.contrib | 0 }
      }
    }
    out.ok = out.started > 0
    return out
  }

  /**
   * 自动接取一拍（主循环每拍调用；内部节流，避免每 100ms 空转扫板）
   *   主人 2026-09-18：任务板一刷新就自动把活儿接下来 —— 提交交给既有「到点自动交差」。
   *   节流间隔内 / 无可接的活儿 → 返回 null（不产生日志与写盘）。
   * @returns {null|{started:number, instant:number, contrib:number, results:object[]}}
   */
  autoStartTick (now = Date.now(), opts = {}) {
    const intervalMs = opts.intervalMs == null ? 1500 : Math.max(0, opts.intervalMs | 0)
    if (now - (this._autoStartAt | 0) < intervalMs) return null
    this._autoStartAt = now
    const out = this.startAllOpen(now)
    return out.started > 0 ? out : null
  }

  /**
   * 一键提交：把所有**已到点（满额）**的槽位一次交差
   *   （V4.7 主人 2026-09-18 修订：面板不再单列「一键提交」按钮 —— 提交由主循环
   *    「到点自动交差」负责；本方法作为批量提交入口保留，供后续做「提前交差全部」时复用）
   * @returns {{ok:boolean, claimed:number, contrib:number, failed:number, results:object[]}}
   */
  claimAllDone (now = Date.now()) {
    const out = { ok: false, claimed: 0, contrib: 0, failed: 0, results: [] }
    if (!this.joined) {
      out.results.push({ ok: false, message: '尚未拜入宗门。' })
      return out
    }
    const slots = this.s.slots || []
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      if (!slot || slot.state !== 'running') continue
      if (!this.taskDefOf(slot)) continue
      if (!this.progressOf(slot, now).done) continue   // 未到点：不动（不替玩家折损）
      const r = this.claimTask(i, now)
      out.results.push({ ...r, index: i })
      if (r.ok) {
        out.claimed += 1
        out.contrib += r.contrib | 0
        if (r.success === false) out.failed += 1
      }
    }
    out.ok = out.claimed > 0
    return out
  }

  // ── 藏经阁 / 商店 ───────────────────────────────────────────────────────

  /** 贡献兑换功法（落到 tech.ownedTechniques，1 级；去功法面板自行装备） */
  buyLibrary (id) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    // V6.12 批 G4：条目源扩为「静态 LIBRARY ＋ 本宗传承」（见 _libEntries）
    const entry = this._libEntries().find((x) => x.id === id)
    if (!entry) return { ok: false, message: '藏经阁没有这部功法。' }
    const t = getTechnique(id)
    if (!t) return { ok: false, message: '功法登记缺失，暂不可借阅。' }
    if (this.rankMeta.idx < entry.rank) return { ok: false, message: `${RANKS[entry.rank].name}方可入${entry.rank === 1 ? '二' : '一'}层借阅。` }
    if (this.tech && this.tech.has(id)) return { ok: false, message: `《${t.name}》已在囊中。` }
    // V6.12 批 G4：顶级专属本**仍卡灵根硬门槛** —— 旧实现直写 `owned` 会绕过 canLearn
    if (t.rootReq && this.tech && typeof this.tech.canLearn === 'function') {
      const chk = this.tech.canLearn(id)
      if (!chk.ok) return { ok: false, message: chk.text || '资格不足，暂不可借阅。' }
    }
    if (this.contribution < entry.cost) {
      return { ok: false, message: `贡献不足：借阅《${t.name}》需 ${entry.cost}，还差 ${entry.cost - this.contribution}。` }
    }
    this.state.resources.contribution = this.contribution - entry.cost
    if (this.tech) this.tech.owned[id] = { level: 1 }
    const tag = entry.top ? '（顶级传承）' : (entry.isHeritage ? '（本宗传承）' : '')
    return { ok: true, message: `以 ${entry.cost} 贡献借得《${t.name}》${tag}——去功法面板装槽即可生效。` }
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

  // ── V5.5 弟子线（首批：收徒 → 培养 → 职权 → 贡献）───────────────────────────
  // 设计源：设计库《宗门与弟子 v1》第二部分；参数全在 src/data/disciples.js
  //   · 产出只给**材料 / 宗门贡献 / 灵石**，**不发境界**（§七 硬护栏）
  //   · 灵石在 tick() 内入账 → 归因自动落既有 `sect` 线（不新增线）
  //   · 存档叶子 state.sect.disciples（懒建兜底，零迁移）

  /** 弟子子树（懒建见 `s` getter） */
  get d () {
    return this.s.disciples
  }

  /** 玩家基准产出（灵气/秒）——传功代价按它折算「当量 h」 */
  get baseQiPerSec () {
    return getLevelInfo(this.state.player.realm.level).output.qiPerSec
  }

  /** 灵石时薪（当量 h 折灵石，与秘境 / 事件同一口径 stoneHourly） */
  stonePerHour () {
    return stoneHourly(this.state.player.realm.level)
  }

  /** 当量 h → 灵气（传功代价用） */
  hToQi (h) {
    return Math.max(0, Math.round(this.baseQiPerSec * Math.max(0, Number(h) || 0) * 3600))
  }

  /**
   * 收徒资格 / 名额 / 两种方式的可用态（纯读；面板与自测共用同一口径）
   *   开启条件（设计库 §2.1）：金丹期 + 真传名分；名额见 data/disciples.js slotsOf
   */
  recruitGate (now = Date.now()) {
    const rankIdx = this.rankMeta.idx
    const realmIdx = this.realmIndex
    const slots = slotsOf(realmIdx, rankIdx)
    const used = this.d.list.length
    const open = this.joined && slots > 0
    const free = Math.max(0, slots - used)
    // ⚠ 毫秒时间戳禁用 `| 0`（32 位溢出，见开发册 §7 环境坑）——一律 Number(x) || 0
    const readyAt = (Number(this.d.gazeAt) || 0) + recruitCooldownMs()
    return {
      open,
      realmOk: realmIdx >= RECRUIT.realmIndex,
      rankOk: rankIdx >= RECRUIT.rankIdx,
      realmName: getRealmMeta(RECRUIT.realmIndex).name,
      rankName: RANKS[RECRUIT.rankIdx].name,
      slots,
      used,
      free,
      full: used >= slots,
      canGaze: open && free > 0 && now >= readyAt,
      gazeInMs: Math.max(0, readyAt - now),
      cooldownMs: recruitCooldownMs(),
      inspectCost: RECRUIT.inspectCost,
      inspectLift: RECRUIT.inspectLift,
      contribution: this.contribution,
      canInspect: open && free > 0 && this.contribution >= RECRUIT.inspectCost,
      pity: this.d.pity | 0,
      pityNeed: PITY.streak,
      maxSlots: RECRUIT.maxSlots,
      aptitudes: APTITUDES,
      posts: POSTS,
      reserved: POSTS_RESERVED,
      capH: DISCIPLE_CAP_H_PER_DAY
    }
  }

  /**
   * 掷一名弟子（观礼 / 相看共用）
   *   资质含保底（连续 PITY.streak 次未出变异以上 → 好资质权重 ×2，封顶 ×3，见 aptWeights）
   *   lift＝相看：该弟子资质系数整体上浮 RECRUIT.inspectLift（成长与产出同时 +10%）
   */
  _recruit (now = Date.now(), opts = {}) {
    const gate = this.recruitGate(now)
    if (!gate.open) {
      return { ok: false, message: `收徒未开启：需${gate.realmName}期修为，且列身${gate.rankName}。` }
    }
    if (gate.full) {
      return { ok: false, message: `门下已满（${gate.used}/${gate.slots}）：每晋一大境界 +1 名额，首座 +2、掌门 +3，至多 ${gate.maxSlots} 名。` }
    }
    const d = this.d
    const streak = d.pity | 0
    const aptId = rollAptitude(Math.random(), streak, false)
    const good = aptId === 'bianyi' || aptId === 'tian'
    d.pity = good ? 0 : Math.min(999, streak + 1)
    const seq = (d.seq | 0) + 1
    d.seq = seq
    const spec = rollSpecialty(Math.random())
    const rec = {
      uid: `disc${seq}`,
      name: rollName(Math.random(), Math.random()),
      apt: aptId,
      wits: rollWits(Math.random()),
      spec,
      mat: specMaterial(spec, seq),
      lv: 1,
      exp: 0,                 // 预留（经验条 / 出师，后续批）
      post: null,             // 未派职
      lift: opts.lift ? RECRUIT.inspectLift : 0,
      bornAt: now
    }
    d.list.push(rec)
    const a = aptById(rec.apt)
    const aptText = good && streak >= PITY.streak ? `${a.name}（保底兑现）` : a.name
    return {
      ok: true,
      disciple: rec,
      message: `${opts.lift ? '相看' : '观礼'}得徒：${rec.name}（${aptText} · 悟性 ${rec.wits} · 特长${specById(rec.spec).name}），已录入门墙。`
    }
  }

  /** 观礼收徒（免费，每 3 游戏天一次） */
  recruitByGaze (now = Date.now()) {
    const gate = this.recruitGate(now)
    if (!gate.canGaze) {
      if (!gate.open) return { ok: false, message: `收徒未开启：需${gate.realmName}期修为，且列身${gate.rankName}。` }
      if (gate.full) return { ok: false, message: `门下已满（${gate.used}/${gate.slots}）。` }
      const waitSec = Math.max(1, Math.ceil(gate.gazeInMs / 1000))
      return { ok: false, message: `观礼之期未到：还需约 ${waitSec} 秒（每 3 游戏天可观礼一次）。` }
    }
    const r = this._recruit(now, { lift: false })
    if (r.ok) this.d.gazeAt = now
    return r
  }

  /** 相看收徒（200 贡献；该弟子资质系数整体上浮 10%） */
  recruitByInspect (now = Date.now()) {
    const gate = this.recruitGate(now)
    if (!gate.open) return { ok: false, message: `收徒未开启：需${gate.realmName}期修为，且列身${gate.rankName}。` }
    if (gate.full) return { ok: false, message: `门下已满（${gate.used}/${gate.slots}）。` }
    if (this.contribution < RECRUIT.inspectCost) {
      return { ok: false, cost: RECRUIT.inspectCost, message: `相看需 ${RECRUIT.inspectCost} 贡献（现有 ${this.contribution}）。` }
    }
    const r = this._recruit(now, { lift: true })
    if (r.ok) this.state.resources.contribution = this.contribution - RECRUIT.inspectCost
    return { ...r, cost: r.ok ? RECRUIT.inspectCost : 0 }
  }

  /** 传功信息（代价 + 负担性；纯读） */
  trainInfo (uid) {
    const d = (this.d.list || []).find((x) => x.uid === uid)
    if (!d) return { ok: false }
    const lv = Math.max(1, d.lv | 0)
    const maxed = lv >= DISCIPLE_LV.max
    const h = trainCostH(d)
    const qi = this.hToQi(h)
    return {
      ok: true,
      uid,
      name: d.name,
      lv,
      max: DISCIPLE_LV.max,
      maxed,
      h,
      qi,
      have: this.state.resources.qi,
      affordable: !maxed && this.state.resources.qi >= qi
    }
  }

  /**
   * 传功（培养）：耗灵气送弟子一级（首批简化＝一次传功进一级，经验条留后续批）
   *   代价随等级指数升、随成长系数反比降（见 data/disciples.js trainCostH）
   *   返回 cost（灵气）供装配层回传归因：属「宗门线支出」，记负额
   */
  train (uid) {
    const info = this.trainInfo(uid)
    if (!info.ok) return { ok: false, message: '门下没有这名弟子。' }
    if (info.maxed) return { ok: false, message: `${info.name}已至第 ${info.max} 级，进无可进。` }
    if (!info.affordable) {
      return { ok: false, cost: info.qi, message: `传功需 ${fmtShort(info.qi)} 修为（现有 ${fmtShort(this.state.resources.qi)}）。` }
    }
    this.state.resources.qi -= info.qi
    const d = this.d.list.find((x) => x.uid === uid)
    if (d.captured) return { ok: false, message: `${d.name}尚遭掳禁，先救援回山再传功。` }
    d.lv = Math.max(1, d.lv | 0) + 1
    // V5.5.1：传功温情，忠诚 +trainHeal（设计库 §2.5 忠诚口径）
    d.loyalty = Math.min(LOYALTY.max, (Number(d.loyalty) || 0) + LOYALTY.trainHeal)
    return {
      ok: true,
      uid,
      name: d.name,
      cost: info.qi,
      lv: d.lv,
      message: `传功毕：${d.name}修为进至第 ${d.lv} 级（耗灵气 ${fmtShort(info.qi)}）。`
    }
  }

  /**
   * 派职 / 撤职（职权）
   *   postId 传 null / 'none' / '' → 撤下回山静修
   */
  assignPost (uid, postId) {
    const d = (this.d.list || []).find((x) => x.uid === uid)
    if (!d) return { ok: false, message: '门下没有这名弟子。' }
    // V5.5.1：被掳期间不派职（人都不在山上）
    if (d.captured) return { ok: false, message: `${d.name}尚遭掳禁，先救援回山再派职。` }
    if (postId == null || postId === 'none' || postId === '') {
      d.post = null
      return { ok: true, uid, post: null, message: `${d.name}已卸去职司，回山静修（不再产出）。` }
    }
    const p = postById(postId)
    if (!p) return { ok: false, message: '宗门里没有这个职司。' }
    d.post = p.id
    const fit = specFitsPost(d, p.id) ? '（特长对口 · 产出 +30%）' : ''
    return { ok: true, uid, post: p.id, message: `${d.name}领${p.name}之职${fit}：${p.desc}` }
  }

  /**
   * 弟子线产出统计（纯读；面板与自测共用，也是「静态量级预估」的口径来源）
   *   rawHPerDay＝未封顶合计 → scale＝封顶缩放 → hPerDay/contribPerDay/stonesPerDay/matsPerDay
   */
  discipleStats () {
    const list = this.d.list || []
    // V5.5.1：被掳弟子不产出（rate 记 0，不影响在岗弟子的封顶缩放）
    const rateOf = (x) => (x.captured ? 0 : discipleRateH(x, x.post))
    const scale = capScale(list.reduce((s, x) => s + rateOf(x), 0))
    const stoneH = this.stonePerHour()
    let h = 0
    let contrib = 0
    let stones = 0
    let mats = 0
    for (const x of list) {
      const p = postById(x.post)
      if (!p || x.captured) continue
      const r = discipleRateH(x, x.post) * scale
      h += r
      contrib += r * p.contribPerH
      if (p.stones) stones += r * stoneH
      if (p.matPerH > 0) mats += r * p.matPerH
    }
    return {
      count: list.length,
      posted: list.filter((x) => !!x.post && !x.captured).length,
      slots: this.slotCount(),
      rawHPerDay: list.reduce((s, x) => s + rateOf(x), 0),
      scale,
      capH: DISCIPLE_CAP_H_PER_DAY,
      hPerDay: h,
      hPerHour: h / 24,
      contribPerDay: Math.round(contrib),
      stonesPerDay: Math.round(stones),
      stonesPerHour: stones / 24,
      matsPerDay: mats,
      stoneHourly: stoneH
    }
  }

  /** 名额（未入宗 / 未开启时回落 0，面板不必另判） */
  slotCount () {
    return slotsOf(this.realmIndex, this.rankMeta.idx)
  }

  /**
   * 弟子产出一拍（由 tick 内调用）
   *   按「每现实日当量 h ÷ 86400」逐秒累计，取整后入账：
   *     贡献 → earnContribution（货币 + 累计双线，与任务同通道）
   *     灵石 → resources.stones（**在主循环快照窗口内 → 归因落既有 sect 线**）
   *     材料 → inventory.items[x.mat]（同宗门任务口径，不入台账）
   *
   * ⚠ 小数位累计器挂在**子树聚合层**（disciples.accC / accS / accM）而不是逐名弟子：
   *   封顶后 9 名弟子每名仅 ≈0.267 当量 h/日，若逐人取整会被 floor 吃光（材料永远 0 份）。
   */
  _tickDisciples (now = Date.now(), dtSec = 0) {
    const out = { contrib: 0, stones: 0, mats: 0 }
    if (!this.joined || !(dtSec > 0)) return out
    const dl = this.d
    const list = dl.list
    if (!list.length) return out
    const stats = this.discipleStats()
    const stoneH = stats.stoneHourly
    let dC = 0
    let dS = 0
    const dM = {}
    for (const x of list) {
      const p = postById(x.post)
      if (!p || x.captured) continue   // V5.5.1：被掳不产出
      const dh = discipleRateH(x, x.post) * stats.scale / DAY_SEC * dtSec   // 本拍当量 h
      dC += dh * p.contribPerH
      if (p.stones) dS += dh * stoneH
      if (p.matPerH > 0 && x.mat) dM[x.mat] = (dM[x.mat] || 0) + dh * p.matPerH
    }
    dl.accC = (Number(dl.accC) || 0) + dC
    dl.accS = (Number(dl.accS) || 0) + dS
    // ⚠ 小数位逐秒累加后 floor；封顶档（如 2.0h/日×40）浮点求和可能落到 79.9999…
    //    故 floor 加 1e-6 容差（<1、远大于 ~1e-13 浮点噪声，不引入任何系统性多付）
    const FL = 1e-6
    const nC = Math.floor(dl.accC + FL)
    if (nC > 0) {
      dl.accC -= nC
      this.earnContribution(nC)
      out.contrib = nC
    }
    const nS = Math.floor(dl.accS + FL)
    if (nS > 0) {
      dl.accS -= nS
      // ⚠ 大数禁 `| 0`（32 位溢出）：灵气/灵石都可冲到 1e9 以上
      this.state.resources.stones = (Number(this.state.resources.stones) || 0) + nS
      out.stones = nS
    }
    const accM = dl.accM || (dl.accM = {})
    const inv = this.state.inventory.items
    let nM = 0
    for (const id of Object.keys(dM)) accM[id] = (Number(accM[id]) || 0) + dM[id]
    // 各材料先发 floor 的整数部分，余数归正到 [0,1)；分池各 <1 时会吃掉总量，
    // 故再用**最大余数法**把合计小数位（floor 后）补发的整数份分给余数最大的材料 —— 材料产出贴合名义当量
    const mids = Object.keys(accM)
    for (const id of mids) {
      const n = Math.floor(accM[id] + FL)
      if (n > 0) { inv[id] = (inv[id] | 0) + n; nM += n }
      accM[id] -= n   // 归正为余数 ∈ [0,1)
    }
    const extra = Math.floor(mids.reduce((s, id) => s + accM[id], 0) + FL)
    if (extra > 0) {
      const order = mids.slice().sort((a, b) => accM[b] - accM[a])
      for (let i = 0; i < extra; i++) {
        const id = order[i % order.length]
        inv[id] = (inv[id] | 0) + 1
        nM += 1
        accM[id] -= 1   // 记一笔「已发」的债，后续累计自行回正
      }
    }
    out.mats = nM
    return out
  }

  /** 弟子列表视图（面板渲染用，纯读） */
  disciplesView () {
    const stats = this.discipleStats()
    const list = (this.d.list || []).map((x) => {
      const a = aptById(x.apt)
      const w = witById(x.wits)
      const sp = specById(x.spec)
      const p = postById(x.post)
      const info = this.trainInfo(x.uid)
      return {
        uid: x.uid,
        name: x.name,
        lv: Math.max(1, x.lv | 0),
        lvMax: DISCIPLE_LV.max,
        apt: a,
        wits: w,
        spec: sp,
        lift: x.lift || 0,
        matName: x.mat ? getItem(x.mat).name : '',
        postId: x.post || null,
        post: p,
        fit: p ? specFitsPost(x, p.id) : false,
        growth: discipleGrowth(x),
        output: discipleOutput(x),
        rateH: x.captured ? 0 : discipleRateH(x, x.post) * stats.scale,   // 已封顶折算后的每日当量
        rawRateH: discipleRateH(x, x.post),
        trainQi: info.qi || 0,
        trainMaxed: !!info.maxed,
        trainAffordable: !!info.affordable,
        loyalty: Math.round(Number(x.loyalty) || 0),      // V5.5.1：忠诚 0~100
        captured: !!x.captured,                            // V5.5.1：被掳中（不产出，可救援）
        posts: POSTS.map((pp) => ({
          id: pp.id,
          name: pp.name,
          active: pp.id === x.post,
          fit: specFitsPost(x, pp.id)
        }))
      }
    })
    return {
      stats,
      list,
      gate: this.recruitGate(),
      reserved: POSTS_RESERVED,
      // V5.5.1：忠诚口径 / 救援价码 / 师徒近事（最近 5 条倒序）
      loyaltyMeta: LOYALTY,
      eventDays: DISC_EVENTS.periodDays,
      rescueCost: rescueCostOf(this.realmIndex),
      events: (this.d.log || []).slice(-5).reverse()
    }
  }

  // ── V5.5.1 弟子线后续批（B2）：周常·供奉 / 周常·大比 / 忠诚与师徒事件 ─────────
  // 设计源：设计库《宗门与弟子 v1》§1.3（周常两条）· §2.5（师徒风险事件）
  //   · 周期与任务板同源（7 游戏天 ≈ 现实 7 分钟），各自记周期键幂等
  //   · 供奉 / 大比只动「贡献」（不入 §七 灵石台账）；事件赔付取小值（见 data 层注释）
  //   · 灵石赔付在 tick() 快照窗口内 → 落既有 `sect` 归因线，不新增线

  /** 供奉信息（纯读）：行囊里有货值的材料各一行（至多 4 行，按可换贡献降序） */
  offerInfo (now = Date.now()) {
    const inv = (this.state.inventory && this.state.inventory.items) || {}
    const rows = []
    for (const id of Object.keys(inv)) {
      const have = inv[id] | 0
      const v = getGoodsValue(id)
      if (have <= 0 || !(v > 0)) continue
      const units = Math.min(have, OFFERING.maxUnits)
      rows.push({ id, name: getItem(id).name, have, units, perUnit: v, contrib: offeringContrib(v, units) })
    }
    rows.sort((a, b) => b.contrib - a.contrib)
    return {
      joined: this.joined,
      rate: OFFERING.rate,
      maxUnits: OFFERING.maxUnits,
      done: this.s.offerKey === sectDayKey(now),
      rows: rows.slice(0, 4)
    }
  }

  /**
   * 供奉（周常）：捐出某材料至多 OFFERING.maxUnits 份 → 贡献 = 货值 × 份数 × 1.2
   *   每轮（7 游戏天）限一次（offerKey 幂等）——堵「商店买符纸 → 供奉回血」的刷贡献回路
   */
  offer (id, now = Date.now()) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    const key = sectDayKey(now)
    if (this.s.offerKey === key) {
      return { ok: false, message: `本轮已供奉过（周常，每 ${SECT_REFRESH_DAYS} 游戏天一次）。` }
    }
    const inv = this.state.inventory.items
    const have = inv[id] | 0
    const v = getGoodsValue(id)
    if (!(have > 0) || !(v > 0)) return { ok: false, message: '行囊里没有可供奉的材料。' }
    const units = Math.min(have, OFFERING.maxUnits)
    const contrib = offeringContrib(v, units)
    inv[id] = have - units
    this.s.offerKey = key
    this.earnContribution(contrib)
    return {
      ok: true,
      id,
      units,
      contrib,
      message: `供奉 ${getItem(id).name} ×${units}（货值折算 ×${OFFERING.rate}）：贡献 +${contrib}。`
    }
  }

  /** 大比信息（纯读）：本届是否已赴 / 荣誉累计 / 贡献带（已按境界缩放） */
  dabiInfo (now = Date.now()) {
    const d = this.s.dabi
    const done = d.key === dabiKeyOf(now)
    return {
      joined: this.joined,
      days: DABI.days,
      done,
      canClaim: this.joined && !done,
      wins: d.wins | 0,
      best: d.best | 0,
      title: d.title || '',
      req: Math.round(this.basePower * DABI.reqMul),
      lo: dabiContribOf(0.25, this.realmIndex),
      hi: dabiContribOf(0.95, this.realmIndex),
      nextInMs: dabiMsToNext(now)
    }
  }

  /**
   * 当前世界 id（V6.4 批 D3；只读直读 `state.world.worldId`，照 DungeonSystem.worldId 惯例**不经懒建**）。
   * 未抽定 / 未登记界 → `''`，大比头衔回落 `DABI` 原字面。
   */
  get worldId () {
    const w = this.state.world
    return (w && typeof w === 'object' && typeof w.worldId === 'string') ? w.worldId : ''
  }

  /**
   * 赴大比（周常）：战力比率（当前战力 / 基准战力 × reqMul，clamp 0.25~0.95）
   *   → 贡献带内插值 × 境界增长；rate ≥ 0.9 记魁首（wins+1）
   *   设计稿的「＋灵石」奖已裁除（压缩日历下会放大 ~205 倍/日顶破 §七，见 data/sect.js DABI 注释）
   */
  claimDabi (now = Date.now()) {
    if (!this.joined) return { ok: false, message: '尚未拜入宗门。' }
    const d = this.s.dabi
    const key = dabiKeyOf(now)
    if (d.key === key) return { ok: false, message: `本届大比已经赴过（周常，每 ${DABI.days} 游戏天一届）。` }
    const req = Math.max(1, Math.round(this.basePower * DABI.reqMul))
    const rate = clamp(this.power / req, 0.25, 0.95)
    const contrib = dabiContribOf(rate, this.realmIndex)
    // V6.4 批 D3：头衔按当前世界取（未抽定 / 未登记界回落 DABI 原字面，默认界逐位不变）
    const title = dabiTitleOf(this.worldId, rate >= 0.9 ? 'top' : rate >= 0.6 ? 'mid' : 'low')
    d.key = key
    if (rate >= 0.9) d.wins = (d.wins | 0) + 1
    d.best = Math.max(d.best | 0, contrib)
    d.title = title
    this.earnContribution(contrib)
    return {
      ok: true,
      contrib,
      title,
      rate,
      message: `宗门大比：以战力 ${fmtShort(this.power)} 对定标 ${fmtShort(req)}——${title}，贡献 +${contrib}。`
    }
  }

  /**
   * 救援被掳弟子：花贡献赎人（价码随境界，见 data/disciples.js rescueCostOf），忠诚 +5
   */
  rescue (uid, now = Date.now()) {
    const d = (this.d.list || []).find((x) => x.uid === uid)
    if (!d) return { ok: false, message: '门下没有这名弟子。' }
    if (!d.captured) return { ok: false, message: `${d.name}好端端在山上，无须救援。` }
    const cost = rescueCostOf(this.realmIndex)
    if (this.contribution < cost) {
      return { ok: false, cost, message: `救援需 ${cost} 贡献（现有 ${this.contribution}）。` }
    }
    this.state.resources.contribution = this.contribution - cost
    d.captured = false
    d.loyalty = clampLoyalty((Number(d.loyalty) || 0) + DISC_EVENTS.dLoyalty.rescue)
    this._pushEvt(now, `以 ${cost} 贡献寻回${d.name}，师徒情分更笃（忠诚 +${DISC_EVENTS.dLoyalty.rescue}）。`)
    return { ok: true, uid, cost, message: `以 ${cost} 贡献寻回${d.name}，师徒情分更笃（忠诚 +${DISC_EVENTS.dLoyalty.rescue}）。` }
  }

  /** 师徒近事台账（封 DISC_EVENTS.logCap 条；面板展示用，系统日志由装配层按 events 自行打） */
  _pushEvt (now, text) {
    const log = this.d.log
    log.push({ at: now, text })
    if (log.length > DISC_EVENTS.logCap) log.splice(0, log.length - DISC_EVENTS.logCap)
  }

  /**
   * 师徒风险事件掷点（设计库 §2.5；由 tick() 调用，每个事件轮至多掷一次）
   *   ① 叛离检查：忠诚 < 30 → 弟子不辞而别（轻惩罚＝失去该弟子与其产出，名额腾出）
   *   ② 被掳弟子自行脱困：忠诚 −15（上轮被掳、没救援的）
   *   ③ 每名在山弟子 chance 概率掷一条：闯祸（赔灵石）/ 被掳 / 带宝而归 / 恩义（+贡献）
   *   首个事件轮只记键不掷事件——老档 / 新档接入的当拍不爆，事件从下一轮起算
   * @returns {Array<object>} 本拍的事件清单（供装配层打日志；空数组＝无事发生）
   */
  _tickDiscipleEvents (now = Date.now()) {
    const out = []
    if (!this.joined) return out
    const dl = this.d
    const list = dl.list
    if (!list.length) return out
    const key = discEventKeyOf(now)
    if (!dl.evtKey) { dl.evtKey = key; return out }   // 首轮只记键（见方法注释）
    if (dl.evtKey === key) return out
    dl.evtKey = key
    const stoneH = this.stonePerHour()
    const growth = 1 + CONTRIB_GROWTH * Math.min(CONTRIB_REALM_CAP, this.realmIndex)
    const dL = DISC_EVENTS.dLoyalty

    // ① 叛离（轻惩罚：失去弟子与其产出，名额腾出）
    for (let i = list.length - 1; i >= 0; i--) {
      const x = list[i]
      if ((Number(x.loyalty) || 0) < LOYALTY.revoltAt) {
        list.splice(i, 1)
        this._pushEvt(now, `${x.name}忠诚 ${Math.round(Number(x.loyalty) || 0)}，心生去意，不辞而别（门墙空出一个名额）。`)
        out.push({ type: 'revolt', uid: x.uid, name: x.name })
      }
    }
    // ② 被掳弟子自行脱困（上轮被掳且未救援）
    for (const x of list) {
      if (x.captured) {
        x.captured = false
        x.loyalty = clampLoyalty((Number(x.loyalty) || 0) + dL.capturedReturn)
        this._pushEvt(now, `${x.name}被掳多日，自行脱困归山（忠诚 ${dL.capturedReturn}）。`)
        out.push({ type: 'captured-return', uid: x.uid, name: x.name })
      }
    }
    // ③ 新事件（被掳中的不掷）
    for (const x of list) {
      if (x.captured) continue
      if (Math.random() >= DISC_EVENTS.chance) continue
      const type = rollDiscEvent(Math.random())
      if (type === 'trouble') {
        const loss = Math.max(1, Math.round(stoneH * DISC_EVENTS.troubleStoneH))
        this.state.resources.stones = Math.max(0, (Number(this.state.resources.stones) || 0) - loss)
        x.loyalty = clampLoyalty((Number(x.loyalty) || 0) + dL.trouble)
        this._pushEvt(now, `${x.name}在外闯祸，师父代为赔了 ${loss} 灵石（忠诚 ${dL.trouble}）。`)
        out.push({ type: 'trouble', uid: x.uid, name: x.name, stones: -loss })
      } else if (type === 'captured') {
        x.captured = true
        this._pushEvt(now, `${x.name}外出未归，恐遭掳劫——可点「救援」以贡献赎人，否则下一轮自行脱困（忠诚受损）。`)
        out.push({ type: 'captured', uid: x.uid, name: x.name })
      } else if (type === 'treasure') {
        const inv = this.state.inventory.items
        inv[DISC_EVENTS.treasureMat] = (inv[DISC_EVENTS.treasureMat] | 0) + 1
        x.loyalty = clampLoyalty((Number(x.loyalty) || 0) + dL.treasure)
        this._pushEvt(now, `${x.name}带宝而归：${getItem(DISC_EVENTS.treasureMat).name} +1（忠诚 +${dL.treasure}）。`)
        out.push({ type: 'treasure', uid: x.uid, name: x.name, mat: DISC_EVENTS.treasureMat })
      } else {
        const c = Math.max(1, Math.round(DISC_EVENTS.graceContrib * growth))
        this.earnContribution(c)
        x.loyalty = clampLoyalty((Number(x.loyalty) || 0) + dL.grace)
        this._pushEvt(now, `师徒恩义：${x.name}奉上孝敬，贡献 +${c}（忠诚 +${dL.grace}）。`)
        out.push({ type: 'grace', uid: x.uid, name: x.name, contrib: c })
      }
    }
    return out
  }

  // ── 视图（装配层渲染用，纯读）────────────────────────────────────────────

  /**
   * 名册条目 → 面板视图。**保留旧字段 `daoTong`**（`{id,name,desc}`）——
   *   面板既有渲染读的是 `info.sect.daoTong.*`，归一后 UI 侧零连锁改动。
   *   兼容两种来源形状：名册条目（有 `dao`）与旧表 `SECT`（有 `daoTong`）。
   */
  _sectView (x) {
    if (!x) return null
    const daoId = x.dao || (x.daoTong && x.daoTong.id) || 'law'
    const dao = SECT_DAO[daoId] || (x.daoTong || { name: '—', desc: '' })
    return {
      id: x.id,
      name: x.name,
      dao: daoId,
      align: x.align || '正',
      intro: x.intro,
      techs: x.techs || [],
      origin: x.origin || '项目',
      daoTong: { id: daoId, name: dao.name, desc: dao.desc }
    }
  }

  infoView (now = Date.now()) {
    if (!this.joined) {
      // V6.12 批 G4：未入宗时给**本界默认宗**作推荐入口（面板同时列出 8 宗名册供选）
      return {
        joined: false,
        sect: this._sectView(this.homeSect),
        roster: this.rosterView(),
        daoBonus: this.daoBonus
      }
    }
    const cur = this.rankMeta
    const promo = this.promoInfo()
    return {
      joined: true,
      sect: this._sectView(this.currentSect || this.homeSect),
      roster: this.rosterView(),
      daoBonus: this.daoBonus,
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
      // V6.12 批 G5c：任务的**名称与描述按当前职位分叉**（取满足 minRank 的最高一档变体）；
      //   面板一律读 `title` / `descText`，`def.name` / `def.desc` 仍作兜底原值。
      const tx = taskTextOf(def, this.s.rank | 0)
      return {
        index: i,
        def,
        title: tx.name,
        descText: tx.desc,
        minRank: def.minRank | 0,
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

  /**
   * 藏经阁条目（V6.12 批 G4 扩展）：静态 `LIBRARY` ＋ **本宗传承**（该宗 `techs` 里的专属功法）。
   *   传承本按品阶定价；**顶级专属本（有 `rootReq`）价 ×3 且需执事长老** ——
   *   「高价 ＋ 高职级 ＋ 灵根硬门槛」三者共同承担「难获取」，**不以境界限制卡人**。
   */
  _libEntries () {
    const out = LIBRARY.map((e) => ({ ...e, isHeritage: false, top: false }))
    const cur = this.currentSect
    if (!cur) return out
    const tierCost = { fan: 500, huang: 3000, xuan: 8000, di: 20000, tian: 40000 }
    const tierRank = { fan: 0, huang: 1, xuan: 1, di: 2, tian: 2 }
    for (const id of (cur.techs || [])) {
      const t = getTechnique(id)
      if (!t) continue
      if (out.some((e) => e.id === id)) continue
      const top = !!t.rootReq
      out.push({
        id,
        cost: (tierCost[t.tier] || 20000) * (top ? 3 : 1),
        rank: top ? 3 : (tierRank[t.tier] || 1),
        isHeritage: true,
        top
      })
    }
    return out
  }

  libraryView () {
    return this._libEntries().map((e) => {
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
    // V7.3：按界补货（常驻 10 条 ＋ 本界 2 件材料）；未抽定世界 → 与改前逐位一致
    const wid = (this.state.world && this.state.world.worldId) || null
    return shopOf(wid).map((e) => {
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
