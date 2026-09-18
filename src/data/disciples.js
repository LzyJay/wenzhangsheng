/**
 * disciples.js —— 弟子表（只读配置层）（V5.5 弟子线首批）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《挂机修仙·宗门与弟子 v1》
 *         §1.2 职级与俸禄（收徒名额：首座 +2 / 掌门 +3）
 *         §2.1 收徒（开启条件 · 名额 · 观礼 / 相看）
 *         §2.2 弟子资质（四档概率与系数 · 保底条款 · 悟性 · 特长）
 *         §2.3 弟子用途（作坊帮工 / 派遣任务 / 助战 / 代管）
 *         §2.4 成长与出师（传功消耗）
 *         第三部分 平衡与占比（弟子产出 中期 1.2h/日 · 后期 2.4h/日 · 宗门＋弟子 ≤15%）
 *       + 《问长生-开发计划》§4.4（弟子行）· §4.1b（V5.5 排期）· §七（宗门线 ≤15%）
 *
 * 范围（首批）：收徒 → 培养 → 职权 → 贡献 四件事闭环。
 *   · 助战 / 代管（设计库 §2.3 后两条）＝ **预留**，见 POSTS_RESERVED（需接 powerMul 乘区，后续批）
 *   · 师徒风险事件（§2.5）＝ **V5.5.1 已实装**（忠诚 + 四条掷点事件，见第 ⑦ 段）
 *   · 出师门客（§2.4）· 藏经阁分层 / 个人洞府（§1.4）＝ 后续批（需接全产乘区 / 装配层）
 *
 * 口径（本文件即单点旋钮，全部参数在此，SectSystem 只读不硬编码）：
 *   · **产出不发境界**：弟子只产材料 / 宗门贡献 / 灵石（§七 硬护栏）
 *   · 「日」＝ **现实日**（86400 现实秒）——与俸禄表 salaryHours/日 同口径；
 *     设计库平衡表「中期 1.2h/日 / 后期 2.4h/日」按此读法自洽（3~4 名 × 0.3h ≈ 1.2h）
 *   · 「当量 h」＝ 1 小时等效基准产出（与秘境 / 事件 / 俸禄同一量纲，折灵石走 stoneHourly）
 *   · 观礼冷却按 **游戏天**（设计库 §2.1「每 3 天一次」）：1 游戏天 = 1 现实分钟，
 *     3 游戏天 ≈ 现实 3 分钟 —— 与宗门任务板 7 游戏天同源；若按现实 3 天，
 *     挂机引擎会被现实日期锁死，故取 gametime 口径
 *   · 存档叶子：state.sect.disciples（SectSystem.s getter 懒建，**零迁移**，不改 SaveSystem）
 *   · **主人 2026-09-19 拍板三条**：① 产出封顶 `DISCIPLE_CAP_H_PER_DAY` 由设计稿后期口径
 *     2.4h/日 **下调至 2.0h/日**；② 观礼冷却取**游戏天**口径（3 游戏天 ≈ 现实 3 分钟，与宗门
 *     任务板 7 游戏天同源），不取现实 3 天；③ 相看「品质档位 +10% 上浮」的落地＝该弟子
 *     **成长系数与产出系数同时 ×1.1**（`RECRUIT.inspectLift`），与 `lift` 字段同口径。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { gameDaysToMs, periodKeyOf } from './gametime.js'

// ── ① 收徒（设计库 §2.1）─────────────────────────────────────────────────────

/** 收徒门槛 / 名额 / 两种收徒方式（观礼免费 · 相看 200 贡献） */
export const RECRUIT = {
  realmIndex: 2,        // 开启条件①：金丹期（realmIndex 2）
  rankIdx: 2,           // 开启条件②：「真传弟子」名分（RANKS[2]）
  baseSlots: 1,         // 初始 1 个名额
  slotsPerRealm: 1,     // 每晋升一大境界 +1（自开启境界起算）
  rankBonus: { 4: 2, 5: 3 },   // 首座 +2 / 掌门 +3（设计库 §1.2）
  maxSlots: 9,          // 上限 9 名（设计库 §2.1）
  gazeCooldownDays: 3,  // 观礼：免费，每 3 游戏天一次（§2.1「每 3 天一次」）
  inspectCost: 200,     // 相看：200 贡献（§2.1）
  inspectLift: 0.1      // 相看：该弟子「品质档位 +10% 上浮」——落地上浮于资质系数
                        //   （design 原文未言明加成方式；本实现＝成长系数与产出系数同时 ×1.1，单点可调）
}

