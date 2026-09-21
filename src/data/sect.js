/**
 * sect.js —— 宗门表（只读配置层）（2.4）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《宗门与弟子 v1》第一部分 +《问长生-开发计划》§四 模块 2.4
 * 范围：云岚宗（青岚界）· 道统 · 六档职级俸禄 · 任务板 · 藏经阁 · 贡献商店
 *       （弟子线＝设计库内容批次 2/3 → **V5.5 已实装首批**，见表 src/data/disciples.js；
 *         本档职级表只提供「收徒名额」的职级加成（RECRUIT.rankBonus）；
 *         世界名册每界 3 宗＝2.9 世界卡池接入）
 *
 * 口径：
 *   · 职级门槛＝境界 + 累计贡献（双门槛）；晋升不扣贡献，贡献是可花货币，累计值另记
 *   · 俸禄（日）＝「N 小时等效基准产出」的灵气；按在线时间随秒入账（离线不发）
 *   · 任务板：外门 3 槽、内门起 5 槽；**每轮 7 游戏天**（主人 2026-09-19 口径，
 *     新换算下 ≈ 现实 7 分钟）刷新；交付后槽位本轮转空
 *   · 任务限时按**游戏时辰**计（「巡山两个时辰」即 2 时辰 ≈ 现实 10 秒）：
 *     到点自动交差；战力校验类在接取时若战力已达标 → 直接完成
 *   · 藏经阁分层：外门可借 凡/黄，内门起可借 玄（对应一层黄品/二层玄品；
 *     地/天品按设计走秘境线，不进藏经阁）
 *   · 商店：贡献 100~400 档的丹药与材料；职级折扣只作用于商店（藏经阁按设计原价）
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 云岚宗（青岚界名册三宗之一；换宗/多宗名册待世界卡池 2.9 接入） */
import { gameDaysToMs, gameHoursToMs, periodKeyOf, msToNextPeriod, fmtRealMinutes, REFRESH_DAYS } from './gametime.js'

export const SECT = {
  id: 'sect_yunlan',
  name: '云岚宗',
  world: 'world_qinglan',
  daoTong: { id: 'sword', name: '剑修', desc: '战力 +10%（战力判定线 2.5/2.7 接入后生效）' },
  intro: '青岚界三宗之一，以剑证道。山门常年云岚不散，故得此名。'
}

/** 道统五系（展示与后续多宗接入用；本档云岚宗固定剑修） */
export const DAO_TONG = [
  { id: 'sword', name: '剑修', desc: '战力 +10%' },
  { id: 'alchemy', name: '丹修', desc: '丹药产出 +15%' },
  { id: 'body', name: '体修', desc: '塔/秘境战力判定 +8%' },
  { id: 'talisman', name: '符修', desc: '事件收益 +10%' },
  { id: 'law', name: '法修', desc: '挂机产出 +8%' }
]

