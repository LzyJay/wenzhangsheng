/**
 * dungeon.js —— 秘境表（只读配置层）（2.7）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《秘境副本设计 v1》+《秘境奖励曲线与事件 v1》+ data-source/秘境奖励表.csv
 *       + 开发计划 模块 2.7（试炼塔 1~60 层 + 灵药谷 + 分身派遣 1 槽起步）。
 *
 * 范围（本模块）：
 *   ① 试炼塔 1~60 层：战力校验爬塔，首通当量 h + 周常扫荡
 *   ② 资源秘境 4 主题 × 4 深度：首通（一次性当量）+ 分身派遣（常驻产出）
 *   ③ 分身派遣：金丹解锁 1 槽，每晋一大境界 +1（合体 5 槽封顶）
 *   ④ 世界专属秘境（12 个招牌洞天）+ 限时秘境（周轮换）+ 秘境积分商店
 *      ——内容批次 3（世界篇）首步，**V5.1 实装**（此前为纯登记；本源界映射见 worlds.js）。
 *
 * 口径（以《秘境奖励曲线与事件 v1》为准，取代《秘境副本设计 v1》的估算值）：
 *   · 试炼塔推荐战力 = 1.15 × power(m)（power(m)=35×1.40^(m-1)，与 CSV 取整一致）
 *   · 首通当量 = 1.5 + 0.15×m；周扫荡 = m×0.2h（上限 20h）
 *   · 派遣基础率 0.18h/小时（更新版把 0.20 调至 0.18，秘境线落回 24~25% 目标带）
 *   · 难度系数 1.0/1.3/1.7/2.2；评星 +10%/星；当量 h 按灵石时薪折算（复用 events.stoneHourly）
 *
 * V3.3.1 增补（主人：秘境要能拿功法 / 古修遗迹要有惊喜或意外）：
 *   · TECH_BY_DEPTH：深度 1~4 ↔ 黄/玄/地/天阶秘境功法池；首通必得、派遣低概率拾得
 *   · TECH_DROP_PCT：派遣拾卷概率（古修遗迹更高）；TECH_DUP_STONES_H：池满时的灵石替代
 *   · SURPRISE：古修遗迹专属的「机缘 / 残卷 / 机关 / 寻常」四态，派遣结算时 roll
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { FORMULA } from './realms.js'
// V5.1 招牌秘境：周期与「每 30 游戏天（＝坊市/寻蛋同一轮『日』）」同源，不另立时钟
import { refreshMs, periodKeyOf, msToNextPeriod } from './gametime.js'

/** 战力公式常量（与 realms.FORMULA 同源，此处只读引用，不改数值） */
const powerBase = FORMULA.powerBase        // 35
const powerGrowth = FORMULA.powerGrowth    // 1.40

/** 试炼塔（V5.1.2 扩容：1~100 层；floors 即设计全量，不再预留扩容注释） */
export const TOWER = {
  floors: 100,                // V5.1.2：由 60 扩到 100（设计全量层数）
  powerMul: 1.15,             // 敌战力 = 1.15 × power(m)
  firstClearBase: 1.5,        // 首通当量 h = 1.5 + 0.15×m
  firstClearPer: 0.15,
  weeklyPer: 0.2,             // 周扫荡 = m × 0.2h
  weeklyCap: 20,              // 周扫荡上限 20h
  milestoneEvery: 10,         // 每 10 层里程碑
  milestoneBonusH: 5,         // 里程碑「材料箱」≈ +5h 当量（外观/灵兽蛋等后续模块接入）
  // V5.1.2：试炼塔里程碑「秘境积分」发放表（招牌积分商店上游来源）
  //   来源：仅 30 层有基准数据（V5.1 预留 milestonePoints[30]=100，即「秘境积分 ×100」）。
  //   70/80/90/100 为 V5.1.2 新增四档，数值沿用 30 层口径——每 10 层一档、每档 +100 点，
  //   与 30 层同口径（仅 30 层有基准数据，不擅自递增斜率）。如需递增曲线由主人拍板后单点调。
  milestonePoints: { 30: 100, 70: 100, 80: 100, 90: 100, 100: 100 }
}