/** 观礼冷却（现实毫秒；按游戏天口径，见头注释） */
export function recruitCooldownMs () {
  return gameDaysToMs(RECRUIT.gazeCooldownDays)
}

/**
 * 名额（0 ＝ 尚未开启收徒）
 *   金丹起 + 真传名分 → 1 名；此后每晋一大境界 +1；首座 +2 / 掌门 +3；硬顶 9。
 *   （满配：大乘 + 掌门 → 1 + (7-2) + 3 = 9，恰在设计库上限）
 */
export function slotsOf (realmIndex = 0, rankIdx = 0) {
  const realm = Math.max(0, realmIndex | 0)
  const rank = Math.max(0, rankIdx | 0)
  if (realm < RECRUIT.realmIndex || rank < RECRUIT.rankIdx) return 0
  const byRealm = RECRUIT.baseSlots + (realm - RECRUIT.realmIndex) * RECRUIT.slotsPerRealm
  const byRank = RECRUIT.rankBonus[rank] || 0
  return Math.min(RECRUIT.maxSlots, byRealm + byRank)
}

// ── ② 资质 / 悟性 / 特长（设计库 §2.2）──────────────────────────────────────

/** 资质四档（概率 60 / 28 / 10 / 2；growth＝成长系数；output＝产出系数） */
export const APTITUDES = [
  { id: 'wei',    name: '伪灵根',   p: 0.60, growth: 0.8,  output: 0.8, quality: 'fan' },
  { id: 'zhen',   name: '真灵根',   p: 0.28, growth: 1.0,  output: 1.0, quality: 'liang' },
  { id: 'bianyi', name: '变异灵根', p: 0.10, growth: 1.25, output: 1.2, quality: 'zhen' },
  { id: 'tian',   name: '天灵根',   p: 0.02, growth: 1.6,  output: 1.5, quality: 'jue' }
]

/** 「好资质」＝变异以上（保底计数只认这两档） */
export const GOOD_APT = ['bianyi', 'tian']

/** 保底（设计库 §2.2）：连续 5 次未出变异以上 → 好资质概率 ×2（封顶 ×3） */
export const PITY = { streak: 5, mul: 2, cap: 3 }

/** 悟性 S/A/B/C（设计库 §2.2：成长速度 ±20%）——落地上影响传功代价（成长系数） */
export const WITS = [
  { id: 'S', name: 'S', p: 0.05, growth: 1.2 },
  { id: 'A', name: 'A', p: 0.20, growth: 1.1 },
  { id: 'B', name: 'B', p: 0.50, growth: 1.0 },
  { id: 'C', name: 'C', p: 0.25, growth: 0.9 }
]

/** 特长对口岗位时的加成（设计库 §2.2：对应工作 +30%） */
export const SPECIALTY_BONUS = 0.3

/** 特长五档（设计库 §2.2：炼丹 / 炼器 / 采矿 / 护送 / 斗法）——posts＝可对口岗位；mats＝该特长出料池 */
export const SPECIALTIES = [
  { id: 'alchemy', name: '炼丹', posts: ['workshop'], mats: ['mat_lingcao', 'mat_qinglingcao'] },
  { id: 'forge',   name: '炼器', posts: ['workshop'], mats: ['mat_kuang'] },
  { id: 'mine',    name: '采矿', posts: ['workshop'], mats: ['mat_kuang', 'mat_yaodan'] },
  { id: 'escort',  name: '护送', posts: ['dispatch'], mats: ['mat_lingcao'] },
  { id: 'fight',   name: '斗法', posts: ['guard'],    mats: ['mat_yaohu'] }
]

/** 姓名池（设计库仅给示例卡 3 张；此处按姓氏 + 双字名组合生成，纯风味不参与数值） */
export const SURNAMES = ['叶', '石', '白', '柳', '苏', '沈', '云', '秦', '陆', '钟', '霍', '裴',
  '顾', '宋', '傅', '闻', '凌云', '南宫', '上官', '夏', '温', '姜', '许', '崔']
export const GIVEN_NAMES = ['青梧', '铁柱', '小铃铛', '长风', '明夷', '望舒', '清和', '子渊', '鸣珂', '砚舟',
  '疏影', '承玄', '鸣岐', '雨棠', '执玉', '寒山', '奉先', '景桓', '澹之', '昭宁',
  '怀瑾', '踏雪', '无咎', '归尘', '流云', '重光', '思远', '问渠', '静姝', '守拙']

// ── ③ 弟子等级与培养（设计库 §2.4）─────────────────────────────────────────