/** 职级六档（设计库 §1.2 俸禄表；realmIndex：0 炼气 1 筑基 2 金丹 3 元婴 4 化神 5 炼虚） */
export const RANKS = [
  { idx: 0, id: 'waimen',    name: '外门弟子', realmIndex: 0, realmName: '炼气', contrib: 0,     salaryHours: 0.2, slots: 3, discount: 0,    unlocks: '任务板 3 槽 · 藏经阁一层' },
  { idx: 1, id: 'neimen',    name: '内门弟子', realmIndex: 1, realmName: '筑基', contrib: 300,   salaryHours: 0.5, slots: 5, discount: 0.05, unlocks: '任务板 5 槽 · 藏经阁二层 · 商店 95 折' },
  { idx: 2, id: 'zhenchuan', name: '真传弟子', realmIndex: 2, realmName: '金丹', contrib: 1200,  salaryHours: 0.9, slots: 5, discount: 0.10, unlocks: '商店 9 折（个人洞府待内容批次 2）' },
  { idx: 3, id: 'zhishi',    name: '执事长老', realmIndex: 3, realmName: '元婴', contrib: 4000,  salaryHours: 1.4, slots: 5, discount: 0.15, unlocks: '商店 85 折' },
  { idx: 4, id: 'shouzuo',   name: '首座',     realmIndex: 4, realmName: '化神', contrib: 12000, salaryHours: 2.0, slots: 5, discount: 0.15, unlocks: '收徒名额 +2（V5.5 弟子线已实装，见 disciples.js RECRUIT.rankBonus）' },
  { idx: 5, id: 'zhangmen',  name: '掌门',     realmIndex: 5, realmName: '炼虚', contrib: 40000, salaryHours: 3.0, slots: 5, discount: 0.15, unlocks: '收徒名额 +3；宗门宣言（轻社交待内容批次 3）' },
  // ── V6.12 批 G5a：掌门之上再加两档（idx 6/7，与 8 大境界一一对应：合体 / 大乘）──
  //   表里的 `name` 是**阵营基线兜底名**；实际称号由 worldSects.rankTitlesOf() 按「宗 > 界 > 阵营」三级取（见该文件）。
  { idx: 6, id: 'taishang',  name: '太上长老', realmIndex: 6, realmName: '合体', contrib: 120000, salaryHours: 4.0, slots: 5, discount: 0.20, unlocks: '商店 8 折；本宗顶级传承（专属本）可兑换' },
  { idx: 7, id: 'zushi',     name: '太上祖师', realmIndex: 7, realmName: '大乘', contrib: 300000, salaryHours: 5.0, slots: 5, discount: 0.25, unlocks: '商店 75 折；宗门之内已无更高之位' }
]

/**
 * 任务池（设计库 §1.3；周常大比/供奉＝内容批次 2，不进本表）
 * kind：idle 挂机计时 ｜ power 战力校验（接取时按当时基准战力 × reqMul 定标）
 * 材料：min~max 随机（成功才发）
 * hours：**游戏时辰**（不是现实小时！「巡逻 2」＝两个时辰 ≈ 现实 10 秒，见 taskDurationMs）
 *
 * ⚠ 主人 2026-09-18 修订（V3.3.1）：
 *   · **随境界变化**：每条任务带 minRealm（大境界下标，0 炼气 … 5 炼虚）。
 *     任务板只出「当前境界已解锁」的任务——低境界做粗活，高境界接重赏。
 *   · **奖励随境界增加**：贡献 = 基础 × contribOf(realmIndex)（每晋一大境界 +60%，见下）。
 *     故同一条老任务在金丹期做，悬赏也远高于炼气期。
 *   · **可提前提交**：接取后随时可交，按已办妥比例结算（SectSystem 门槛另计）。
 *
 * ⚠ 主人 2026-09-19 修订（本次）：
 *   · **到点自动交差**：限时任务（如巡山两个时辰）走满游戏时辰即自动结算入账，
 *     不必手动点「交差」（中途也可手动提前交差，按办妥比例折算）。
 *   · **战力达标即完**：power 类任务在接取瞬间若战力已 ≥ 定标需求，直接完成结算；
 *     不达标则照常计时，到时按战力概率判定成败。
 *   · **刷新周期 7 游戏天**（≈现实 7 分钟，见 SECT_REFRESH_DAYS）。
 */