/** 试炼塔第 m 层推荐战力（= 1.15 × power(m)，与 CSV 逐层取整一致） */
export function towerPower (m) {
  return Math.round(powerBase * Math.pow(powerGrowth, Math.max(1, m) - 1) * TOWER.powerMul)
}

/** 试炼塔第 m 层首通当量 h（= 1.5 + 0.15×m） */
export function towerFirstClearH (m) {
  return TOWER.firstClearBase + TOWER.firstClearPer * m
}

/** 试炼塔第 m 层周扫荡当量 h（= m×0.2，上限 20） */
export function towerWeeklyH (m) {
  return Math.min(TOWER.weeklyCap, m * TOWER.weeklyPer)
}

/** 里程碑文案（每 10 层；外观/积分/灵兽蛋等由对应模块接入，本模块折算为灵石 + 提示） */
export function towerMilestone (m) {
  if (m % TOWER.milestoneEvery !== 0 || m <= 0) return null
  const labels = {
    10: '解锁快速扫荡 · 材料箱',
    20: '外观「试炼袍」',
    30: '秘境积分 ×100',
    40: '灵兽蛋 ×1 · 材料箱',
    50: '解锁自动推塔 · 大材料箱',
    60: '外观「塔顶客」',
    // V5.1.2：70~100 层外观档，风格与 60 层「塔顶客」一致（"XX客" 命名）
    70: '外观「凌云客」',
    80: '外观「摘星客」',
    90: '外观「踏虚客」',
    100: '外观「登天客」'
  }
  return labels[m] || `第 ${m} 层里程碑`
}

/** 难度系数四档（资源秘境深度 1~4，对应普通/困难/噩梦/炼狱） */
export const DEPTH_TABLE = [
  { depth: 1, coef: 1.0, name: '浅层', power: 12273,    firstClearH: 5 },
  { depth: 2, coef: 1.3, name: '深层', power: 253568,   firstClearH: 7 },
  { depth: 3, coef: 1.7, name: '险层', power: 5238985,  firstClearH: 9 },
  { depth: 4, coef: 2.2, name: '绝层', power: 108242909, firstClearH: 11 }
]

/** 资源秘境（4 主题；unlockRealm：0 炼气 1 筑基 2 金丹 3 元婴 … 对齐 REALM_META 下标） */
export const RESOURCE_DUNGEONS = [
  {
    id: 'res_lingyao', name: '灵药谷', unlockRealm: 1, theme: '丹药材料',
    material: 'mat_lingcao', matPerH: 3,
    desc: '山谷灵田，遍地灵草。筑基期即可入谷，是炼丹材料的第一处正经产线。'
  },
  {
    id: 'res_kuang', name: '玄铁矿洞', unlockRealm: 1, theme: '炼器材料＋灵石',
    material: 'mat_kuang', matPerH: 2,
    desc: '地底矿脉，玄铁丰饶。筑基期即可开采，产出炼器与法宝强化之材。'
  },
  {
    id: 'res_wanshou', name: '万兽林', unlockRealm: 2, theme: '妖丹＋灵兽蛋',
    material: 'mat_yaodan', matPerH: 1,
    desc: '林深兽众，妖丹难得。金丹期方可入林，是喂养灵兽与高阶丹方的材料地。'
  },
  {
    id: 'res_guxiu', name: '古修遗迹', unlockRealm: 3, theme: '功法残页＋法宝碎片',
    // V3.3.1（主人）：古修遗迹不再复刻上方矿洞的玄铁矿 —— 改为专属产物「功法残页」，
    //   并带 surprise 标记：派遣结算时另有「机缘 / 机关」的惊喜与意外。
    material: 'frag_canjuan', matPerH: 1.2, surprise: true,
    desc: '上古修士洞府，机缘与凶险并存。元婴期方可探入，所获最丰——但也最不可测。'
  }
]