/**
 * 弟子等级（**只影响弟子本人产出 / 传功代价，不发放玩家境界**）
 *   产出系数 = 1 + outPerLv × (lv - 1)：Lv1=1.0 → Lv9=1.8
 */
export const DISCIPLE_LV = { max: 9, outPerLv: 0.1 }

/**
 * 传功（设计库 §2.4「消耗灵气 / 丹药送弟子经验」）
 *   首批简化：一次传功＝进一级（经验条留后续批）；
 *   代价＝按「玩家基准产出的当量小时」计，随等级指数升、随弟子成长系数反比降 ——
 *   故境界越高灵气越厚、弟子悟性资质越好越省，不必另设境界缩放表。
 */
export const TRAIN = { hBase: 0.02, hGrowth: 1.35 }

// ── ④ 职权 / 岗位（设计库 §2.3）─────────────────────────────────────────────

/**
 * 已实装岗位（首批两条，覆盖「材料 / 贡献」与「灵石 / 贡献」两种产出配方）
 *   hourPerDay：每当量「现实日」的基础产出（设计库 §2.3 原文 0.3h/日 与 0.25h/日）
 *   contribPerH：每当量 h 上缴的宗门贡献（设计库未给数值 → 自定，对齐任务悬赏量级：
 *               巡逻 2 时辰 ≈ 60 贡献，即 1h 当量 ≈ 40 贡献）
 *   stones：产出是否走灵石（石头入账在主循环 sect.tick 快照窗口内 → 自动落既有 sect 线）
 *   matPerH：每当量 h 出的材料份数（按弟子特长的出料池取一种；0＝不产料）
 */
export const POSTS = [
  {
    id: 'workshop', name: '作坊帮工', hourPerDay: 0.30, contribPerH: 40, stones: false, matPerH: 1,
    desc: '派驻炼丹房 / 炼器坊 / 矿区，按特长出料并上缴宗门贡献。'
  },
  {
    id: 'dispatch', name: '派遣任务', hourPerDay: 0.25, contribPerH: 20, stones: true, matPerH: 0,
    desc: '外出采药 / 历练 / 护送，对外折现灵石，另上缴少量贡献。'
  }
]

/**
 * 预留岗位（设计库 §2.3 四件套的后两条）——**本批不实装**，仅登记口径供后续批 B2 取用：
 *   · 助战：随行推塔 / 渡劫，战力 +3~8%/人（合计 ≤15%）→ 需接 powerMul 乘区，属跨模块接线
 *   · 代管：按 70% 效率自动执行日常与结算 → 依赖其他系统接口，属跨模块接线
 */
export const POSTS_RESERVED = [
  { id: 'guard',   name: '助战', powerPctMin: 0.03, powerPctMax: 0.08, cap: 0.15, note: '随行推塔 / 渡劫：战力 +3~8%/人（合计 ≤15%）' },
  { id: 'steward', name: '代管', eff: 0.7, note: '按 70% 效率自动执行日常与结算' }
]

// ── ⑤ 护栏（设计库第三部分 · 开发册 §七）────────────────────────────────────

/**
 * 弟子线产出上限：**全部弟子合计** 每现实日的当量 h 封顶。
 *   来源：设计库第三部分平衡表「弟子产出 后期日均 2.4h」；**主人 2026-09-19 拍板下调至 2.0**
 *   —— 设计稿的 2.4h/日 与既有「俸禄」表叠加后会把 §七 宗门线顶出 15%（首座档已达 16.7%），
 *   故把后期口径压到 2.0h/日，为俸禄腾出 1/3 的空间；资质 / 特长 / 等级三层系数叠起来
 *   （满配原始 ≈10.4h/日）仍会被此硬顶吃掉，不会捅破护栏。
 *   单点旋钮：调此值即整体升降弟子线（设计稿中期口径 1.2h；严格 24h 分母下弟子线占比 = 本值 ÷ 24）。
 */
export const DISCIPLE_CAP_H_PER_DAY = 2.0

/** 一个「现实日」的秒数（弟子产出按秒累计） */
export const DAY_SEC = 86400

// ── ⑥ 纯函数（数据层，system 与自测共用同一口径）─────────────────────────────

const clampLv = (lv) => Math.max(1, Math.min(DISCIPLE_LV.max, lv | 0 || 1))

export function aptById (id) {
  return APTITUDES.find((a) => a.id === id) || APTITUDES[0]
}

export function witById (id) {
  return WITS.find((w) => w.id === id) || WITS[2]
}

export function specById (id) {
  return SPECIALTIES.find((s) => s.id === id) || null
}