export const TASKS = [
  {
    id: 'task_xunluo', name: '巡逻', kind: 'idle', hours: 2, minRealm: 0, minRank: 0,
    contrib: 60, material: null,
    desc: '在山门内外巡视两个时辰，看顾阵眼。',
    // V6.12 批 G5c：按**职位**分叉的名称与描述（取满足 minRank 的最高一档）
    variants: [
      { minRank: 0, name: '巡逻', desc: '在山门内外巡视两个时辰，看顾阵眼。' },
      { minRank: 3, name: '巡山督察', desc: '以执事之尊巡察全山：各峰阵眼、丹房火候、药圃结界，一一看过。' },
      { minRank: 6, name: '镇守山门', desc: '太上长老亲镇山门，一坐便是一季 —— 寻常弟子终其一生也见不到这一幕。' }
    ]
  },
  {
    id: 'task_caiji', name: '采集', kind: 'idle', hours: 1, minRealm: 0, minRank: 0,
    contrib: 55, material: { id: 'mat_lingcao', min: 1, max: 2 },
    desc: '去灵田采收灵草，顺手替丹房打杂。',
    variants: [
      { minRank: 0, name: '采集', desc: '去灵田采收灵草，顺手替丹房打杂。' },
      { minRank: 2, name: '督采灵田', desc: '督着一整片药圃的采收 —— 哪畦该催、哪株该留，你说了算。' },
      { minRank: 5, name: '勘定药脉', desc: '为宗门勘定新药脉：灵气走向、土性寒温，一笔定下百年药源。' }
    ]
  },
  {
    id: 'task_husong', name: '护送', kind: 'power', hours: 2, minRealm: 0, minRank: 0,
    contrib: 80, material: null, reqMul: 1.2, failHalf: true,
    desc: '护送商队过乱石岭，路上或有妖人劫道（战力校验，失败贡献减半）。',
    variants: [
      { minRank: 0, name: '护送', desc: '护送商队过乱石岭，路上或有妖人劫道（战力校验，失败贡献减半）。' },
      { minRank: 3, name: '接引外宾', desc: '代宗门迎送他派修士：礼数、路线、暗哨，一样都不能出错。' }
    ]
  },
  {
    id: 'task_chuyao', name: '除妖', kind: 'power', hours: 3, minRealm: 0, minRank: 0,
    contrib: 100, material: { id: 'mat_yaohu', min: 1, max: 2 }, reqMul: 1.5, failHalf: true,
    desc: '清剿啸月岭妖兽，取其精血交差（战力校验，失败贡献减半且无材料）。',
    variants: [
      { minRank: 0, name: '除妖', desc: '清剿啸月岭妖兽，取其精血交差（战力校验，失败贡献减半且无材料）。' },
      { minRank: 4, name: '讨伐妖王', desc: '亲率一队弟子讨伐盘踞多年的妖王 —— 此活只有首座以上才接得下。' }
    ]
  },
  // ═══ 筑基起（minRealm 1~4）：随境界解锁的重赏活计 ═══
  {
    id: 'task_yujian', name: '御剑巡山', kind: 'idle', hours: 2, minRealm: 1, minRank: 0,
    contrib: 140, material: { id: 'mat_lingcao', min: 2, max: 3 },
    desc: '御剑绕宗门辖境一周，勘验护山大阵有无松动。',
    variants: [
      { minRank: 0, name: '御剑巡山', desc: '御剑绕宗门辖境一周，勘验护山大阵有无松动。' },
      { minRank: 5, name: '坐镇护山大阵', desc: '不巡不查，只坐阵眼：阵在则宗在，阵破则你先知道。' }
    ]
  },
  {
    id: 'task_hufang', name: '丹房护火', kind: 'idle', hours: 3, minRealm: 2, minRank: 0,
    contrib: 220, material: { id: 'mat_qinglingcao', min: 1, max: 2 },
    desc: '替长老看住丹炉地火七日不熄，出丹时分得一份清灵草。',
    variants: [
      { minRank: 0, name: '丹房护火', desc: '替长老看住丹炉地火七日不熄，出丹时分得一份清灵草。' },
      { minRank: 3, name: '主持开炉', desc: '一炉九转丹由你主持：火候、投料、开炉时辰，出丹成败皆系于此。' }
    ]
  },
  {
    id: 'task_zhanyaomo', name: '镇压心魔', kind: 'power', hours: 4, minRealm: 3, minRank: 0,
    contrib: 320, material: { id: 'mat_yaodan', min: 1, max: 2 }, reqMul: 1.35, failHalf: true,
    desc: '入镇魔窟清剿心魔余孽（战力校验，失败贡献减半且无材料）。',
    variants: [
      { minRank: 0, name: '镇压心魔', desc: '入镇魔窟清剿心魔余孽（战力校验，失败贡献减半且无材料）。' },
      { minRank: 6, name: '镇守心魔窟', desc: '不再剿杀，只镇守 —— 你坐在洞口，窟里的东西便不敢动。' }
    ]
  },
  {
    id: 'task_tianji', name: '天机勘秘', kind: 'power', hours: 5, minRealm: 4, minRank: 0,
    contrib: 460, material: { id: 'mat_kuang', min: 2, max: 3 }, reqMul: 1.5, failHalf: true,
    desc: '循天机榜残图探一处上古禁地（战力校验，失败贡献减半且无材料）。',
    variants: [
      { minRank: 0, name: '天机勘秘', desc: '循天机榜残图探一处上古禁地（战力校验，失败贡献减半且无材料）。' },
      { minRank: 6, name: '定夺禁地归属', desc: '禁地开与不开、归谁看守 —— 此等决断，历来只由太上长老落笔。' }
    ]
  },
  // ═══ V6.12 批 G5a：**职责任务**（高职级专属；职级不够者既看不到、也接不到）═══
  {
    id: 'task_chuangong', name: '传功授业', kind: 'idle', hours: 3, minRealm: 3, minRank: 3,
    contrib: 300, material: null,
    desc: '为门下弟子讲法三日：讲什么、不讲什么，都是你的分寸。',
    variants: [
      { minRank: 3, name: '传功授业', desc: '为门下弟子讲法三日：讲什么、不讲什么，都是你的分寸。' },
      { minRank: 6, name: '开坛论道', desc: '一坛论道，全宗听讲 —— 你随口一句，可能就是某个弟子一生的路。' }
    ]
  },
  {
    id: 'task_zhuchi_dabi', name: '主持大比', kind: 'idle', hours: 4, minRealm: 4, minRank: 4,
    contrib: 420, material: null,
    desc: '主持一届宗门大比：排场次、定规矩、判胜负，全门都在看你的公道。',
    variants: [
      { minRank: 4, name: '主持大比', desc: '主持一届宗门大比：排场次、定规矩、判胜负，全门都在看你的公道。' }
    ]
  },
  {
    id: 'task_zhenshou', name: '镇守禁地', kind: 'power', hours: 5, minRealm: 4, minRank: 5,
    contrib: 520, material: { id: 'mat_kuang', min: 1, max: 2 }, reqMul: 1.6, failHalf: true,
    desc: '独镇宗门禁地一季。禁地里有东西在动，而你是唯一知道的人（战力校验）。',
    variants: [
      { minRank: 5, name: '镇守禁地', desc: '独镇宗门禁地一季。禁地里有东西在动，而你是唯一知道的人（战力校验）。' }
    ]
  },
  {
    id: 'task_dingce', name: '定宗门大计', kind: 'idle', hours: 5, minRealm: 5, minRank: 6,
    contrib: 800, material: null,
    desc: '定下宗门未来百年的路子：收不收人、结不结盟、争不争那一口气。',
    variants: [
      { minRank: 6, name: '定宗门大计', desc: '定下宗门未来百年的路子：收不收人、结不结盟、争不争那一口气。' }
    ]
  }
]

