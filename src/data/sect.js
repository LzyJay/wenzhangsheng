/**
 * sect.js —— 宗门表（只读配置层）（2.4）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《宗门与弟子 v1》第一部分 +《问长生-开发计划》§四 模块 2.4
 * 范围：云岚宗（青岚界）· 道统 · 六档职级俸禄 · 任务板 · 藏经阁 · 贡献商店
 *       （弟子线＝设计库内容批次 2/3 内容，不在本模块；世界名册每界 3 宗＝2.9 世界卡池接入）
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
  { idx: 4, id: 'shouzuo',   name: '首座',     realmIndex: 4, realmName: '化神', contrib: 12000, salaryHours: 2.0, slots: 5, discount: 0.15, unlocks: '收徒名额 +2（弟子线待内容批次 2）' },
  { idx: 5, id: 'zhangmen',  name: '掌门',     realmIndex: 5, realmName: '炼虚', contrib: 40000, salaryHours: 3.0, slots: 5, discount: 0.15, unlocks: '宗门宣言（轻社交待内容批次 3）' }
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
    id: 'task_xunluo', name: '巡逻', kind: 'idle', hours: 2, minRealm: 0,
    contrib: 60, material: null,
    desc: '在山门内外巡视两个时辰，看顾阵眼。'
  },
  {
    id: 'task_caiji', name: '采集', kind: 'idle', hours: 1, minRealm: 0,
    contrib: 55, material: { id: 'mat_lingcao', min: 1, max: 2 },
    desc: '去灵田采收灵草，顺手替丹房打杂。'
  },
  {
    id: 'task_husong', name: '护送', kind: 'power', hours: 2, minRealm: 0,
    contrib: 80, material: null, reqMul: 1.2, failHalf: true,
    desc: '护送商队过乱石岭，路上或有妖人劫道（战力校验，失败贡献减半）。'
  },
  {
    id: 'task_chuyao', name: '除妖', kind: 'power', hours: 3, minRealm: 0,
    contrib: 100, material: { id: 'mat_yaohu', min: 1, max: 2 }, reqMul: 1.5, failHalf: true,
    desc: '清剿啸月岭妖兽，取其精血交差（战力校验，失败贡献减半且无材料）。'
  },
  // ═══ 筑基起（minRealm 1~4）：随境界解锁的重赏活计 ═══
  {
    id: 'task_yujian', name: '御剑巡山', kind: 'idle', hours: 2, minRealm: 1,
    contrib: 140, material: { id: 'mat_lingcao', min: 2, max: 3 },
    desc: '御剑绕宗门辖境一周，勘验护山大阵有无松动。'
  },
  {
    id: 'task_hufang', name: '丹房护火', kind: 'idle', hours: 3, minRealm: 2,
    contrib: 220, material: { id: 'mat_qinglingcao', min: 1, max: 2 },
    desc: '替长老看住丹炉地火七日不熄，出丹时分得一份清灵草。'
  },
  {
    id: 'task_zhanyaomo', name: '镇压心魔', kind: 'power', hours: 4, minRealm: 3,
    contrib: 320, material: { id: 'mat_yaodan', min: 1, max: 2 }, reqMul: 1.35, failHalf: true,
    desc: '入镇魔窟清剿心魔余孽（战力校验，失败贡献减半且无材料）。'
  },
  {
    id: 'task_tianji', name: '天机勘秘', kind: 'power', hours: 5, minRealm: 4,
    contrib: 460, material: { id: 'mat_kuang', min: 2, max: 3 }, reqMul: 1.5, failHalf: true,
    desc: '循天机榜残图探一处上古禁地（战力校验，失败贡献减半且无材料）。'
  }
]

/**
 * 任务悬赏随境界的放大量（主人口径「跟随境界奖励增加」）：
 *   contrib = 基础 × (1 + 0.6 × 大境界下标)，下标钳在 0~5（炼气=原值）。
 * 放在 data 层做纯函数，SectSystem 与自测共用同一口径。
 */
export const CONTRIB_GROWTH = 0.6

export function contribOf (def, realmIndex = 0) {
  if (!def) return 0
  const k = Math.max(0, Math.min(RANKS.length - 1, realmIndex | 0))
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

export default {
  SECT, DAO_TONG, RANKS, TASKS, LIBRARY, SHOP, REALM_GRANTS, CONTRIB_GROWTH,
  SECT_REFRESH_DAYS, sectRefreshMs, sectDayKey, sectMsToNextRefresh, fmtSectRefreshPeriod,
  taskDurationMs, taskDurationText, REFRESH_DAYS,
  getTask, contribOf, realmGrant
}
