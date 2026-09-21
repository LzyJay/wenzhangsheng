/**
 * techniques.js —— 功法表（只读配置层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《数据模型》§六 功法模型 +《挂机修仙游戏设定书》§7 +《数值与公式手册》§2.1
 *
 * 品阶：凡 → 黄 → 玄 → 地 → 天（5 阶），每阶 9 品（grade 1~9）。
 * 槽位：main 主修 1 门（决定灵气增长曲线）｜ side 辅修 2 门（炼体 / 剑道 / 丹道方向）
 *       主修只收「吐纳类」（五行 / 变异 / 通用），辅修只收「流派类」（炼体 / 剑道 / 丹道）
 *       —— 对应设定书 §7「主修 1 门 + 辅修 2 门（炼体/剑道/丹道方向词条）」。
 *
 * 效果（主人 2026-09-19 修订）：
 *   ① **灵气产出**：每级 +rateAddPctPerLevel，**加法叠加**进产出乘区 `× (1 + Σ功法加成)`。
 *   ② **战力**：每级 +combatAddPctPerLevel，同样**加法叠加**进战力乘区 `× (1 + Σ战力加成)`
 *      （《数值与公式手册》把「功法 +300%」列在战力预算里；此前未实装，本次补齐）。
 *   ③ **长期参悟**（不再只是花灵气升级）：装备中的功法随时间自行精进 —— 每级需
 *      `TIER_CULTIVATE[tier] × 1.35^(级-1)` 现实秒的**在线**修炼（见 cultivateSecOf）。
 *
 * 阶距（本次要求「低阶与高阶的差距更明显」）：
 *   修为每级 凡 0.05 → 黄 0.10 → 玄 0.17 → 地 0.26 → 天 0.40（天/凡 ≈ 8 倍，原表仅 3.5 倍）；
 *   满级（9 级）三槽满配 ≈ ×9.4，仍在设定书「功法倍率 1~10」预算内。
 *   战力每级 凡 0.004 → 黄 0.009 → 玄 0.016 → 地 0.026 → 天 0.04；满级三槽满配 ≈ +94%。
 *   辅修流派各有偏科：炼体 / 剑道偏战力，丹道偏修为。
 *
 * 成本：灵气按 growth 成长、灵石按 stoneGrowth（更缓）成长 —— 灵石是"中速货币"。
 *       升到第 n 级（从 n 起算）需：qiBase×growth^(n-1) 灵气 + stoneBase×stoneGrowth^(n-1) 灵石。
 * ═══════════════════════════════════════════════════════════════════════════
 */

// V6.11 功法库改造：分界库增量（各界专属 144 本 ＋ 公用库增量 110 本）。data→data 单向依赖。
import { LIBRARY_TECHS } from './techniqueLibrary.js'
// V6.12 批 G3：宗门功法库（12 界 × 8 宗 × 3 ＝ 288 本）。同为纯增量，不反向依赖。
import { SECT_TECHS } from './sectTechniques.js'

/** 品阶元数据（颜色沿用项目既有的"品质语汇"：灰→金→玉→紫→青；只用于铭牌/徽记，不参与数值着色） */
export const TIER_META = [
  { tier: 'fan', name: '凡', color: '#b9b3a8' },
  { tier: 'huang', name: '黄', color: '#e8b96a' },
  { tier: 'xuan', name: '玄', color: '#7fd6a8' },
  { tier: 'di', name: '地', color: '#b98cff' },
  { tier: 'tian', name: '天', color: '#9fd6ff' }
]

export const TIER_MAP = TIER_META.reduce((acc, t) => {
  acc[t.tier] = t
  return acc
}, {})

/** 槽位定义：辅修两槽按境界解锁（口径见下） */
export const SLOT_META = {
  main: { key: 'main', label: '主修', desc: '决定灵气增长曲线' },
  // 「辅修中后期解锁」设计库未给具体境界 → 取金丹 / 元婴作为解锁点（待主人拍板）
  side0: { key: 'side0', label: '辅修一', unlockRealmIndex: 2, unlockName: '金丹' },
  side1: { key: 'side1', label: '辅修二', unlockRealmIndex: 3, unlockName: '元婴' }
}

/** 流派标签（非五行，走辅修槽） */
export const SCHOOL_TAGS = ['body', 'sword', 'alchemy']

