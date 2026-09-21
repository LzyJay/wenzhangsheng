/**
 * itemChannels.js —— 物品「得自」规则表（V7.3）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界：**零 import 的纯函数叶子**（连 items.js 也不引——否则 `items.js →
 *   itemLibrary.js → itemChannels.js → items.js` 会成环）。只看传进来的
 *   `{ type, quality, worldId }` 三个字段，输出一段人类可读的产出途径文案。
 *
 * 用途：V7.1 入库的 **481 条**（公用新增 97 ＋ 各界 384）的 `from` 原为占位符
 *   `未接产出（本批只入库）`；V7.3 接线后由 `items.js` 在装载时统一改写为真实途径
 *   （见 `items.js` 里紧跟 `ALL_ITEMS` 的那段一次性规范化循环）——**逐条生效、幂等**，
 *   既不必手改 481 行，也保证新增条目天然带上正确途径。
 *
 * 口径（与 V7.3 落地渠道一一对应）：
 *   · 公用物品（无 worldId）＝ 全界通用渠道：丹房 / 坊市公用货架 / 拍卖行 /
 *     挂机偶得（仅基础材料）/ 秘境积分商店 / 宗门商店 / 事件；
 *   · 各界专属（带 worldId）＝ 以「本界」为主渠道：本界秘境三档材料位 / 本界世界机制 /
 *     本界货架 / 本界丹方与炼器配方 / 宗门商店 · 本界 / 拍卖行 · 本界层；
 *   · 珍 / 绝 / 仙 三档再补一条「拍卖行」（分层拍卖按品质归层）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 公用物品的途径表（type → 文案） */
const COMMON = {
  pill: '丹房炼制 / 坊市 · 公用货架 / 拍卖行',
  material: '挂机偶得（基础材料） / 坊市 · 公用货架 / 秘境积分商店 / 宗门商店',
  treasure: '炼器坊炼制 / 坊市 · 公用货架 / 拍卖行',
  talisman: '坊市 · 公用货架 / 宗门商店 / 事件奇遇',
  fragment: '秘境 · 古迹拾遗 / 坊市 · 公用货架 / 秘境积分商店'
}

/** 各界专属物品的途径表（type → 文案；主渠道一律以「本界」起头） */
const WORLD = {
  pill: '丹房炼制（本界丹方） / 坊市 · 本界货架 / 拍卖行 · 本界层',
  material: '本界秘境（三档材料位） / 本界世界机制 / 挂机偶得（基础材料） / 坊市 · 本界货架',
  treasure: '炼器坊炼制（本界配方） / 坊市 · 本界货架 / 拍卖行 · 本界层',
  talisman: '坊市 · 本界货架 / 宗门商店 · 本界 / 事件奇遇',
  fragment: '本界秘境 · 古迹拾遗 / 坊市 · 本界货架 / 秘境积分商店'
}

/** 珍档起追加「拍卖行」（分层拍卖按品质归层） */
const RARE_Q = new Set(['zhen', 'jue', 'xian'])

/**
 * 取某物品的「得自」文案。
 * @param {{type?:string, quality?:string, worldId?:string|null}} item
 * @returns {string}
 */
export function channelsOf (item) {
  if (!item) return ''
  const type = item.type || 'material'
  const table = item.worldId ? WORLD : COMMON
  let s = table[type] || table.material
  if (RARE_Q.has(item.quality) && !/拍卖行/.test(s)) s += ' / 拍卖行'
  return s
}

export default { channelsOf }
