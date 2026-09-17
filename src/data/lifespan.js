/**
 * lifespan.js —— 寿元参数（只读配置层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：《设计增补 v1.1》§天道·寿元 —— 寿元时钟
 *
 *   时间流速（主人 2026-09-19 统一口径）：**1 现实分钟 = 1 游戏天**
 *     → gameDaysPerRealSecond = 1/60，与 data/gametime.js 的日程历**同源**
 *     （世界摩擦项＝按倍率缩放，见 worlds.js 的 lifespanMul：幽傩 ×1.25、人间香火 ×1.5）。
 *   破境续命：每次晋入新大境界，寿元上限更新为该境基础值并**立即回满**
 *   基础寿元：炼气 100 / 筑基 200 / 金丹 600 / 元婴 1200 / 化神 2500 / 炼虚 5000 / 合体 10000 / 大乘 20000（年）
 *             —— 落在 realms.js 的 REALM_META.lifespanYears
 *   延寿丹：+50 年（日常）／+500 年（高品）—— 阶段二随丹药系统接入
 *   寿元 < 20% 警告；耗尽 = 坐化（强制转世，无额外惩罚）
 *
 * 换算（供 intuition 用）：炼气 100 年 = 36000 游戏天 = 600 现实小时 = 25 现实天；
 *   元婴 1200 年 ≈ 300 现实天；大乘 20000 年 ≈ 13.7 现实年。
 *   因游戏历与寿元同源，"道历过了 N 年"＝"寿元流逝 N 年"，两个时钟不再打架。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const LIFESPAN = {
  /** 时间流速：每个现实秒流逝多少"游戏天"（＝1/60，即 1 现实分钟 = 1 游戏天） */
  gameDaysPerRealSecond: 1 / 60,
  /** 低于该比例开始警告 */
  warnPct: 0.2,
  /** 每游戏年的天数（与 gametime.GAME_TIME.daysPerYear 同口径：12 月 × 30 天） */
  daysPerYear: 360,
  /** 延寿丹（阶段二实装，先登记口径） */
  pill: { daily: 50, high: 500 }
}

/** 每个现实秒流逝多少"游戏年" */
export function yearsPerRealSecond (daysPerRealSecond = LIFESPAN.gameDaysPerRealSecond) {
  return daysPerRealSecond / LIFESPAN.daysPerYear
}

/** 寿元上限对应的现实时长（毫秒）——用于展示"这一境能撑多久" */
export function maxYearsToRealMs (years, daysPerRealSecond = LIFESPAN.gameDaysPerRealSecond) {
  return (years / yearsPerRealSecond(daysPerRealSecond)) * 1000
}

// ═════════════════════════════════════════════════════════════════════════════
// 2.11 天道契合（顺天值）——《设计增补 v1.1》§一「天道人格化与顺天体系」
// ═════════════════════════════════════════════════════════════════════════════
// · 顺天值 0–100，初始 50（数据模型 §四 player.fit）；六档修正产出与渡劫
// · cultPct = 修炼（灵气产出）加成；trialPct = 渡劫单雷通过率修正（§一二五两列口径）
//   ⚖ 拍板项：设计原文天谴档为「天劫需求 +15%」，本项目按"单雷 −15%"折算（需求乘区
//     在裸战力比口径下不可观测），主人若要改回需求侧只需改此一处。
// · goodEventPct（好事件概率修正）按 v1.1 表登记，但 2.3 事件系统尚未消费，先记档
// ═════════════════════════════════════════════════════════════════════════════
export const FIT = {
  initial: 50,
  tiers: [
    { id: 'fit_tianqian', name: '天谴', min: 0, max: 19, cultPct: -0.20, trialPct: -0.15, goodEventPct: -0.10 },
    { id: 'fit_shuli', name: '疏离', min: 20, max: 39, cultPct: -0.08, trialPct: -0.05, goodEventPct: 0 },
    { id: 'fit_fanchang', name: '凡常', min: 40, max: 59, cultPct: 0, trialPct: 0, goodEventPct: 0 },
    { id: 'fit_gantian', name: '感天', min: 60, max: 79, cultPct: 0.08, trialPct: 0.03, goodEventPct: 0 },
    { id: 'fit_tianjuan', name: '天眷', min: 80, max: 94, cultPct: 0.18, trialPct: 0.06, goodEventPct: 0 },
    { id: 'fit_tianming', name: '天命', min: 95, max: 100, cultPct: 0.30, trialPct: 0.10, goodEventPct: 0 }
  ],
  /**
   * 天机榜任务（增补 v1.1 §一 样例前 3 条 MVP；渡人向善随事件契合果报自动入账、
   * 平息正魔纷争待阵营线，均不单列）。任务可循环，冷却 ⚖ 30 分钟现实时间。
   */
  quests: {
    cdMs: 30 * 60 * 1000,
    list: [
      { id: 'fitq_village', name: '护佑村庄', kind: 'idle', idleSec: 7200, fit: 3,
        desc: '在线挂机护佑一方生民' },
      { id: 'fitq_yaohuan', name: '清扫妖患', kind: 'power', powerScale: 1.0, fit: 4,
        desc: '交付时校验战力（须达本境基准）' },
      { id: 'fitq_rain', name: '布雨救旱', kind: 'stones', stones: 800, stonesGrowth: 2, fit: 2,
        desc: '散财祈雨（灵石随大境界翻倍）' }
    ]
  }
}

/** 按顺天值取档位（越界值夹回 0~100） */
export function getFitTier (fit) {
  const v = Math.min(100, Math.max(0, Number.isFinite(fit) ? fit : FIT.initial))
  return FIT.tiers.find((t) => v >= t.min && v <= t.max) || FIT.tiers[2]
}

export default { LIFESPAN, yearsPerRealSecond, maxYearsToRealMs, FIT, getFitTier }