/**
 * 秘境功法池（按深度档位）：与技术表 source.type === 'dungeon' 的 9 本同源（V3.5.7 起含青元剑诀）。
 * 口径（V3.3.1，主人「秘境也获取不了功法」）：
 *   · 首通某深度 → 必得该档一本（未持有优先；全持有则折算灵石）
 *   · 派遣每趟 → 低概率拾得残卷（古修遗迹概率更高）
 * 深度 1~4 对应 黄 / 玄 / 地 / 天。
 */
export const TECH_BY_DEPTH = {
  1: ['tech_liuyun', 'tech_liyan'],
  2: ['tech_hanbing', 'tech_jingang', 'tech_qingyuan'],   // V3.5.7 原著首批：玄阶档补木属性
  3: ['tech_zhoutian', 'tech_bumie'],
  4: ['tech_taixu', 'tech_huntian']
}

/** 派遣拾得功法残卷的概率（每趟结算 roll 一次） */
export const TECH_DROP_PCT = { default: 0.10, res_guxiu: 0.25 }

/** 首通某深度时功法赠送的兜底灵石当量（该档功法已全持有时的替代奖励） */
export const TECH_DUP_STONES_H = 3

/**
 * 古修遗迹「惊喜与意外」（V3.3.1，主人：要有惊喜或意外，而不是复刻上方奖励）
 * 派遣 / 召回结算时 roll 一次（仅 surprise 秘境）：
 *   jackpot 掘出遗藏 → 灵石 ×2｜scroll 残卷补全 → 直接得一门功法（或折灵石）
 *   trap    触动禁制 → 本次灵石减半、材料归零（意外）｜normal 常态
 * 顺序即权重（累计和 1.0）。
 */
export const SURPRISE = {
  rolls: [
    { id: 'jackpot', p: 0.18, label: '掘出古人遗藏' },
    { id: 'scroll', p: 0.15, label: '拾得完整残卷' },
    { id: 'trap', p: 0.15, label: '触动洞中禁制' },
    { id: 'normal', p: 0.52, label: '寻常探获' }
  ],
  jackpotMul: 2,
  trapStoneMul: 0.5
}

/** 取深度档对应的功法池；越界收敛到最近档 */
export function techPoolOf (depth) {
  const i = Math.min(Math.max(Math.round(depth) | 0, 1), 4)
  return TECH_BY_DEPTH[i] || []
}

/**
 * 世界专属秘境 · 12 招牌位（内容批次 3 实装位，本表先行登记——V3.5.10 原著第四批）
 * 来源：《设计库/07-原著/提炼-数据库素材/05-秘境洞府》命名池，出处见各条 source。
 * 口径：**纯登记**——解锁条件 / 奖励曲线 / 周轮换 / 积分商店由内容批次 3「世界专属秘境」（世界篇）模块实装；
 *   本表不接线、不参与 autoTick 与派遣结算，不动上方四主题资源秘境。
 * 字段：unlockRealm 为建议门槛（对齐 REALM_META 下标：2 金丹 3 元婴 4 化神 …），内容批次 3 实装时可调。
 */
