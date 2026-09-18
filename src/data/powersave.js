/**
 * data/powersave.js —— P4.4 性能与省电：渲染间隔决策（纯函数，零 import）
 * ═══════════════════════════════════════════════════════════════════════════
 * 主循环的结算拍（TICK_MS=100）不受此影响，挂机产出分毫不变；这里只决定
 * 「DOM 渲染的最低间隔」走哪一档：
 *   · 窗口藏进托盘（document.hidden）→ hidden 档：DOM 刷新对不可见窗口是纯浪费，
 *     拉到 5s 一拍兜底（回来时离线结算会即时 render，不会看到旧画面）
 *   · 可见但空闲（最后一次用户输入距今 ≥ idleAfterMs）→ idle 档：省电降帧，
 *     面板倒计时等仍按 PANEL_MS 自行跟拍
 *   · 其余（可见且有人用）→ base 档（V3.5.2 的 RENDER_MS=250，观感不变）
 * 口径：纯决策函数，不碰 DOM / state；改手感只改 main.js 里传入的四档常量。
 * ═══════════════════════════════════════════════════════════════════════════
 */

const DEFAULTS = { base: 250, idle: 2000, hidden: 5000, idleAfterMs: 120000 }

/**
 * @param {object} [opts]
 * @param {boolean} [opts.visible]     窗口是否可见（document.hidden 取反）
 * @param {number}  [opts.idleMs]      距最后一次用户输入的毫秒数
 * @param {number}  [opts.base]        活跃档渲染间隔（ms）
 * @param {number}  [opts.idle]        空闲档渲染间隔（ms）
 * @param {number}  [opts.hidden]      不可见档渲染间隔（ms）
 * @param {number}  [opts.idleAfterMs] 空闲判定阈值（ms）
 * @returns {number} 本拍允许的最低渲染间隔（ms）
 */
export function pickRenderMs (opts = {}) {
  const o = { ...DEFAULTS, ...opts }
  if (o.visible === false) return o.hidden
  if (Number.isFinite(o.idleMs) && o.idleMs >= o.idleAfterMs) return o.idle
  return o.base
}

export { DEFAULTS as POWERSAVE_DEFAULTS }