/**
 * V6.12 批 G5c：取某条任务在**某职位**下应显示的名称与描述。
 *   取满足 `minRank` 的**最高一档**变体；未写 `variants` 的任务回落自身 `name`/`desc` ——
 *   故既有的旧断言（读 `def.name` / `def.desc`）行为不变。
 */
export function taskTextOf (def, rankIdx = 0) {
  if (!def) return { name: '', desc: '' }
  const k = Math.max(0, rankIdx | 0)
  let hit = null
  for (const v of (def.variants || [])) {
    if ((v.minRank | 0) <= k && (!hit || (v.minRank | 0) >= (hit.minRank | 0))) hit = v
  }
  return {
    name: (hit && hit.name) || def.name,
    desc: (hit && hit.desc) || def.desc
  }
}

/**
 * 任务悬赏随境界的放大量（主人口径「跟随境界奖励增加」）：
 *   contrib = 基础 × (1 + 0.6 × 大境界下标)，下标钳在 0~5（炼气=原值）。
 * 放在 data 层做纯函数，SectSystem 与自测共用同一口径。
 */
export const CONTRIB_GROWTH = 0.6

/**
 * 贡献 / 大比 / 师徒恩义的**境界倍率上界**（0~5 ＝ 炼气~炼虚）。
 *   ⚠ **与职级档数解耦**（V6.12 批 G5a）：职级由 6 档扩到 8 档时，若此处仍写
 *     `RANKS.length - 1`，合体 / 大乘的贡献倍率会从 4.0× 悄悄解封到 4.6× / 5.2× ——
 *     那是「加职位」顺带改了数值，属不该发生的副作用。故钉成显式常量。
 */