export const SIGNATURE_DUNGEONS = [
  { id: 'sig_tianhe', name: '天河秘境', theme: '水行 · 灵泉产出', source: '《修真聊天群》', unlockRealm: 2,
    material: 'mat_lingcao', matPerH: 2,
    desc: '一川星辉垂落如瀑，掬一捧便是半瓶灵液。' },
  { id: 'sig_yaochi', name: '瑶池秘境', theme: '灵药 · 灵圃产出', source: '《修真聊天群》', unlockRealm: 2,
    material: 'mat_lingcao', matPerH: 2,
    desc: '池畔仙桃三千年一熟，药香隔十里可闻。' },
  { id: 'sig_minghe', name: '冥河禁地', theme: '高危 · 绝品产出', source: '《一念永恒》', unlockRealm: 4,
    material: 'mat_yaodan', matPerH: 1,
    desc: '河面无风起浪，渡得起者得造化，渡不起者喂鱼虾。' },
  { id: 'sig_huanyue', name: '幻月洞府', theme: '洞府 · 传承', source: '《诛仙》', unlockRealm: 3,
    material: 'frag_canjuan', matPerH: 1,
    desc: '月上中天时石门自开，雾里看剑，剑里看心。' },
  { id: 'sig_shijian', name: '时间秘境', theme: '时间 · 挂机倍速', source: '《修真聊天群》', unlockRealm: 3,
    material: 'mat_lingcao', matPerH: 2,
    desc: '洞中一日，世上……不，是洞中一日，世上才一时。' },
  { id: 'sig_tianting', name: '天庭碎片秘境', theme: '遗迹 · 仙品产出', source: '《修真聊天群》', unlockRealm: 5,
    material: 'mat_kuang', matPerH: 2,
    desc: '旧日天庭崩碎后的残垣，断瓦里偶见仙家气度。' },
  { id: 'sig_hualing', name: '化灵遗迹', theme: '古修 · 功法残卷', source: '《修真聊天群》', unlockRealm: 3,
    material: 'frag_canjuan', matPerH: 2,
    desc: '古修坐化之地，灵气化了形，会在廊下走来走去。' },
  { id: 'sig_qiling', name: '泣灵秘藏', theme: '宝藏 · 一次性', source: '《凡人修仙传》', unlockRealm: 3,
    material: 'mat_yaodan', matPerH: 2,
    desc: '开门七日，过时不候——古人留下的库房不等人。' },
  { id: 'sig_xitian', name: '西天秘境', theme: '佛门 · 心境', source: '《谁让他修仙的！》', unlockRealm: 4,
    material: 'mat_lingcao', matPerH: 1,
    desc: '钟声一响，心魔退散；可惜钟声也不常响。' },
  { id: 'sig_dongxu', name: '洞虚秘境', theme: '虚空 · 机缘', source: '《大乘期才有逆袭系统》', unlockRealm: 5,
    material: 'mat_yaodan', matPerH: 1,
    desc: '虚空中裂开的一线，钻进去的人各说各话。' },
  { id: 'sig_zhongsheng', name: '众生秘境', theme: '人烟 · 交易', source: '《大乘期才有逆袭系统》', unlockRealm: 2,
    material: 'mat_kuang', matPerH: 2,
    desc: '秘境里开着集市，修士散修摩肩接踵，倒像个凡间庙会。' },
  { id: 'sig_yinlv', name: '音律秘境', theme: '雅趣 · 悟性', source: '《大乘期才有逆袭系统》', unlockRealm: 3,
    material: 'frag_canjuan', matPerH: 1,
    desc: '风中自有人抚琴，听懂了，道行便长一分。' }
]

/** 招牌位按 id 取（未登记返回 null） */
export function getSignature (id) {
  return SIGNATURE_DUNGEONS.find((d) => d.id === id) || null
}

