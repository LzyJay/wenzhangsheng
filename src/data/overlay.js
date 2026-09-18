/**
 * overlay.js —— 内容遮罩（.ov：丹房 / 宗门 / 纪事 …）观感参数（data 层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / §13.1①）：本文件**禁止 import** systems / Phaser / DOM。
 *
 * 职责：
 *   · 浮层不透明度档位单点（设置面板「浮层透明度」循环这一张表）；
 *   · `resolveOvAlpha(setting)` / `nextOvAlpha(setting)` / `ovAlphaName(setting)` 三个纯函数。
 *
 * 为什么要有这个开关（V4.7 主人 2026-09-18 提出）：
 *   .ov 遮罩按 `syncOverlayZone()` 只盖住「修行日志」那一块（主人 2026-09-17 的既定口径），
 *   于是丹方 / 宗门这类面板天然压在日志之上 —— 想一边开炉一边看日志就被挡住了。
 *   这里给遮罩一个可调的底色不透明度：调低即可让底下的修行日志透出来（同时按比例减弱
 *   背景模糊，否则字仍被糊掉）。
 *
 * 落地方式：装配层把档位写成 <html> 上的 `--ov-alpha`（运行期变量，**不入存档语义**），
 *   index.html 的 `.ov` 背景色与 backdrop-filter 按 `var(--ov-alpha, 1)` 取值。
 *
 * 存档：`settings.ovAlpha`（本模块所有的偏好叶子；默认 'opaque'，老档由 mergeDefaults 补）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 档位表（循环顺序：不透明 → 微透 → 半透 → 很透） */
export const OVERLAY_ALPHA_LEVELS = [
  { id: 'opaque', name: '不透明', alpha: 1 },
  { id: 'slight', name: '微透', alpha: 0.86 },
  { id: 'half', name: '半透', alpha: 0.72 },
  { id: 'clear', name: '很透', alpha: 0.56 }
]

/** 默认档（与老档 mergeDefaults 的兜底一致） */
export const OVERLAY_ALPHA_DEFAULT = 'opaque'

/** 脏值一律按默认档（与 resolveMotionMode / resolveAmbienceMode 的兜底口径一致） */
function levelOf (setting) {
  const id = String(setting == null ? '' : setting)
  return OVERLAY_ALPHA_LEVELS.find((l) => l.id === id) || OVERLAY_ALPHA_LEVELS[0]
}

/**
 * 有效不透明度（纯函数）
 * @param {string} setting state.settings.ovAlpha
 * @returns {number} 0~1（1＝完全不透明）
 */
export function resolveOvAlpha (setting) {
  return levelOf(setting).alpha
}

/** 档位中文名（设置面板文案与日志共用一份） */
export function ovAlphaName (setting) {
  return levelOf(setting).name
}

/** 下一档 id（点按循环用；脏值按默认档算，故首次点按即到「微透」） */
export function nextOvAlpha (setting) {
  const i = OVERLAY_ALPHA_LEVELS.indexOf(levelOf(setting))
  return OVERLAY_ALPHA_LEVELS[(i + 1) % OVERLAY_ALPHA_LEVELS.length].id
}