export const CONTRIB_REALM_CAP = 5

export function contribOf (def, realmIndex = 0) {
  if (!def) return 0
  const k = Math.max(0, Math.min(CONTRIB_REALM_CAP, realmIndex | 0))
  return Math.max(1, Math.round(def.contrib * (1 + CONTRIB_GROWTH * k)))
}

/**
 * 宗门按境界下发的「普通功法」（主人 2026-09-18：入宗后宗门会按修为境界给功法）。
 * 一档一池：每晋一大境界，宗门从该档池里补一本你还没有的（池空则跳过）。
 * 池内全部取自 LIBRARY（藏经阁在册的普通功法），高阶功法仍归秘境 / 贡献兑换。
 */
export const REALM_GRANTS = [
  // 炼气档只发《粗浅炼体诀》（外门强身）；《杂灵归元诀》等留给贡献借阅，两者不冲突
  { realmIndex: 0, label: '炼气', pool: ['tech_ti_rumen'] },
  { realmIndex: 1, label: '筑基', pool: ['tech_changchun', 'tech_liuhuo', 'tech_hanquan'] },
  { realmIndex: 2, label: '金丹', pool: ['tech_gengjin', 'tech_baicao', 'tech_houtu'] },
  { realmIndex: 3, label: '元婴', pool: ['tech_qingmu'] },
  { realmIndex: 4, label: '化神', pool: [] },
  { realmIndex: 5, label: '炼虚', pool: [] }
]

/** 取某境界档的下发池（未登记返回空池） */
export function realmGrant (realmIndex) {
  return REALM_GRANTS.find((g) => g.realmIndex === (realmIndex | 0)) || { realmIndex: realmIndex | 0, label: '', pool: [] }
}

/** 藏经阁（只收 techniques.js 中 source.type === 'sect_store' 的功法；rank = 借阅所需职级下标）
 *  V3.5.1（主人：贡献兑换的功法不该全是普通货色）：追加玄阶两本 + 地阶镇派一本，
 *  高贡献高职级门槛——贡献从「换丹药的材料钱」变成「换真传的路条」。 */
export const LIBRARY = [
  { id: 'tech_zaling',    cost: 500,  rank: 0 },
  { id: 'tech_ti_rumen',  cost: 500,  rank: 0 },
  { id: 'tech_changchun', cost: 1000, rank: 0 },
  { id: 'tech_liuhuo',    cost: 1000, rank: 0 },
  { id: 'tech_hanquan',   cost: 1000, rank: 0 },
  { id: 'tech_gengjin',   cost: 1000, rank: 0 },
  { id: 'tech_baicao',    cost: 1000, rank: 0 },
  { id: 'tech_houtu',     cost: 1000, rank: 0 },
  { id: 'tech_qingmu',    cost: 3000, rank: 1 },
  { id: 'tech_ziyang',    cost: 8000,  rank: 1 },   // 玄阶 · 内门起
  { id: 'tech_fengleijian', cost: 12000, rank: 2 }, // 玄阶 · 真传起
  { id: 'tech_tianlan',   cost: 30000, rank: 3 }    // 地阶镇派 · 执事起
]

/** 宗门商店（V3.5.1 · 主人：兑换材料过于普通 → 从 4 条扩到 10 条，起新材料与高阶丹药；
 *  折扣按职级，见 RANKS.discount。价格对齐 market.js 货值表，贡献价 ≈ 货值 × 1.2 上下） */
export const SHOP = [
  { id: 'mat_fuzhi',       cost: 60,  n: 2 },
  { id: 'mat_lingcao',     cost: 100, n: 1 },
  { id: 'mat_kuang',       cost: 150, n: 1 },
  { id: 'mat_qinglingcao', cost: 200, n: 1 },
  { id: 'mat_yaohu',       cost: 280, n: 1 },
  { id: 'mat_yaodan',      cost: 320, n: 1 },
  { id: 'pill_ningshen',   cost: 350, n: 1 },
  { id: 'pill_pojing',     cost: 400, n: 1 },
  { id: 'pill_hujie',      cost: 600, n: 1 },
  { id: 'mat_wannianru',   cost: 1100, n: 1 }
]