export function postById (id) {
  return POSTS.find((p) => p.id === id) || null
}

/**
 * 资质概率表（含保底与相看上浮）
 *   pityStreak ≥ 5 → 好资质（变异 / 天）权重 ×2；≥ 10 → ×3（封顶）
 *   归一化后返回 [{id, p}]，p 之和恒为 1
 */
export function aptWeights (pityStreak = 0, lift = false) {
  const streak = Math.max(0, pityStreak | 0)
  const mul = streak >= PITY.streak
    ? Math.min(PITY.cap, Math.pow(PITY.mul, Math.floor(streak / PITY.streak)))
    : 1
  const boost = lift ? (1 + RECRUIT.inspectLift) : 1
  const raw = APTITUDES.map((a) => ({
    id: a.id,
    p: a.p * (GOOD_APT.includes(a.id) ? mul : 1) * (a.quality === 'jue' ? boost : 1)
  }))
  const sum = raw.reduce((s, x) => s + x.p, 0)
  return raw.map((x) => ({ id: x.id, p: x.p / sum }))
}

/** 按 [0,1) 随机数掷资质（纯函数，自测可定序） */
export function rollAptitude (r, pityStreak = 0, lift = false) {
  const w = aptWeights(pityStreak, lift)
  let acc = 0
  for (const x of w) {
    acc += x.p
    if (r < acc) return x.id
  }
  return w[w.length - 1].id
}

/** 按 [0,1) 随机数掷悟性 */
export function rollWits (r) {
  let acc = 0
  for (const w of WITS) {
    acc += w.p
    if (r < acc) return w.id
  }
  return WITS[WITS.length - 1].id
}

/** 按 [0,1) 随机数掷特长 */
export function rollSpecialty (r) {
  const p = 1 / SPECIALTIES.length
  const i = Math.min(SPECIALTIES.length - 1, Math.max(0, Math.floor(r / p)))
  return SPECIALTIES[i].id
}

/** 按两个 [0,1) 随机数拼姓名 */
export function rollName (r1, r2) {
  const a = SURNAMES[Math.min(SURNAMES.length - 1, Math.max(0, Math.floor(r1 * SURNAMES.length)))]
  const b = GIVEN_NAMES[Math.min(GIVEN_NAMES.length - 1, Math.max(0, Math.floor(r2 * GIVEN_NAMES.length)))]
  return `${a}${b}`
}

/** 该弟子在某特长的出料池里取的**固定**一种料（按序号轮取，面板与自测可预期） */
export function specMaterial (specId, seq = 0) {
  const s = specById(specId)
  if (!s || !s.mats || !s.mats.length) return null
  return s.mats[Math.abs(seq | 0) % s.mats.length]
}

/** 成长系数（资质 × 悟性 × 相看上浮）——传功代价按它反比缩放 */
export function discipleGrowth (d) {
  if (!d) return 1
  return aptById(d.apt).growth * witById(d.wits).growth * (1 + (d.lift || 0))
}

/** 产出系数（资质产出 × 等级 × 相看上浮） */
export function discipleOutput (d) {
  if (!d) return 0
  return aptById(d.apt).output * (1 + DISCIPLE_LV.outPerLv * (clampLv(d.lv) - 1)) * (1 + (d.lift || 0))
}

/** 该弟子的特长是否对口该岗位（对口 +30%） */
export function specFitsPost (d, postId) {
  const s = d ? specById(d.spec) : null
  return !!(s && (s.posts || []).includes(postId))
}

/** 单名弟子在某岗位的「每现实日当量 h」（未封顶；未派岗＝0） */
export function discipleRateH (d, postId) {
  const p = postById(postId)
  if (!p || !d) return 0
  return p.hourPerDay * discipleOutput(d) * (specFitsPost(d, postId) ? (1 + SPECIALTY_BONUS) : 1)
}

/** 传功代价（当量 h）：随等级指数升、随成长系数反比降；满级返回 0 */
export function trainCostH (d) {
  if (!d) return 0
  const lv = clampLv(d.lv)
  if (lv >= DISCIPLE_LV.max) return 0
  return TRAIN.hBase * Math.pow(TRAIN.hGrowth, lv - 1) / Math.max(0.05, discipleGrowth(d))
}

/** 封顶系数：原始合计当量 h/日 → 不超过 DISCIPLE_CAP_H_PER_DAY 的缩放比 */
export function capScale (rawHPerDay = 0) {
  const raw = Math.max(0, Number(rawHPerDay) || 0)
  return raw > DISCIPLE_CAP_H_PER_DAY ? DISCIPLE_CAP_H_PER_DAY / raw : 1
}

