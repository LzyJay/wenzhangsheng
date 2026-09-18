/**
 * beastWaves.js —— 兽潮与灵兽大比参数表（只读配置层）（2.8 · V5.6）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《灵兽兽潮与大比 v1》§1.5（兽潮线）+ §2（宗门大比 · 首批取「灵兽
 *       编队上场评比 + 名次分档奖励」简化版，弟子助战 / 赛季 / 限定称号留后续批）。
 * 范围（首批）：
 *   · 兽潮：周期来犯（每 5 个「刷新日」一轮 · 一轮三波低/中/高）+ 抵御结算
 *     （个人 DPS＝战力×0.1 · 讨伐期间灵兽出战加成 ×1.2 · 高波贡献定档发奖）+ 掉蛋保底
 *   · 大比：周期评比（每 7 个「刷新日」一届 · 16 强镜像对阵）+ 名次分档奖励（§2.3 表）
 * V5.6.1（C2）已补：奖励池扩「觉醒石 / 兽王精华」（设计库 §1.5 奖励池原文），
 *   供血脉觉醒 / 化形消耗（参数在 data/beasts.js 的 AWAKEN / MORPH）。
 * V5.6.2（C3）已改：大比镜像换锚 —— NPC 分数锚到「档位基准分」（随大境界递进）而非玩家
 *   自己的分数，使编队强度真正决定名次（参数 CONTEST.span / swing / baseScore）。
 * 未进本批（后续批 / 其他域）：全服共享血池 / 防线限时秘境 / 斗法丹 / 赛季积分与
 *   限定称号（称号表在 achievements 域，跨域不动）/ 代采（产出线，需另立周期，见 C2 清单 §5）。
 *
 * 口径：
 *   · 周期同源（硬口径）：一律 periodKeyOf(ts, cycleMs)，不另立时钟 ——
 *     设计库原稿「每 5 天一轮 / 7 日循环」按现实日写就；主人口径「1 现实分钟 = 1 游戏天」
 *     后，本游戏的一个「刷新日」＝ gametime.REFRESH_DAYS = 30 游戏天（坊市 / 寻蛋 /
 *     宗门任务板同一把尺），故折算为 5×30 / 7×30 游戏天，保持设计稿的节奏比例。
 *   · 个人 DPS（§1.5「个人 DPS＝战力×0.1」）：战力＝境界基准 × (1 + 灵兽出战加成)，
 *     讨伐期间整体 ×WAVE.beastMul（1.2）——「兽潮加成」落在这一个乘区。
 *   · 贡献档：个人伤害 ÷ 波次血池（境界基准 × hpPer），**以最险的高波定整轮档位**；
 *     门槛按「无兽参战＝参与 / 单只出战＝中坚 / 满编高星＝前列」校准（WAVE_TIERS.shareMin）。
 *   · 掉蛋保底（§1.2「每 3 次兽潮必出 1 枚灵品以上」）：连续 pityEvery 次抵御未出蛋
 *     → 下一波必出（灵品以上；王品蛋另按 wangChance 概率）。
 *   · 大比评分＝Σ(品级战力% × 等级系数 × 星级系数 × 编队权重) × scorePer（**本式未动**）；
 *     16 强镜像（V5.6.2 换锚）＝15 名 NPC 锚到「档位基准分 baseScore[大境界]」沿 ±span
 *     铺开，全队再乘每届 swing 浮动 —— 基准不依赖玩家分数，故编队越强名次越好。
 *     ⚠ 旧式「npc = score × 系数」判 npc > score 会把 score 约掉（⟺ u > 0.7667，恒 4.50 名），
 *     名次与强度无关 —— C1 首批近似过头的缺陷，V5.6.2 修正；真 percentile 分位仍留后续批。
 *   · 大比奖励＝§2.3 内门档基准表 ÷ 48（一届 ≈ 1/48 周），折灵石走 events.stoneHourly
 *     （与秘境 / 事件同一量纲）；档位系数（外门 0.6 / 内门 1.0 / 真传 1.8 / 长老 3.0）
 *     按大境界序取（§2.3）。设计库原文「奖励计入宗门线预算」：本批归因按任务卡硬口径
 *     走既有 beast 线（不新增线），占比账在回执里单独说明。
 *   · 产出不发境界：奖励只有 灵石 / 妖丹 / 灵兽蛋 / 觉醒石 / 兽王精华（后两件 V5.6.1 起登记，
 *     均为养成介质、不可折灵石，故**不进 beast 归因线**）。
 *   · 存档叶子：state.beast.wave / state.beast.contest（BeastSystem ensure 懒建，零迁移）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { REFRESH_DAYS, gameDaysToMs, periodKeyOf, msToNextPeriod } from './gametime.js'

/** 兽潮线参数（设计库 §1.5；周期＝5 个刷新日） */
export const WAVE = {
  unlockRealmIndex: 2,                      // 金丹起有兽潮来犯（与万兽林同门槛）
  cycleDays: 5 * REFRESH_DAYS,              // 150 游戏天 ≈ 现实 2.5 小时一轮
  waves: [                                  // 一轮三波：低 / 中 / 高（hpPer＝血池 ÷ 境界基准战力）
    { id: 'low', name: '低波', hpPer: 0.6 },
    { id: 'mid', name: '中波', hpPer: 0.9 },
    { id: 'high', name: '高波', hpPer: 1.2 }
  ],
  dpsCoef: 0.1,                             // 个人 DPS ＝ 战力 × 0.1（§1.5）
  beastMul: 1.2,                            // 讨伐期间灵兽出战加成 ×1.2（§1.5「兽潮加成」）
  rewardH: { front: 0.09, mid: 0.07, join: 0.05 },   // 每次抵御的灵石当量 h（按档；× stoneHourly）
  yaodan: { front: 3, mid: 2, join: 1 },    // 每次抵御的妖丹（按档）
  eggChance: { front: 0.30, mid: 0.15, join: 0.05 }, // 掉蛋概率（按档；掉落必为灵品以上）
  wangChance: 0.10,                         // 掉落中王品蛋占比（§1.2「击杀兽王概率掉王品蛋」首批近似）
  pityEvery: 3,                             // 连续 3 次抵御未出蛋 → 必出（§1.2 保底）
  // V5.6.1（C2）奖励池扩两件（设计库 §1.5「兽潮是灵兽养成的主水源」）：
  awakenStone: { front: 3, mid: 2, join: 1 },        // 每次抵御的觉醒石（按档；参与档也给 1，避免「无战力→无石→无战力」死锁）
  essenceChance: { front: 0.12, mid: 0.04, join: 0 } // 兽王精华掉落概率（参与档不给：境界一升即脱离参与档，不构成硬锁）
}