/**
 * 任务板刷新周期（主人 2026-09-19：宗门任务单独设为 **7 游戏天**）
 *   新换算：1 现实分钟 = 1 游戏天 → 7 游戏天 ≈ 现实 7 分钟一轮。
 *   坊市 / 万兽林寻蛋仍走 gametime.REFRESH_DAYS（30 游戏天 ≈ 现实 30 分钟），
 *   两处互不影响：各自用 periodKeyOf / msToNextPeriod 传自己的周期毫秒。
 */
export const SECT_REFRESH_DAYS = 7

/** 宗门一轮对应的现实毫秒 */
export function sectRefreshMs () {
  return gameDaysToMs(SECT_REFRESH_DAYS)
}

/** 宗门任务板的轮次键（同一轮内幂等） */
export function sectDayKey (ts) {
  return periodKeyOf(ts, sectRefreshMs())
}

/** 距下一轮任务板刷新还有多久（现实毫秒） */
export function sectMsToNextRefresh (ts) {
  return msToNextPeriod(ts, sectRefreshMs())
}

/** 宗门任务板的周期文案：`每 7 游戏天（约现实 7 分钟）` */
export function fmtSectRefreshPeriod () {
  return `每 ${SECT_REFRESH_DAYS} 游戏天（约现实 ${fmtRealMinutes(sectRefreshMs())}）`
}

/**
 * 任务限时（**游戏时辰** → 现实毫秒）
 *   「巡山两个时辰」＝ 2 时辰 ＝ 2/12 游戏天 ≈ 现实 10 秒（新换算下）
 */
export function taskDurationMs (def) {
  return gameHoursToMs(def && def.hours ? def.hours : 0)
}

/** 任务限时的游戏历文案（面板展示）：`2 时辰` */
export function taskDurationText (def) {
  return `${(def && def.hours) || 0} 时辰`
}

/** 取任务定义；未登记 id 返回 null（老档不至于崩） */
export function getTask (id) {
  return TASKS.find((t) => t.id === id) || null
}

/**
 * ═══ V5.5.1 弟子线后续批（B2）：周常·宗门大比 / 周常·供奉（设计库《宗门与弟子 v1》§1.3 任务与贡献表）═══
 * 口径：
 *   · 「周常」＝每 7 游戏天（≈现实 7 分钟，与任务板 SECT_REFRESH_DAYS 同源）一轮，各自记周期键幂等
 *   · 大比：贡献 300~1000（设计库原值）随境界 ×(1+0.6×大境界)（同任务板 CONTRIB_GROWTH 口径）；
 *     设计稿的「＋灵石」奖按压缩日历（1 现实分钟 = 1 游戏天）会放大 ~205 倍/日、直接顶破
 *     开发册 §七「宗门线 ≤15%」护栏 → 本批裁除灵石奖、保留头衔荣誉（详见回执-B2 §4/§5 需拍板）
 *   · 供奉：贡献 = 货值（market.js 货值表，由调用方传入）× 份数 × 1.2（设计库「贡献 ×1.2 折算」）；
 *     每轮限一次、每次至多 10 份 —— 堵「商店买符纸 → 供奉回血」的刷贡献回路
 *     （灵纹符纸商店 60 贡献/2 份，若不限量供奉 40×1.2×2=96 会变成贡献打印机）
 */