// ── ⑦ 忠诚与师徒风险事件（设计库 §2.5，V5.5.1 B2）────────────────────────────

/**
 * 忠诚（0~100，入门 70）：
 *   · 低于 revoltAt（30）→ 叛离（设计库「忠诚 <30 叛离（轻惩罚）」＝失去该弟子与其产出，名额腾出）
 *   · 回复：传功 +trainHeal · 师徒恩义 +10 · 救援归来 +5
 *   · 折损：闯祸 −10 · 被掳自行脱困 −15
 */
export const LOYALTY = { start: 70, max: 100, revoltAt: 30, trainHeal: 5 }

/**
 * 师徒风险事件（设计库 §2.5 五条；叛离单列如上，余四条在此掷点）：
 *   · 掷点：每「事件轮」（7 游戏天 ≈ 现实 7 分钟，与任务板同源）每名弟子 chance 概率出事
 *   · ⚠ 压缩日历（1 现实分钟 = 1 游戏天）下事件频次被放大 ~205 倍/日，
 *     故 chance 与各赔付取「静态预估后不顶破开发册 §七」的小值（见 tests/V5.5.1-自测 ⑧ 量级表）：
 *     闯祸赔灵石 = stoneHourly × 0.002 当量（L47 ≈ 2 灵石）；带宝而归只出灵草（最便宜的材料，
 *     且材料本不入归因台账）；恩义贡献 80 × 境界增长（量级 ≈ 任务贡献线的 1~2%）
 */
export const DISC_EVENTS = {
  periodDays: 7,          // 事件轮：7 游戏天（≈现实 7 分钟）
  chance: 0.03,           // 每名弟子每轮出事概率
  troubleStoneH: 0.002,   // 闯祸赔灵石 = stoneHourly × 此当量
  treasureMat: 'mat_lingcao', // 带宝而归的材料（取最便宜，防经坊市套现顶破护栏）
  graceContrib: 80,       // 师徒恩义贡献（× 境界增长，见 REALM_GROWTH）
  rescueBase: 200,        // 救援被掳弟子的基础贡献价
  dLoyalty: { trouble: -10, capturedReturn: -15, treasure: 5, grace: 10, rescue: 5 },
  logCap: 8               // 师徒近事最多留几条（面板展示，防刷屏）
}

/** 事件轮毫秒 / 周期键（同一轮内幂等） */
export function discEventMs () {
  return gameDaysToMs(DISC_EVENTS.periodDays)
}

export function discEventKeyOf (ts) {
  return periodKeyOf(ts, discEventMs())
}

/**
 * 掷事件类型：r∈[0,1)（纯函数，自测定序）
 *   权重：闯祸 0.3 ｜ 被掳 0.2 ｜ 带宝而归 0.1 ｜ 师徒恩义 0.4
 *   （带宝出的是可卖材料 → 权重压到 0.1，经坊市套现的间接灵石量级见 V5.5.1 自测 ⑧）
 */
export function rollDiscEvent (r) {
  const x = Math.min(0.999999, Math.max(0, Number(r) || 0))
  if (x < 0.3) return 'trouble'
  if (x < 0.5) return 'captured'
  if (x < 0.6) return 'treasure'
  return 'grace'
}

/** 境界增长（口径同 sect.js CONTRIB_GROWTH：每晋一大境界 +60%； disciple 域内独立声明避免互相 import） */
export const REALM_GROWTH = 0.6

/** 救援被掳弟子的贡献价码（随境界同任务板口径放大） */
export function rescueCostOf (realmIndex = 0) {
  const k = Math.max(0, Math.min(5, realmIndex | 0))
  return Math.max(1, Math.round(DISC_EVENTS.rescueBase * (1 + REALM_GROWTH * k)))
}

export default {
  RECRUIT, recruitCooldownMs, slotsOf,
  APTITUDES, GOOD_APT, PITY, WITS, SPECIALTY_BONUS, SPECIALTIES, SURNAMES, GIVEN_NAMES,
  DISCIPLE_LV, TRAIN, POSTS, POSTS_RESERVED, DISCIPLE_CAP_H_PER_DAY, DAY_SEC,
  LOYALTY, DISC_EVENTS, discEventMs, discEventKeyOf, rollDiscEvent, REALM_GROWTH, rescueCostOf,
  aptById, witById, specById, postById, aptWeights, rollAptitude, rollWits, rollSpecialty,
  rollName, specMaterial, discipleGrowth, discipleOutput, specFitsPost, discipleRateH,
  trainCostH, capScale
}