/** 兽潮贡献档（伤害 ÷ 高波血池；门槛按「无兽=参与 / 单只=中坚 / 满编高星=前列」校准） */
export const WAVE_TIERS = [
  { id: 'front', name: '前列', shareMin: 0.115 },
  { id: 'mid', name: '中坚', shareMin: 0.103 },
  { id: 'join', name: '参与', shareMin: 0 }
]

/**
 * 灵兽大比参数（设计库 §2 首批简化：编队上场 → 16 强镜像 → 名次奖励）
 *   rewardH ＝ §2.3 内门档基准表（灵石/材料 4h/2.5h/1.5h/0.9h/0.4h 每「周」）÷ 48 届；
 *   妖丹为首批追加的灵兽养成介质（宗门贡献跨域不发，见文件头口径）。
 */
export const CONTEST = {
  unlockRealmIndex: 2,                      // 金丹起可上场
  cycleDays: 7 * REFRESH_DAYS,              // 210 游戏天 ≈ 现实 3.5 小时一届（§2.1 七日循环的折算）
  npcs: 15,                                 // 16 强签位（§2.1 淘汰赛 16 强口径）
  // ── V5.6.2 换锚：NPC 锚到档位基准分，编队强度 → 名次 ────────────────────
  span: 0.50,                               // NPC 沿档位基准铺开 ±50%（决定「强度→名次」的灵敏度）
  swing: 0.15,                              // 每届整体浮动 ±15%（保留 §2.2「有输有赢」；原 spread 的角色）
  baseScore: [                              // 档位基准分（＝该境界「中位编队」分数；§2.2 的「同档」＝大境界）
    { from: 0, base: 60 },                  // 炼气（大比未解锁，占位）
    { from: 1, base: 75 },                  // 筑基（同上）
    { from: 2, base: 95 },                  // 金丹
    { from: 3, base: 140 },                 // 元婴
    { from: 4, base: 215 },                 // 化神
    { from: 5, base: 285 },                 // 炼虚
    { from: 6, base: 350 },                 // 合体（2 辅助位）
    { from: 7, base: 350 }                  // 大乘（同 2 辅助位，与合体同基准）
  ],
  scorePer: 1000,                           // 编队评分系数
  tiers: [                                  // 名次 → 奖励（maxRank＝该档最高名次；§2.3 表 ÷ 48）
    { id: 'champion', name: '冠军', maxRank: 1, h: 4 / 48, yaodan: 3 },
    { id: 'runner', name: '亚军', maxRank: 2, h: 2.5 / 48, yaodan: 2 },
    { id: 'semi', name: '四强', maxRank: 4, h: 1.5 / 48, yaodan: 2 },
    { id: 'quarter', name: '八强', maxRank: 8, h: 0.9 / 48, yaodan: 1 },
    { id: 'join', name: '参与', maxRank: 99, h: 0.4 / 48, yaodan: 1 }
  ],
  realmMul: [                               // 档位系数（§2.3：外门 0.6 / 内门 1.0 / 真传 1.8 / 长老 3.0）
    { from: 0, mul: 0.6 },                  // 炼气~筑基
    { from: 2, mul: 1.0 },                  // 金丹~元婴
    { from: 4, mul: 1.8 },                  // 化神~炼虚
    { from: 6, mul: 3.0 }                   // 合体~大乘
  ]
}