/** 周常·宗门大比（设计库 §1.3「周常·宗门大比｜周结算｜贡献 300~1000＋灵石＋头衔」） */
export const DABI = {
  days: 7,                    // 周常周期：7 游戏天 ≈ 现实 7 分钟（与任务板同源）
  contribMin: 300,            // 设计库 §1.3 原值（随境界再放大，见 dabiContribOf）
  contribMax: 1000,
  reqMul: 1.2,                // 大比定标＝基准战力 × 1.2（同「护送」口径）
  titleTop: '大比魁首',        // rate ≥ 0.9
  titleMid: '大比之秀',        // rate ≥ 0.6
  titleLow: '大比优胜',
  /**
   * V6.4 批 D3：12 界大比头衔（**青岚取原字面** → 默认界与既有断言逐位不变）。
   * 口径：头衔是「这一界怎么称呼一次好名次」，2~4 字为宜（面板行内显示）。
   */
  titleByWorld: {
    qinglan: { top: '大比魁首', mid: '大比之秀', low: '大比优胜' },
    poxiao: { top: '逆星夺魁', mid: '榜上有名', low: '尚在人间' },
    denghuo: { top: '算无遗策', mid: '稳中有进', low: '全身而退' },
    qingyun: { top: '剑压群英', mid: '名列前茅', low: '初露锋芒' },
    wangzu: { top: '族中魁首', mid: '支脉之秀', low: '崭露头角' },
    younuo: { top: '真伪莫辨', mid: '胆气过人', low: '全身而返' },
    tongtian: { top: '活得最久', mid: '稳扎稳打', low: '重在参与' },
    tiangong: { top: '匠造第一', mid: '巧手之作', low: '已然上手' },
    liumian: { top: '盲盒之王', mid: '运气不错', low: '聊胜于无' },
    jiuding: { top: '功德魁首', mid: '善行可嘉', low: '与有荣焉' },
    wuyuan: { top: '走满一线', mid: '无暇之姿', low: '有缺待补' },
    xianghuo: { top: '香火最盛', mid: '愿力可期', low: '信众初聚' }
  }
}

/**
 * 大比头衔（V6.4 批 D3）：按当前世界取本界头衔。
 * 未抽定 / 未登记界 → 回落 `DABI.titleTop / titleMid / titleLow`（青岚在表内且值与原字面相同，
 * 故默认界与 V5.5.1 既有断言一字不变）。
 * @param {string} worldId state.world.worldId
 * @param {'top'|'mid'|'low'} tier
 */
export function dabiTitleOf (worldId, tier) {
  const t = DABI.titleByWorld[worldId]
  if (t && t[tier]) return t[tier]
  return tier === 'top' ? DABI.titleTop : tier === 'mid' ? DABI.titleMid : DABI.titleLow
}

/** 大比一轮的周期毫秒 / 周期键（同一届内幂等）/ 距下一届（现实毫秒） */
export function dabiRefreshMs () {
  return gameDaysToMs(DABI.days)
}

export function dabiKeyOf (ts) {
  return periodKeyOf(ts, dabiRefreshMs())
}

export function dabiMsToNext (ts) {
  return msToNextPeriod(ts, dabiRefreshMs())
}

/**
 * 大比贡献：rate∈[0.25, 0.95]（战力比率，同任务板成功率 clamp 口径）
 *   → 带内插值 × 境界增长（CONTRIB_GROWTH，与 contribOf 同一旋钮）
 */
export function dabiContribOf (rate, realmIndex = 0) {
  const r = Math.min(0.95, Math.max(0.25, Number(rate) || 0))
  const base = DABI.contribMin + (DABI.contribMax - DABI.contribMin) * r
  const k = Math.max(0, Math.min(CONTRIB_REALM_CAP, realmIndex | 0))
  return Math.max(1, Math.round(base * (1 + CONTRIB_GROWTH * k)))
}

/** 周常·供奉（设计库 §1.3「周常·供奉｜捐献材料｜贡献 ×1.2 折算」） */
export const OFFERING = { rate: 1.2, maxUnits: 10 }

/** 供奉折算（纯函数）：货值 × 份数 × 1.2（四舍五入） */
export function offeringContrib (valuePerUnit, n) {
  return Math.max(0, Math.round((Number(valuePerUnit) || 0) * Math.max(0, n | 0) * OFFERING.rate))
}

export default {
  SECT, DAO_TONG, RANKS, TASKS, LIBRARY, SHOP, REALM_GRANTS, CONTRIB_GROWTH,
  CONTRIB_REALM_CAP,   // V6.12 批 G5a：境界倍率上界（与职级档数解耦）
  taskTextOf,          // V6.12 批 G5c：任务按职位分叉的名称/描述
  DABI, dabiRefreshMs, dabiKeyOf, dabiMsToNext, dabiContribOf,
  OFFERING, offeringContrib,
  SECT_REFRESH_DAYS, sectRefreshMs, sectDayKey, sectMsToNextRefresh, fmtSectRefreshPeriod,
  taskDurationMs, taskDurationText, REFRESH_DAYS,
  getTask, contribOf, realmGrant
}
