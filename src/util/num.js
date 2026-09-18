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

export default { clamp }
