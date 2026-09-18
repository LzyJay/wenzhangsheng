/**
 * num.js —— 数值工具（src/util/ 零依赖叶子层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / 计划册 §13.1①）：本层为**零依赖叶子层**，
 *   禁止 import data / systems / ui / scenes / audio / DOM / Phaser；
 *   反向可被其余任意层 import。新增本层时已在开发册 §13.1 / §13.3 登记。
 *
 * 职责：全项目通用的数值小工具只此一份，杜绝各模块各自复写。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * 区间钳制：把 v 限制在 [a, b] 内（不做类型转换，调用方自行保证数值语义）。
 *
 * 本函数由 7 处 systems 的本地副本收敛而来（WorldSystem / SectSystem / MarketSystem /
 * BeastSystem / EventSystem / CultivationSystem / LifespanSystem）——7 份实现行为
 * **逐位等价**（仅写法与参数名不同），故此处为等价搬运，不改变任何分支。
 *
 * 域专用钳制（语义不同，不并入此处，保持各模块自持）：
 *   · events.js `clampNum`（气运相关，含额外取整口径）
 *   · sect.js `contribOf` / `dabiContribOf` 内联钳制
 *   · SectSystem `clampLoyalty`（忠诚值 [0, LOYALTY.max]）
 *   · disciples.js `clampLv`（弟子等级 [1, DISCIPLE_LV.max]）
 *
 * @param {number} v 待钳制的值
 * @param {number} a 下界
 * @param {number} b 上界
 * @returns {number} min(max(v, a), b)
 */
export function clamp (v, a, b) {
  return Math.min(Math.max(v, a), b)
}

/**
 * 大数简写（**显示层统一口径**）：<1万 取整（向下）／≥1万 保留两位小数加「万 / 亿 / 万亿」。
 *
 * 本函数由三处同族实现收敛而来，口径以原 `main.js` 的 `fmt` 为准（floor + 非有限值兜底），
 * 另两处随之统一（2026-09-19 主人授权「顺手统一口径」）：
 *   · `main.js fmt`      —— 原本就是此口径（floor ＋ ∞ 保护 ＋ 单位无空格），逐位不变；
 *   · `EventSystem fmtN` —— 原 <1万 用 **四舍五入** 且无 ∞ 保护 → 现随统一口径改向下取整；
 *   · `SectSystem fmtBig`—— 原 <1万 用四舍五入、单位带前导空格（「1.23 万」）→ 现去空格并取整。
 *
 * 非有限值（NaN / Infinity）返回 `∞`，避免界面出现 "NaN"。
 *
 * @param {number} n 待格式化的数值（可为负）
 * @returns {string} 玩家可读的紧凑数值文案
 */
export function fmtNum (n) {
  if (!Number.isFinite(n)) return '∞'
  const abs = Math.abs(n)
  if (abs < 1e4) return String(Math.floor(n))
  if (abs < 1e8) return (n / 1e4).toFixed(2) + '万'
  if (abs < 1e12) return (n / 1e8).toFixed(2) + '亿'
  return (n / 1e12).toFixed(2) + '万亿'
}

/**
 * 大数简写（**非负语义薄壳**）：先 `Math.max(0, …)` 归零负数与非法值，再走 `fmtNum`。
 * 供「只可能为非负量」的文案使用（宗门产值 / 传功开销 / 大比战力等），
 * 保留原 `SectSystem.fmtBig` 的负数归零行为，避免口径统一时引入新的负数分支。
 *
 * @param {number} n 待格式化的数值
 * @returns {string} 玩家可读的紧凑数值文案
 */
export function fmtShort (n) {
  return fmtNum(Math.max(0, Number(n) || 0))
}

export default { clamp, fmtNum, fmtShort }