export const TAG_NAME = {
  wuxing: '五行通用',
  jin: '金', mu: '木', shui: '水', huo: '火', tu: '土',
  lei: '雷', bing: '冰', feng: '风', an: '暗',
  body: '炼体', sword: '剑道', alchemy: '丹道'
}

/** 阶 × 品 的展示名：黄阶三品 */
export function tierLabel (t) {
  const m = TIER_MAP[t.tier]
  return `${m ? m.name : t.tier}阶${['一', '二', '三', '四', '五', '六', '七', '八', '九'][t.grade - 1] || t.grade}品`
}

/** 该功法可装备的槽位（由 tags 派生：含流派标签 → 可辅修；含五行/通用 → 可主修） */
export function slotKindsOf (t) {
  const out = []
  const hasSchool = (t.tags || []).some((x) => SCHOOL_TAGS.includes(x))
  const hasBreath = (t.tags || []).some((x) => !SCHOOL_TAGS.includes(x))
  if (hasBreath) out.push('main')
  if (hasSchool) out.push('side')
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// 自动参悟（主人 2026-09-19：功法随时间长期修炼也会升级）
// ═══════════════════════════════════════════════════════════════════════════
// 装备中的功法按**在线**时间累积参悟值；攒够 cultivateSecOf(t, 级) 秒即自行精进 1 级，
// 不消耗灵气与灵石（花钱买的是"快"，耗时间是"慢但免费"的那条路）。
// 阶越高越难参悟：凡 45 秒/级起，天阶 720 秒/级起，每级 ×1.35 递增。
export const TIER_CULTIVATE = { fan: 45, huang: 90, xuan: 180, di: 360, tian: 720 }
export const CULTIVATE_GROWTH = 1.35

/** 从 level 级参悟到 level+1 级所需的现实秒数（已满级返回 0） */
export function cultivateSecOf (t, level = 1) {
  if (!t) return 0
  const lv = Math.max(1, level | 0)
  if (lv >= t.maxLevel) return 0
  const base = TIER_CULTIVATE[t.tier] || 60
  return Math.round(base * Math.pow(CULTIVATE_GROWTH, lv - 1))
}

// ── 功法表（22 本：V3.5.7 起含「原著首批」入库，出处见各条注释）──────────────
// V6.11 功法库改造：本数组改称 BASE_TECHNIQUES（**公用库入门段**，id 与数值一字未改），
//   与 techniqueLibrary.js 的分界增量合并为全表 TECHNIQUES（见下方归一化）。
const BASE_TECHNIQUES = [
  // ═══ 凡阶（修为 +5%/级 · 战力 +0.4%/级）═══
  {
    id: 'tech_yinqi', name: '引气吐纳法', tier: 'fan', grade: 1,
    maxLevel: 9, rateAddPctPerLevel: 0.05, combatAddPctPerLevel: 0.004,
    cost: { qiBase: 30, stoneBase: 3, growth: 1.45, stoneGrowth: 1.25 },
    tags: ['wuxing'],
    source: { type: 'starter', label: '测灵根后赠予' },
    desc: '最粗浅的引气法门，人人可修。灵根测出时由宗门执事赠下。'
  },
  {
    id: 'tech_zaling', name: '杂灵归元诀', tier: 'fan', grade: 5,
    maxLevel: 9, rateAddPctPerLevel: 0.06, combatAddPctPerLevel: 0.005,
    cost: { qiBase: 60, stoneBase: 5, growth: 1.45, stoneGrowth: 1.25 },
    tags: ['wuxing'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '杂灵根者专修的归元之法，驳杂灵气亦可缓缓归流。'
  },
  {
    id: 'tech_ti_rumen', name: '粗浅炼体诀', tier: 'fan', grade: 7,
    maxLevel: 9, rateAddPctPerLevel: 0.055, combatAddPctPerLevel: 0.006,
    cost: { qiBase: 80, stoneBase: 6, growth: 1.45, stoneGrowth: 1.25 },
    tags: ['body'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '外门弟子强身之用，气血渐壮，吞吐亦随之稍利。'
  },

  // ═══ 黄阶（修为 +10%/级 · 战力 +0.9%/级）═══
  {
    id: 'tech_changchun', name: '长春功', tier: 'huang', grade: 3,
    maxLevel: 9, rateAddPctPerLevel: 0.095, combatAddPctPerLevel: 0.008,
    cost: { qiBase: 250, stoneBase: 10, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['mu'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '木属性基础吐纳法。生机绵长，最宜木灵根者长修。'
  },
  {
    id: 'tech_liuhuo', name: '流火诀', tier: 'huang', grade: 4,
    maxLevel: 9, rateAddPctPerLevel: 0.10, combatAddPctPerLevel: 0.009,
    cost: { qiBase: 250, stoneBase: 10, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['huo'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '以火行气，气走如焰。火灵根者修之，气机最盛。'
  },
  {
    id: 'tech_hanquan', name: '寒泉引', tier: 'huang', grade: 6,
    maxLevel: 9, rateAddPctPerLevel: 0.105, combatAddPctPerLevel: 0.009,
    cost: { qiBase: 300, stoneBase: 12, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['shui'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '引寒泉浸润经脉，水行灵根尤为相应。'
  },
  {
    id: 'tech_liuyun', name: '流云剑经', tier: 'huang', grade: 5,
    maxLevel: 9, rateAddPctPerLevel: 0.095, combatAddPctPerLevel: 0.011,
    cost: { qiBase: 280, stoneBase: 12, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['sword'],
    source: { type: 'dungeon', label: '秘境 · 剑冢残卷' },
    desc: '剑道辅修。以剑意淬气，气随剑走，行气愈发锋锐（剑修偏战力）。'
  },
  {
    id: 'tech_gengjin', name: '庚金吐纳法', tier: 'huang', grade: 8,
    maxLevel: 9, rateAddPctPerLevel: 0.115, combatAddPctPerLevel: 0.010,
    cost: { qiBase: 320, stoneBase: 13, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['jin'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '金行肃杀，气机凝练。金灵根者修之如饮甘露。'
  },
  {
    id: 'tech_baicao', name: '百草丹经', tier: 'huang', grade: 7,
    maxLevel: 9, rateAddPctPerLevel: 0.095, combatAddPctPerLevel: 0.008,
    cost: { qiBase: 300, stoneBase: 13, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['alchemy'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '丹道辅修。以草木之性养气，行气温和而绵密（丹修重修为，战力稍逊）。'
  },
  {
    id: 'tech_houtu', name: '厚土养元功', tier: 'huang', grade: 9,
    maxLevel: 9, rateAddPctPerLevel: 0.12, combatAddPctPerLevel: 0.010,
    cost: { qiBase: 350, stoneBase: 14, growth: 1.55, stoneGrowth: 1.28 },
    tags: ['tu'],
    source: { type: 'sect_store', label: '藏经阁 · 贡献兑换' },
    desc: '土行厚重，最善养元。土灵根者修之，气海稳固。'
  },

  // ═══ 玄阶（修为 +17%/级 · 战力 +1.6%/级）═══
  {
    id: 'tech_qingmu', name: '青木长生诀', tier: 'xuan', grade: 2,
    maxLevel: 9, rateAddPctPerLevel: 0.16, combatAddPctPerLevel: 0.014,
    cost: { qiBase: 1500, stoneBase: 30, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['mu'],
    source: { type: 'sect_store', label: '藏经阁 · 内门兑换' },
    desc: '内门真传养气之法，木行长生之意尽在其中。'
  },
  {
    // V3.5.1 追加（主人：宗门贡献兑换的功法不该全是普通货色）——玄阶宗门线三本
    id: 'tech_ziyang', name: '紫阳炼神章', tier: 'xuan', grade: 3,
    maxLevel: 9, rateAddPctPerLevel: 0.17, combatAddPctPerLevel: 0.015,
    cost: { qiBase: 1700, stoneBase: 32, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['huo'],
    source: { type: 'sect_store', label: '藏经阁 · 内门兑换（八千贡献）' },
    desc: '云岚宗丹峰一脉的压卷之作。以离火淬神魂、紫气养丹田，行功时眉间隐有紫光——宗门典籍称「紫气东来三万里，炼就神魂不夜天」。'
  },
  {
    id: 'tech_fengleijian', name: '风雷剑典', tier: 'xuan', grade: 4,
    maxLevel: 9, rateAddPctPerLevel: 0.165, combatAddPctPerLevel: 0.018,
    cost: { qiBase: 1900, stoneBase: 35, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['lei', 'sword'],
    source: { type: 'sect_store', label: '藏经阁 · 真传兑换（一万二贡献）' },
    desc: '云岚宗镇山三经之一，风雷入剑、剑气成霆。主辅皆可：作主修则风雷淬体，作辅修则剑意通神——历代掌门皆由此经入门。'
  },
  {
    id: 'tech_liyan', name: '离炎真解', tier: 'xuan', grade: 5,
    maxLevel: 9, rateAddPctPerLevel: 0.175, combatAddPctPerLevel: 0.016,
    cost: { qiBase: 1800, stoneBase: 34, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['huo'],
    source: { type: 'dungeon', label: '秘境 · 炎窟' },
    desc: '离火之精，烧炼杂质。气机炽盛，行功时如炉火照夜。'
  },
  {
    id: 'tech_hanbing', name: '玄冰凝元功', tier: 'xuan', grade: 6,
    maxLevel: 9, rateAddPctPerLevel: 0.18, combatAddPctPerLevel: 0.017,
    cost: { qiBase: 2000, stoneBase: 36, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['shui', 'bing'],
    source: { type: 'dungeon', label: '秘境 · 寒潭' },
    desc: '极寒凝元，气机澄澈。冰属变异灵根者可修。'
  },
  {
    // V3.5.7 原著首批入库（出处：《凡人修仙传》青元剑诀，跨书高频第一档）——
    // 补秘境线玄阶档的木属性空位（此前秘境功法池玄阶只有水/炼体两本）；
    // 数值对齐离炎真解/玄冰凝元功同档预算（0.175 / 0.016，1950 灵气起）
    id: 'tech_qingyuan', name: '青元剑诀', tier: 'xuan', grade: 7,
    maxLevel: 9, rateAddPctPerLevel: 0.175, combatAddPctPerLevel: 0.016,
    cost: { qiBase: 1950, stoneBase: 35, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['mu'],
    source: { type: 'dungeon', label: '秘境 · 灵圃古碑' },
    desc: '木行吐纳古诀，青元入体如春木新发。灵药谷深处的古碑所载，木灵根者修之事半功倍。'
  },
  {
    id: 'tech_jingang', name: '金刚炼体诀', tier: 'xuan', grade: 8,
    maxLevel: 9, rateAddPctPerLevel: 0.16, combatAddPctPerLevel: 0.020,
    cost: { qiBase: 2200, stoneBase: 38, growth: 1.65, stoneGrowth: 1.30 },
    tags: ['body'],
    source: { type: 'dungeon', label: '秘境 · 炼体塔' },
    desc: '炼体辅修。皮肉筋骨如金石，气自髓中生（体修偏战力）。'
  },

  // ═══ 地阶（修为 +26%/级 · 战力 +2.6%/级）═══
  {
    // V3.5.1 追加：云岚宗镇派地阶剑典（贡献兑换的天花板，职级门槛执事起）
    id: 'tech_tianlan', name: '天岚剑气诀', tier: 'di', grade: 1,
    maxLevel: 9, rateAddPctPerLevel: 0.26, combatAddPctPerLevel: 0.026,
    cost: { qiBase: 11000, stoneBase: 85, growth: 1.75, stoneGrowth: 1.32 },
    tags: ['wuxing', 'sword'],
    source: { type: 'sect_store', label: '藏经阁 · 执事兑换（三万贡献）' },
    desc: '云岚宗开山祖师以剑证道所遗，剑气化岚、笼山十里的「云岚」二字便由此而来。非执事以上不得入三层剑阁，非大贡献不得借阅——宗门养出的不是弟子，是下一任山主。'
  },
  {
    id: 'tech_zhoutian', name: '周天星斗功', tier: 'di', grade: 3,
    maxLevel: 9, rateAddPctPerLevel: 0.25, combatAddPctPerLevel: 0.024,
    cost: { qiBase: 10000, stoneBase: 80, growth: 1.75, stoneGrowth: 1.32 },
    tags: ['wuxing'],
    source: { type: 'dungeon', label: '秘境 · 观星台' },
    desc: '以周天星斗为引，气走三百六十周天。地阶中的上乘吐纳法。'
  },
  {
    id: 'tech_bumie', name: '不灭金身', tier: 'di', grade: 6,
    maxLevel: 9, rateAddPctPerLevel: 0.24, combatAddPctPerLevel: 0.030,
    cost: { qiBase: 12000, stoneBase: 90, growth: 1.75, stoneGrowth: 1.32 },
    tags: ['body'],
    source: { type: 'dungeon', label: '秘境 · 古战场' },
    desc: '炼体辅修之极。肉身不灭，断肢可续，气海如渊（体修战力最盛）。'
  },

  // ═══ 天阶（修为 +40%/级 · 战力 +4%/级）═══
  {
    id: 'tech_taixu', name: '太虚化神篇', tier: 'tian', grade: 1,
    maxLevel: 9, rateAddPctPerLevel: 0.38, combatAddPctPerLevel: 0.036,
    cost: { qiBase: 80000, stoneBase: 200, growth: 1.85, stoneGrowth: 1.34 },
    tags: ['wuxing'],
    source: { type: 'dungeon', label: '秘境 · 天阶残页' },
    desc: '太虚之始，神游八荒。天阶吐纳经典，非大机缘不可得。'
  },
  {
    id: 'tech_huntian', name: '混天无极经', tier: 'tian', grade: 9,
    maxLevel: 9, rateAddPctPerLevel: 0.44, combatAddPctPerLevel: 0.045,
    cost: { qiBase: 120000, stoneBase: 260, growth: 1.85, stoneGrowth: 1.34 },
    tags: ['wuxing', 'sword'],
    source: { type: 'dungeon', label: '秘境 · 无极遗刻' },
    desc: '混元无极，气剑同流。天阶绝品，主辅皆可，万年一遇。'
  }
]

/**
 * **全表**（V6.12 批 G3 扩充）：旧表 22 本（公用库入门段）＋ 分界库增量（`techniqueLibrary.js`）
 *   ＋ **宗门功法库**（`sectTechniques.js`，12 界 × 8 宗 × 3 ＝ 288 本）。
 *   旧条目未显式登记 `worldId` / `unlockRealm` / `rootReq` → 一律取归一化默认
 *   （公用库 · 无境界门槛 · 不限灵根）—— **现有 22 本的 id 与数值一字未改**，老档零风险。
 *   主人口径（批 G3 更新）：每界可用 ＝ 公用 132 ＋ 本界专属 12 ＋ **本界宗门 24 ＝ 168 本**。
 */
export const TECHNIQUES = [...BASE_TECHNIQUES, ...LIBRARY_TECHS, ...SECT_TECHS]
  .map((t) => ({ worldId: 'common', unlockRealm: 0, rootReq: null, ...t }))

export const TECH_MAP = TECHNIQUES.reduce((acc, t) => {
  acc[t.id] = t
  return acc
}, {})

// ═══════════════════════════════════════════════════════════════════════════
// V6.11 功法库改造 · 多世界查询面
// ═══════════════════════════════════════════════════════════════════════════

/** 未显式登记时的默认字段（现有 22 本走此默认：公用库 · 无境界门槛 · 不限灵根） */
export const TECH_DEFAULTS = { worldId: 'common', unlockRealm: 0, rootReq: null }

/** 公用库 id（跨界的通用功法；任何世界都能学到） */
export const COMMON_LIB = 'common'

/**
 * 某界的**可用功法**（＝ 公用库 ＋ 本界专属）。
 *   主人口径：**每界可用 ＝ 公用 132 ＋ 本界 12 ＝ 144 本**。
 * @param {string} worldId 世界 id；空值 → 只有公用库
 */
export function availableInWorld (worldId) {
  const wid = typeof worldId === 'string' && worldId ? worldId : ''
  return TECHNIQUES.filter((t) => t.worldId === COMMON_LIB || (wid && t.worldId === wid))
}

/** 某界**专属**功法（不含公用库）；未登记界返回 [] */
export function techsOf (worldId) {
  return TECHNIQUES.filter((t) => t.worldId === worldId)
}

/** 按 id 取功法（public alias，便于数据层外部引用） */
export function techById (id) {
  return TECH_MAP[id] || null
}

/**
 * 图鉴分组索引：`[{ worldId, name, isCommon, techs:[] }]`
 *   顺序固定为「公用库 → 12 界（worlds.js 卡池顺序）」；界名由调用方按 worlds.js 渲染（本层只给 id）。
 * @param {Array<string>} worldIds 12 界 id（由装配层/面板传入，保持数据层不 import worlds.js）
 */
export function libraryIndex (worldIds = []) {
  const out = [{
    worldId: COMMON_LIB,
    isCommon: true,
    techs: TECHNIQUES.filter((t) => t.worldId === COMMON_LIB)
  }]
  for (const wid of worldIds) {
    out.push({ worldId: wid, isCommon: false, techs: techsOf(wid) })
  }
  return out
}

/**
 * 数据层习得校验（**纯函数**，供 TechniqueSystem.canLearn 与事件抽取共用）：
 *   · 境界：`unlockRealm ≤ realmIndex`
 *   · 灵根：`rootReq.rarities` 命中当前灵根档（`wr_*` 世界专属灵根按其 `base` 归档 —— 由调用方传入已归档的 rarity）
 * @returns {{ok:boolean, reason:string, needRealm:number, needRoots:string[]|null}}
 */
export function canLearnByData (t, realmIndex = 0, rootRarity = null) {
  const needRealm = Number.isFinite(t && t.unlockRealm) ? t.unlockRealm : 0
  const ri = Number.isFinite(realmIndex) ? realmIndex : 0
  const needRoots = (t && t.rootReq && Array.isArray(t.rootReq.rarities)) ? t.rootReq.rarities : null
  if (ri < needRealm) {
    return { ok: false, reason: 'realm', needRealm, needRoots }
  }
  if (needRoots && (!rootRarity || !needRoots.includes(rootRarity))) {
    return { ok: false, reason: 'root', needRealm, needRoots }
  }
  return { ok: true, reason: '', needRealm, needRoots }
}

/**
 * 事件奇遇候选池（**过滤门槛后**随机抽一本）：
 *   · 来源：`from='other'` → 除本界外的各界专属 ＋ 公用；`'common'` → 只公用；`'any'` → 全部
 *   · 过滤：不属于本界已可学者（避免抽到"本来就学得到"的）、境界与灵根门槛、已持有（由调用方再过滤）
 * @returns {Array<object>} 候选功法数组（调用方自行随机取一）
 */
export function learnCandidates (worldId, realmIndex, rootRarity, from = 'other') {
  const wid = typeof worldId === 'string' ? worldId : ''
  return TECHNIQUES.filter((t) => {
    const w = t.worldId
    if (from === 'common' && w !== COMMON_LIB) return false
    if (from === 'other' && (w === COMMON_LIB || w === wid)) return false
    if (from === 'any' && w === wid) return false     // 本界专属不算「他界」
    return canLearnByData(t, realmIndex, rootRarity).ok
  })
}

/** 开局赠予的功法（新手脚本：测灵根后获得第一份功法） */
export const STARTER_TECHNIQUE = 'tech_yinqi'

/** 取功法定义；未登记 id 返回兜底（老档/新表不至于崩） */
export function getTechnique (id) {
  return TECH_MAP[id] || null
}

/** 升到第 level 级（从 level 起算）需要的成本；maxLevel 已满返回 null */
export function levelCost (t, level) {
  if (!t || level >= t.maxLevel) return null
  const k = level - 1
  const c = t.cost
  return {
    qi: Math.round(c.qiBase * Math.pow(c.growth, k)),
    stone: Math.round(c.stoneBase * Math.pow(c.stoneGrowth, k))
  }
}

/** 从 1 级升满的累计成本（用于平衡核对与面板提示） */
export function totalCost (t) {
  let qi = 0
  let stone = 0
  for (let lv = 1; lv < t.maxLevel; lv++) {
    const c = levelCost(t, lv)
    if (c) { qi += c.qi; stone += c.stone }
  }
  return { qi, stone }
}

/** 满级时的产出加成（小数）：每级 rateAddPctPerLevel，1 级即生效 */
export function maxRatePct (t) {
  return t ? t.rateAddPctPerLevel * t.maxLevel : 0
}

/** 满级时的战力加成（小数）：每级 combatAddPctPerLevel，1 级即生效 */
export function maxCombatPct (t) {
  return t ? (t.combatAddPctPerLevel || 0) * t.maxLevel : 0
}

export default {
  TECHNIQUES, TECH_MAP, TIER_META, TIER_MAP, SLOT_META, TAG_NAME, SCHOOL_TAGS,
  STARTER_TECHNIQUE, getTechnique, levelCost, totalCost, maxRatePct, maxCombatPct,
  tierLabel, slotKindsOf,
  TIER_CULTIVATE, CULTIVATE_GROWTH, cultivateSecOf,
  // V6.11 多世界功法库查询面
  TECH_DEFAULTS, COMMON_LIB, availableInWorld, techsOf, techById, libraryIndex,
  canLearnByData, learnCandidates
}