// ═════════════════════════════════════════════════════════════════════════════
// V5.1 · 招牌秘境实装（内容批次 3 世界篇首步）
//   解锁 / 产出曲线 / 周轮换 / 积分商店 —— 与 12 界本源映射（worlds.js）配合。
//   三态：本源洞天（本界招牌 · 全额）｜游历洞天（空缺界的本界洞天 · 门槛提前）
//         他界洞天（其余 · 六折且按原门槛）；全 12 条对任何世界始终可见。
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 招牌秘境口径（⚙ 可调旋钮集中于此，只改这一处）
 *   · 首通当量 h = firstClearBase + firstClearPer × unlockRealm（金丹 2 → 14h / 炼虚 5 → 23h）
 *   · 周期当量 h = cycleHPer × unlockRealm（金丹 2 → 2.4h / 炼虚 5 → 6h）；每轮 = 30 游戏天
 *   · originMul 本源洞天系数 / foreignMul 他界与游历洞天系数（六折）
 *   · localUnlockDiscount 游历洞天门槛提前的大境界数（只提前门槛，不给全额）
 *   · weeklyMul 周轮换「限时秘境」产出倍率（当周限定 · 过期作废不可补打）
 *   · points 积分数值：招牌首通 / 招牌周期 / 周轮换
 *   · pointsPerH 积分定价率（1 h 当量 = N 积分）——**不用 stoneHourly 定价**：
 *     积分收入是平坦的（+30/+5/+20 不随境界涨），若按时薪定价，价格会指数上涨
 *     而收入不变，商店中期即彻底失效；故此率固定、随境界不浮动。
 */
export const SIGNATURE = {
  firstClearBase: 8,
  firstClearPer: 3,
  cycleHPer: 1.2,
  originMul: 1.0,
  foreignMul: 0.6,
  localUnlockDiscount: 1,
  weeklyMul: 1.5,
  points: { firstClear: 30, cycle: 5, weekly: 20, towerMilestone30: 100 },
  pointsPerH: 100
}

/** 招牌首通当量 h（未乘本源/他界系数） */
export function sigFirstClearH (d) {
  return SIGNATURE.firstClearBase + SIGNATURE.firstClearPer * Math.max(0, d.unlockRealm | 0)
}

/** 招牌周期当量 h（未乘系数） */
export function sigCycleH (d) {
  return SIGNATURE.cycleHPer * Math.max(0, d.unlockRealm | 0)
}

/** 招牌周期轮键（每轮 = 30 游戏天，与坊市 / 寻蛋同一「日」同源） */
export function sigCycleKey (ts) {
  return periodKeyOf(ts, refreshMs())
}

/** 距下一轮招牌周期边界的现实毫秒（面板倒计时用游戏历呈现） */
export function sigCycleMsToNext (ts) {
  return msToNextPeriod(ts, refreshMs())
}

/**
 * 当周「限时秘境」id —— 顺序按 id 稳定哈希（可预测、可复现，不随进程/时区漂）
 * @param {number|string} weekKey DungeonSystem.weekKey(now) 的返回值（周一为界）
 */
export function weeklySignatureId (weekKey) {
  const ids = SIGNATURE_DUNGEONS.map((d) => d.id).sort()
  const s = String(weekKey)
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647
  return ids[h % ids.length]
}

/**
 * 招牌秘境积分商店货架（V5.1）
 *   只卖**现有物品**（不新增物品条目）；价格 = round(entry.h × SIGNATURE.pointsPerH)。
 *   h 为「当量」口径：与秘境产出同一把尺子（1 h 当量 ≈ 该物品的收益量级）。
 *   kind: 'item' 直接入行囊 ｜ 'techDup' 功法池已满时的灵石折算（接 TECH_DUP_STONES_H 同族）
 */
export const DUNGEON_SHOP = [
  { id: 'shop_lingcao', name: '灵草 ×5', kind: 'item', item: 'mat_lingcao', n: 5, h: 0.5 },
  { id: 'shop_kuang', name: '玄铁 ×5', kind: 'item', item: 'mat_kuang', n: 5, h: 0.5 },
  { id: 'shop_yaodan', name: '妖丹 ×3', kind: 'item', item: 'mat_yaodan', n: 3, h: 0.8 },
  { id: 'shop_ningshen', name: '凝神丹 ×1', kind: 'item', item: 'pill_ningshen', n: 1, h: 1.2 },
  { id: 'shop_hujie', name: '护劫丹 ×1', kind: 'item', item: 'pill_hujie', n: 1, h: 2.0 },
  { id: 'shop_xisui', name: '洗髓丹 ×1', kind: 'item', item: 'pill_xisui', n: 1, h: 3.0 },
  { id: 'shop_waiguan', name: '外观碎片 ×1', kind: 'item', item: 'frag_waiguan', n: 1, h: 4.0 },
  { id: 'shop_canjuan', name: '功法残卷 ×1', kind: 'item', item: 'frag_canjuan', n: 1, h: TECH_DUP_STONES_H }
]

