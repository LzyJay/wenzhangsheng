/**
 * market.js —— 坊市表（只读配置层）（2.6 / V7.3 扩容）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《挂机修仙游戏设定书》§9（坊市·拍卖）+《游戏设计文档》§13（坊市）
 *       + 桌面单机版降维口径（《游戏设计文档》§六：坊市＝NPC 商店，每日刷新 + 折扣，
 *         无联网交易；拍卖行按境界分层，简化抢拍）
 *
 * 范围：① 每日刷新折扣商店（灵石循环出口，买道具）② 灵石回收出口（卖库存换灵石）
 *       ③ 按境界分层的拍卖行（每层常备 3 件，只展示「当前境界 ＋ 往下三层」）
 *
 * 口径（与 §七 占比护栏一致——坊市只搬动「灵石 / 道具」，不产修为、不晋境界）：
 *   · 商店每轮刷新（一轮 = 30 游戏天 ≈ 现实 2 小时，dayKey 同宗门，全游戏"每日"语义统一）；
 *     每轮抽 `SHOP_SLOTS = 10` 件：**4 席常驻基础货轮换 ＋ 4 席本界货 ＋ 2 席公用货**；
 *     本界 / 公用两池按**品质加权**抽取（越稀有出现概率越低），每件给一个随机折扣。
 *   · 回收价 = 基准价 × RECYCLE_RATE（< 1，使"买→卖"净亏，杜绝刷灵石漏洞）。
 *   · 拍卖行门槛＝金丹期（realmIndex ≥ 2）；每层常备 AUCTION_PER_TIER 件、每件限拍 1 次。
 *   · 所有可调数（基准价 / 折扣区间 / 回收率 / 门槛 / 分池 / 权重）都放本文件，
 *     注释来源（设定书 §9），禁止把魔法数埋进 MarketSystem。
 *
 * ── V7.3（主人 2026-09-22 拍板 · 提案 D2/D3/D4）─────────────────────────────
 *   · **基础货值表 `GOODS` 条数与数值冻结**（16 条；`V2.6-自测:27` / `V3.5.1-自测:182` /
 *     `V3.5.9-自测:65` 钉住「16 件」）——481 条新增物品**不进本表**，改走
 *     `GOODS_POOL_COMMON` / `GOODS_POOL_WORLD` 两池 ＋ `PRICE_BY_QUALITY` 定价，
 *     既保住既有条数断言，也让「基础货值表」语义保持纯粹。
 *   · 基准价口径（D3 定案「品质中位数」）：既有 16 条照旧，新货按品质取
 *     凡 80 / 良 220 / 珍 600 / 绝 1300 / 仙 3200（与既有价位段 40~120 / 150~320 /
 *     480~1000 / 1100~1500 吻合；仙档无既有锚点，外推 ≈ 绝档 ×2.5）。
 *   · 拍卖（D4 定案）：8 大境界各 1 层、每层常备 3 件，只展示「当前境界 ＋ 往下三层」＝
 *     12 件/轮；分层按品质排序切段（低层＝低价常见物、高层＝仙绝稀有物）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { gameDayKey } from './gametime.js'
import { ALL_ITEMS, ITEM_MAP, worldOf } from './items.js'
import { REALM_META } from './realms.js'

/** 货值表（灵石基准价；用于商店定价、回收折算、拍卖底价同源）
 *  V3.5.1（主人：坊市物品资料库丰富）：追加 5 条新货（新材料 + 凝神丹），基准价按稀缺度对齐旧表。
 *  ⚠ V7.3：本表**条数与数值冻结**（16 条），新增物品走池表 + 品质价，不并入此处。 */
