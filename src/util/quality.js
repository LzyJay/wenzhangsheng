/**
 * quality.js —— 品质 5 档单一真源（src/util/ 零依赖叶子层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三 / 计划册 §13.1①）：零依赖叶子层，禁止 import
 *   data / systems / ui / scenes / audio / DOM / Phaser；可被其余任意层 import。
 *
 * 口径（2026-09-19 统一）：
 *   · 档位键序 fan → liang → zhen → jue → xian（低到高）**只在此处定义**；
 *   · 档名**全站只有一套**（短名「凡 / 良 / 珍 / 绝 / 仙」）——事件消息、纪事、
 *     成就、丹房、背包一律用它。此前 alchemy.js 另有一套全名（「凡品」…），
 *     逐字＝短名＋「品」，造成背包出现「凡品级」这类「品＋级」叠加的文案瑕疵，
 *     本次收敛掉；对外显示文案随之统一（丹房「凡品 ｜ 成丹率」→「凡 ｜ 成丹率」）。
 *   · 色板唯一（原先 ui/AlchemyPanel.js 函数体内硬编码过一份逐字相同的副本）。
 *   · V7.2（主人 2026-09-22 拍板）：**珍 / 良 两档色值互换**（珍 → 鎏金 · 良 → 玉绿），
 *     仍只在本文件定义 → 行囊 / 丹房 / 纪事 / 事件 / 成就 / 灵兽 / 功法**一处共变**。
 *
 * 不在本文件定义（属各自域内的平衡数值，仍留在原模块）：
 *   · `alchemy.QUALITY_RATE`   —— 品阶 → 成丹率
 *   · `events.EQUIV_H`         —— 品质当量基准（h）
 *   · `events.QUALITY_WEIGHTS` —— 机缘内品质权重
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 品质档位键序（低 → 高），唯一真源 */
export const QUALITY_KEYS = ['fan', 'liang', 'zhen', 'jue', 'xian']

/** 品质档名（对外文案，唯一词表） */
export const QUALITY_NAME = { fan: '凡', liang: '良', zhen: '珍', jue: '绝', xian: '仙' }

/** 品质档色（唯一色板；与丹房同族）
 *  V7.2 互换后：良 ＝ 玉绿 #7fd6a8 ｜ 珍 ＝ 鎏金 #e8b96a（越稀有越贵气）；凡 / 绝 / 仙 三档未动。 */
export const QUALITY_COLOR = { fan: '#b9b3a8', liang: '#7fd6a8', zhen: '#e8b96a', jue: '#b98cff', xian: '#9fd6ff' }

export default { QUALITY_KEYS, QUALITY_NAME, QUALITY_COLOR }
