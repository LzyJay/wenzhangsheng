/**
 * worldEvents.js —— 世界事件修正（只读配置层）（V6.9 · 批 G）
 * ═══════════════════════════════════════════════════════════════════════════
 * 用途：把各界 `friction` 里**落在事件侧**的那几句原文落成可玩数值。只登记「有原文依据」的界，
 *   其余界一律走 `EVENT_MOD_DEFAULT`（**全中性 → 采样与结算逐位不变**）。
 *
 * 两项修正：
 *   ① `catWeightMul` —— 类别权重倍率（幽傩「心魔事件 ×2」：灾劫类加权，负面更密）
 *   ② `negativeMul`  —— **负面**强度倍率（通天「喜剧类事件负面强度 −10%」，增补 v1.2 §07）
 *
 * 口径：
 *   · 权重倍率只在「非机缘」分支生效（机缘那支由气运档位 `goodPct` 决定，不掺世界修正）；
 *     倍率全 1 时与旧的 `1/3 · 1/3 · 1/3` 等权**逐位等价**（自测断言）。
 *   · 强度倍率只作用于**负值**（`qiH < 0` / `stonesH < 0`），收益不放大 —— 是"减负"不是"加福"。
 *   · 数值写在此处，`EventSystem` 只读不算（不写死数字）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 各界事件修正（只登记有原文依据者） */
export const WORLD_EVENT_MODS = {
  younuo: {
    catWeightMul: { zaijie: 2, enyuan: 1.5 },
    note: '心魔 ×2（worlds.js friction）：灾劫类权重 ×2、恩怨类 ×1.5 —— 高收益之下，是随时噬人的黑暗。'
  },
  tongtian: {
    negativeMul: 0.9,
    note: '喜剧类事件负面强度 −10%（增补 v1.2 §07）：此界的天道可以讲价，坏事也没那么坏。'
  }
}

/** 中性档（未登记界一律取此档 → 采样与结算逐位不变） */
export const EVENT_MOD_DEFAULT = { catWeightMul: {}, negativeMul: 1 }

/**
 * 取某界的事件修正；未登记 / 未抽定界返回中性档（不抛错）。
 * @returns {{catWeightMul:object, negativeMul:number, note?:string}}
 */
export function eventModsOf (worldId) {
  const m = WORLD_EVENT_MODS[worldId]
  if (!m) return EVENT_MOD_DEFAULT
  return {
    catWeightMul: m.catWeightMul || {},
    negativeMul: (typeof m.negativeMul === 'number' && m.negativeMul > 0) ? m.negativeMul : 1,
    note: m.note || ''
  }
}

export default { WORLD_EVENT_MODS, EVENT_MOD_DEFAULT, eventModsOf }