export const GOODS = [
  { id: 'mat_lingcao', base: 80 },    // 灵草（炼丹主料，挂机偶得）
  { id: 'mat_kuang', base: 120 },     // 玄铁矿（炼器/法宝，挂机偶得）
  { id: 'mat_fuzhi', base: 40 },      // 灵纹符纸（符修通货，V3.5.1）
  { id: 'mat_yaodan', base: 260 },    // 妖丹（稀，挂机偶得）
  { id: 'mat_yaohu', base: 220 },     // 妖兽精血（除妖所得，V3.5.1）
  { id: 'mat_qinglingcao', base: 150 }, // 清灵草（凝神丹主料，V3.5.1）
  { id: 'pill_ningshen', base: 260 },  // 凝神丹（限时增益，V3.5.1）
  { id: 'pill_pojing', base: 320 },   // 破境丹（小瓶颈必需）
  { id: 'pill_hujie', base: 480 },    // 护劫丹（渡劫准备）
  { id: 'pill_hujie2', base: 1500 },  // 九转护劫丹（护劫升档，V3.5.9 原著第三批）
  { id: 'pill_xisui', base: 600 },    // 洗髓丹（重掷灵根）
  { id: 'pill_yanshou', base: 540 },  // 延寿丹（续命）
  { id: 'mat_wannianru', base: 900 }, // 千年灵乳（珍稀药引，V3.5.1）
  { id: 'mat_jiuqu', base: 1100 },    // 九曲灵参（绝品主料，V3.5.7 原著首批）
  { id: 'talisman_jiangling', base: 200 }, // 降灵符（可焚符增益，V3.5.7 原著首批）
  { id: 'treasure_zhenlei', base: 1000 } // 镇雷法宝（渡劫准备；主线暂未产出，先走拍卖/回收）
]

/** id → 货值（未登记回退 0，避免定价炸裂） */
export const GOODS_MAP = GOODS.reduce((acc, g) => { acc[g.id] = g; return acc }, {})

/** 品质基准价（V7.3 · 新货定价唯一真源；口径＝品质中位数，见文件头） */
export const PRICE_BY_QUALITY = { fan: 80, liang: 220, zhen: 600, jue: 1300, xian: 3200 }
/** 未登记品质的兜底基准价（按凡档） */
export const PRICE_FALLBACK = 80

/** 取基准价（唯一入口）：基础表 16 条走 GOODS，其余物品按品质档；未登记 id → 0（坊市不收） */
export function getGoodsValue (id) {
  const g = GOODS_MAP[id]
  if (g) return g.base
  const it = ITEM_MAP[id]                       // ⚠ 直查 ITEM_MAP（不用 getItem——它对未登记 id 会兜底出一个凡档假物）
  if (!it) return 0
  return PRICE_BY_QUALITY[it.quality] || PRICE_FALLBACK
}

// ── 货池（V7.3：481 条新增物品的入口）────────────────────────────────────────

/** 基础货 id 集（已进 GOODS 的 16 条，池里不再重复） */
const GOODS_IDS = new Set(GOODS.map((g) => g.id))

/** 公用货池：公用库（无 worldId）中**不在基础表**的货（实测 104 条 ＝ 120 − 16） */
export const GOODS_POOL_COMMON = ALL_ITEMS.filter((x) => worldOf(x) === null && !GOODS_IDS.has(x.id))

/** 各界货池：各界专属全部（384 条；按界过滤用 `goodsPoolOfWorld`） */
export const GOODS_POOL_WORLD = ALL_ITEMS.filter((x) => worldOf(x) !== null)

/** 取某界的专属货池（未抽定世界 → 空数组，由调用方回落公用池） */
export function goodsPoolOfWorld (worldId) {
  return worldId ? GOODS_POOL_WORLD.filter((x) => x.worldId === worldId) : []
}

/** 折扣商店：每轮抽 SHOP_SLOTS 件（分池 + 品质加权） */
export const SHOP_SLOTS = 10
/** 分池席数（V7.3 D2 定案）：4 席常驻基础 ＋ 4 席本界 ＋ 2 席公用 ＝ 10
 *  既有基础货单条命中率仍为 4/16 → 与改版前 6/16 ≈ 37.5% 保持一致（本池 4 席轮换去重）。 */
export const SHOP_SPLIT = { base: 4, world: 4, common: 2 }
/** 品质权重（本界 / 公用两池抽货用；档位思路照 `events.QUALITY_WEIGHTS`，补凡档并整体左移） */
export const SHOP_QUALITY_WEIGHT = { fan: 50, liang: 30, zhen: 14, jue: 5, xian: 1 }
/** 折扣区间（∈ (0,1]；设计口径"每日刷新折扣商店"） */
export const DISCOUNT_RANGE = [0.7, 0.95]

/** 回收率（灵石回收出口：卖库存价 = 基准价 × 此率，<1 防刷） */
export const RECYCLE_RATE = 0.5

// ── 拍卖行（V7.3：按境界分层）──────────────────────────────────────────────