// ── 周期键（与坊市 / 寻蛋同源：periodKeyOf + gameDaysToMs，不另立时钟）────────
export function waveKeyOf (ts) {
  return periodKeyOf(ts, gameDaysToMs(WAVE.cycleDays))
}
export function waveMsToNext (ts) {
  return msToNextPeriod(ts, gameDaysToMs(WAVE.cycleDays))
}
export function contestKeyOf (ts) {
  return periodKeyOf(ts, gameDaysToMs(CONTEST.cycleDays))
}
export function contestMsToNext (ts) {
  return msToNextPeriod(ts, gameDaysToMs(CONTEST.cycleDays))
}

/** 兽潮贡献档：share（伤害 ÷ 波次血池）→ 档 id（自高向低取首个达标档） */
export function waveTierOfShare (share) {
  for (const t of WAVE_TIERS) if (share >= t.shareMin) return t.id
  return 'join'
}
export function waveTierRank (id) {
  const i = WAVE_TIERS.findIndex((t) => t.id === id)
  return i < 0 ? WAVE_TIERS.length - 1 : i
}
export function waveTierName (id) {
  const t = WAVE_TIERS.find((x) => x.id === id)
  return t ? t.name : '参与'
}

/** 大比名次 → 奖励档（含档对象与文案） */
export function contestTierOfRank (rank) {
  const r = Math.max(1, rank | 0)
  return CONTEST.tiers.find((t) => r <= t.maxRank) || CONTEST.tiers[CONTEST.tiers.length - 1]
}
export function contestTier (id) {
  return CONTEST.tiers.find((t) => t.id === id) || CONTEST.tiers[CONTEST.tiers.length - 1]
}
/** 大境界序 → 档位系数（§2.3；取「from ≤ realmIndex」的最后一档） */
export function contestRealmMul (realmIndex) {
  let mul = CONTEST.realmMul[0].mul
  for (const r of CONTEST.realmMul) if (realmIndex >= r.from) mul = r.mul
  return mul
}
/** 大境界序 → 大比档位基准分（V5.6.2 换锚；同款读法，取「from ≤ realmIndex」的最后一档） */
export function contestBaseScore (realmIndex) {
  let base = CONTEST.baseScore[0].base
  for (const b of CONTEST.baseScore) if (realmIndex >= b.from) base = b.base
  return base
}

export default {
  WAVE, WAVE_TIERS, CONTEST,
  waveKeyOf, waveMsToNext, contestKeyOf, contestMsToNext,
  waveTierOfShare, waveTierRank, waveTierName,
  contestTierOfRank, contestTier, contestRealmMul, contestBaseScore
}