/** 取货架项；未登记返回 null */
export function getShopItem (id) {
  return DUNGEON_SHOP.find((s) => s.id === id) || null
}

/** 货架项的积分定价（随境界不浮动：理由见 SIGNATURE 注释） */
export function shopCostOf (entry) {
  return Math.max(1, Math.round(entry.h * SIGNATURE.pointsPerH))
}

/** roll 一次「惊喜与意外」；返回配置项（random 注入便于自测） */
export function rollSurprise (r = Math.random()) {
  let acc = 0
  for (const it of SURPRISE.rolls) {
    acc += it.p
    if (r < acc) return it
  }
  return SURPRISE.rolls[SURPRISE.rolls.length - 1]
}

/** 分身派遣（挂机第二引擎） */
export const DISPATCH = {
  baseRate: 0.18,       // 基础率 h/小时（更新版口径：0.20 → 0.18，落回 24~25% 目标带）
  starBonus: 0.1,       // 首通评星永久 +10%/星
  durations: [2, 4, 8], // 可选派遣时长（小时）
  autoRenew: true,      // 默认自动续派（离线照算，到时自动结算再续）
  maxSlots: 5           // 合体期 5 槽封顶
}

/** 评星阈值（首通时按「战力 ÷ 推荐战力」溢出比例，×1.0/1.5/2.0 三档） */
export const STAR_RULE = { tiers: [1.0, 1.5, 2.0], maxStars: 3 }

/** 取资源秘境定义；未登记返回 null */
export function getDungeon (id) {
  return RESOURCE_DUNGEONS.find((d) => d.id === id) || null
}

/** 取某深度档；越界收敛到最近档 */
export function getDepth (depth) {
  const i = Math.min(Math.max(Math.round(depth) | 0, 1), DEPTH_TABLE.length) - 1
  return DEPTH_TABLE[i]
}

/** 分身槽位：金丹（境序 2）解锁 1 槽，每晋一大境界 +1，合体 5 槽封顶 */
export function slotCountFor (level) {
  const realmIndex = Math.floor((Math.max(1, level) - 1) / 9)
  return Math.min(DISPATCH.maxSlots, Math.max(0, realmIndex - 1))
}

/**
 * 派遣当量 h = 时长 × 基础率 × 难度系数 × (1 + 0.1×星数)
 * @param {number} hours 派遣时长
 * @param {number} coef 难度系数
 * @param {number} stars 首通评星（0~3）
 */
export function dispatchHours (hours, coef, stars = 0) {
  return hours * DISPATCH.baseRate * coef * (1 + DISPATCH.starBonus * Math.max(0, stars | 0))
}

export default {
  TOWER, DEPTH_TABLE, RESOURCE_DUNGEONS, DISPATCH, STAR_RULE,
  TECH_BY_DEPTH, TECH_DROP_PCT, TECH_DUP_STONES_H, SURPRISE,
  SIGNATURE_DUNGEONS, getSignature, SIGNATURE, DUNGEON_SHOP,
  towerPower, towerFirstClearH, towerWeeklyH, towerMilestone,
  getDungeon, getDepth, slotCountFor, dispatchHours, techPoolOf, rollSurprise,
  sigFirstClearH, sigCycleH, sigCycleKey, sigCycleMsToNext, weeklySignatureId,
  getShopItem, shopCostOf
}