/** 拍卖行门槛（金丹期起；低于此境界不开放——既有口径保持不变） */
export const AUCTION_MIN_REALM = 2   // realmIndex：0 炼气 1 筑基 2 金丹
/** 既有稀有物池（7 条 · 数值冻结；各处断言为 `.some()` 存在性，扩充不影响） */
export const AUCTION_POOL = [
  { id: 'pill_yanshou', minRealm: 2 },    // 延寿丹（金丹可拍）
  { id: 'treasure_zhenlei', minRealm: 2 }, // 镇雷法宝（金丹可拍）
  { id: 'mat_wannianru', minRealm: 2 },   // 千年灵乳（金丹可拍，V3.5.1）
  { id: 'mat_jiuqu', minRealm: 2 },       // 九曲灵参（金丹可拍，V3.5.7 原著首批）
  { id: 'pill_ningshen', minRealm: 2 },   // 凝神丹（金丹可拍，V3.5.1）
  { id: 'pill_hujie2', minRealm: 2 },     // 九转护劫丹（金丹可拍，V3.5.9 原著第三批）
  { id: 'pill_xisui', minRealm: 3 }       // 洗髓丹（元婴起，更稀有）
]
/** 每层常备件数（V7.3 D4） */
export const AUCTION_PER_TIER = 3
/** 展示窗口：当前境界 ＋ 往下几层（V7.3 D4 → 共 4 层 × 3 件 ＝ 12 件/轮） */
export const AUCTION_WINDOW_DOWN = 3
/** 拍卖价在区间内浮动（设计"抢拍稀有物"的价格感） */
export const AUCTION_PRICE_RANGE = [0.85, 1.1]

/** 品质排序权重（拍卖分层切段用） */
const QUAL_RANK = { fan: 0, liang: 1, zhen: 2, jue: 3, xian: 4 }

/** 全量候选按「品质升序 · id 稳定」排序后**均分切段**到 8 个境界层：
 *  低层拿到凡/良档常见物、高层拿到仙绝档稀有物，且 504 条 **100% 有拍卖入口**（D9 覆盖率）。 */
const AUCTION_SORTED = ALL_ITEMS.slice().sort((a, b) =>
  (QUAL_RANK[a.quality] || 0) - (QUAL_RANK[b.quality] || 0) || a.id.localeCompare(b.id))

/** 8 层拍卖池（realm 0..7 与 `realms.REALM_META` 同序同名） */
export const AUCTION_TIERS = REALM_META.map((m, r) => ({ realm: r, realmName: m.name, items: [] }))
{
  const per = Math.max(1, Math.ceil(AUCTION_SORTED.length / AUCTION_TIERS.length))
  AUCTION_SORTED.forEach((it, i) => {
    const tier = Math.min(AUCTION_TIERS.length - 1, Math.floor(i / per))
    AUCTION_TIERS[tier].items.push(it.id)
  })
}

/** 本境界可见的分层窗口（低于门槛返回空数组；越界层自动截断） */
export function auctionWindow (realmIndex) {
  if (!(realmIndex >= AUCTION_MIN_REALM)) return []
  const out = []
  for (let d = 0; d <= AUCTION_WINDOW_DOWN; d++) {
    const t = AUCTION_TIERS[realmIndex + d]
    if (t) out.push(t)
  }
  return out
}

/** 回收单价（灵石/单位）：基准价 × 回收率；未登记货（无基准价）返回 0（坊市不收） */
export function recycleUnitPrice (id) {
  const v = getGoodsValue(id)
  return v > 0 ? Math.max(1, Math.round(v * RECYCLE_RATE)) : 0
}

/** 境界下标（与 sect.js 同算法：0 炼气 1 筑基 2 金丹 …） */
export function realmIndexOf (level) {
  return Math.floor((Math.max(1, level | 0) - 1) / 9)
}

/**
 * 「每日」周期键（主人 2026-09-18 口径变更）：＝ **30 游戏天**（≈现实 2 小时），
 * 与宗门任务板 / 寻蛋同口径；改周期只改 gametime.REFRESH_DAYS。
 */
export const dayKey = gameDayKey   // 不再本模块自持实现：直接转发 gametime 的唯一真源

export default {
  GOODS, GOODS_MAP, SHOP_SLOTS, DISCOUNT_RANGE, RECYCLE_RATE,
  AUCTION_MIN_REALM, AUCTION_POOL, AUCTION_PRICE_RANGE,
  getGoodsValue, recycleUnitPrice, realmIndexOf, dayKey
}
