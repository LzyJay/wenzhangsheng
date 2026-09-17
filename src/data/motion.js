/**
 * motion.js —— 3.4 UI 动效与主题：动效纪律参数表与纯函数（data 层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / §13.1①）：本文件**禁止 import** systems / Phaser / DOM。
 *
 * 职责：
 *   · 动效参数单点（面板转场时长、数值滚动收敛半径、按钮按压时长）——改节奏只改这张表；
 *   · `resolveMotionMode(setting, reducedMotion)` —— 全项目唯一的「当前该不该播动效」判定点；
 *   · `tickToward` / `rollDisplay` —— 数值滚动的**追赶式**收敛纯函数（可 Node 直测）。
 *
 * 数据来源：《问长生-开发计划V2》§五 3.4「面板转场、数字滚动、按钮反馈」；
 *   设计库 design/V1 问长生-无限画布.html 设计系统卡「动效纪律 · Motion」：
 *     · 人形呼吸 1.9s｜光晕呼吸 2.4s（3.1 已落地，本模块不动）
 *     · 飘字 1.5s 上浮 42px；突破爆发 28~46 枚粒子 0.5~1.1s；渡劫震屏 320ms（3.2 已落地，不动）
 *     · 进度条 120ms linear｜**状态切换 ≤150ms**
 *     · 「减弱动态」开启时：全部动效降级为透明度过渡
 *
 * 「减弱动态」的作用域（口径沿用 3.3 氛围系统，见 data/ambience.js resolveAmbienceMode 注释）：
 *   该偏好要治的是「晃」（大幅位移 / 闪烁 / 缩放），一刀切成「只剩透明度」会让**本机**
 *   （主人这台系统即开着减弱动态）等于没有动效。故：**手动选择永远优先于系统偏好** ——
 *   'full' 全开 / 'static' 静态 是主人的明文选择，只有 'auto' 才跟系统。
 *   对应的 CSS 支点在 index.html：`@media (prefers-reduced-motion: reduce)` 块已改为
 *   `:root:not(.motion-full)` 作用域，装配层按本文件判定结果给 <html> 挂/摘类。
 *
 * 存档：无新子树 —— 动效档是 `settings.motion` 一个偏好叶子（老档由 mergeDefaults 补 'full'）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 动效参数表（单位 ms / px；设计稿「动效纪律」落地值） */
export const MOTION = {
  panel: {
    inMs: 160,      // 面板打开：淡入 + 上浮（状态切换 ≤150ms 同类，留 10ms 给位移收尾）
    outMs: 130,     // 面板关闭：反向淡出（关闭比打开快，收得干脆）
    risePx: 6       // 打开时的上浮位移
  },
  rollMs: 260,      // 数值滚动收敛半径（4.6τ ≈ 99%；同时是"追上真实值"的体感时长）
  pressMs: 90,      // 按钮按压反馈时长（下沉 1px + 缩放 0.96）
  hoverMs: 150      // 悬停提亮（与既有 .ico-btn/.q-pill 的 150ms 同拍）
}

/** 动效档取值（设置面板循环顺序：全开 → 自动 → 静态） */
export const MOTION_SETTINGS = ['full', 'auto', 'static']

/** 档位中文名（设置面板文案与日志共用一份） */
export const MOTION_NAMES = { full: '全开', auto: '自动', static: '静态' }

/**
 * 有效动效档（纯函数）。
 *   · 'full'  （默认）→ 全开：面板转场 / 数值滚动 / 按钮按压一律生效（不受系统偏好约束）
 *   · 'static'         → 静态：全部归零，只保留内容与状态色变化（文字属内容，不参与降级）
 *   · 'auto'           → 跟系统 prefers-reduced-motion
 * 其它脏值一律按 'full'（与 resolveAmbienceMode 的兜底口径一致）。
 * @param {string} setting state.settings.motion
 * @param {boolean} reducedMotion 系统是否开启「减弱动态」
 * @returns {'full'|'static'}
 */
export function resolveMotionMode (setting, reducedMotion) {
  const s = String(setting || 'full')
  if (s === 'full' || s === 'static') return s
  if (s === 'auto') return reducedMotion ? 'static' : 'full'
  return 'full'
}

/** 三次缓出（0→1；数值滚动的形状函数，起点快、结尾稳） */
export function easeOutCubic (t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0))
  return 1 - Math.pow(1 - x, 3)
}

/**
 * 追赶式收敛：把 `cur` 朝 `target` 推进 `dtMs`（纯函数、无副作用、可复算）。
 *
 * 为什么不用「定长补间」：修为 / 灵石是每 100ms 连续入账的量，固定时长的补间永远追不上真值，
 * 会出现「显示的比实际少、且越来越落后」。指数追赶则在任意 dt 下都朝真值收敛，
 * 且**目标改变无需重置状态**（新目标到来即自动重定向）。
 *
 * @param {number} cur 当前显示值
 * @param {number} target 真值
 * @param {number} dtMs 距上次推进的毫秒数
 * @param {number} [durationMs] 收敛半径（≈99% 用时时长），默认 MOTION.rollMs
 * @returns {number} 推进后的显示值（已收敛/无需滚动时**逐位等于 target**）
 */
export function tickToward (cur, target, dtMs, durationMs = MOTION.rollMs) {
  const c = Number(cur)
  const t = Number(target)
  if (!Number.isFinite(t)) return Number.isFinite(c) ? c : 0
  if (!Number.isFinite(c) || c === t) return t
  const dt = Number(dtMs)
  if (!(dt > 0)) return c
  const tau = Math.max(1, Number(durationMs) || MOTION.rollMs) / 4.6
  return t + (c - t) * Math.exp(-dt / tau)
}

/**
 * 数值滚动的「显示值」：先追赶，再按**格式化后是否相同**决定贴合真值。
 * 这条贴合判据是硬要求 —— 既有断言（CDP 与自测）比对的是**渲染出来的字符串**，
 * 显示值必须最终逐字符等于 `format(target)`，不能停在 0.3 的误差里。
 * @param {number} cur 当前显示值
 * @param {number} target 真值
 * @param {number} dtMs 距上次推进的毫秒数
 * @param {(n:number)=>string} format 格式化函数（main.js 的 fmt / fmtRate 等）
 * @param {number} [durationMs] 收敛半径
 * @returns {number} 显示值（收敛后 === target）
 */
export function rollDisplay (cur, target, dtMs, format, durationMs = MOTION.rollMs) {
  const t = Number(target)
  if (!Number.isFinite(t)) return t
  const next = tickToward(cur, t, dtMs, durationMs)
  if (next === t) return t
  try {
    if (typeof format === 'function' && format(next) === format(t)) return t
  } catch (_) { /* 格式化异常时退回缓动值，绝不因动效打断主循环 */ }
  return next
}

/**
 * 面板转场时长（静态档返回 0 —— 装配层据此决定要不要播 class 动画）。
 * @param {'full'|'static'} mode
 * @param {'in'|'out'} dir
 */
export function panelMs (mode, dir = 'in') {
  if (mode === 'static') return 0
  return dir === 'out' ? MOTION.panel.outMs : MOTION.panel.inMs
}
