/**
 * market.js —— 坊市表（只读配置层）（2.6）
 * ═══════════════════════════════════════════════════════════════════════════
 * 来源：设计库《挂机修仙游戏设定书》§9（坊市·拍卖）+《游戏设计文档》§13（坊市）
 *       + 桌面单机版降维口径（《游戏设计文档》§六：坊市＝NPC 商店，每日刷新 + 折扣，
 *         无联网交易；拍卖行高境界开放，简化抢拍）
 *
 * 范围：① 每日刷新折扣商店（灵石循环出口，买道具）② 灵石回收出口（卖库存换灵石）
 *       ③ 高境界拍卖行（简化：每日 1 件稀有物，达标可拍下）
 *
 * 口径（与 §七 占比护栏一致——坊市只搬动「灵石 / 道具」，不产修为、不晋境界）：
 *   · 商店每轮刷新（一轮 = 30 游戏天 ≈ 现实 2 小时，dayKey 同宗门，全游戏"每日"语义统一）；
 *     每轮从货池抽 SHOP_SLOTS 件，每件给一个随机折扣（DISCOUNT_RANGE），玩家只能买不能还价。
 *   · 回收价 = 货值 × RECYCLE_RATE（< 1，使"买→卖"净亏，杜绝刷灵石漏洞）。
 *   · 拍卖行门槛＝金丹期（realmIndex ≥ 2）；每轮 1 件（池中按 minRealm 过滤后随机），限拍 1 次。
 *   · 所有可调数（货值 / 折扣区间 / 回收率 / 门槛）都放本文件，注释来源（设定书 §9），
 *     禁止把魔法数埋进 MarketSystem。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { gameDayKey } from './gametime.js'

/** 货值表（灵石基准价；用于商店定价、回收折算、拍卖底价同源）
 *  V3.5.1（主人：坊市物品资料库丰富）：追加 5 条新货（新材料 + 凝神丹），基准价按稀缺度对齐旧表。 */
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

/** 折扣商店：每日从全货池抽若干件（去重），每件给一个当日折扣 */
export const SHOP_SLOTS = 6
/** 折扣区间（∈ (0,1]；设计口径"每日刷新折扣商店"） */
export const DISCOUNT_RANGE = [0.7, 0.95]

/** 回收率（灵石回收出口：卖库存价 = 货值 × 此率，<1 防刷） */
export const RECYCLE_RATE = 0.5

/** 拍卖行（高境界开放，简化抢拍）：稀有物池（base 取 GOODS_MAP） */
export const AUCTION_MIN_REALM = 2   // 金丹期起（realmIndex：0 炼气 1 筑基 2 金丹）
export const AUCTION_POOL = [
  { id: 'pill_yanshou', minRealm: 2 },    // 延寿丹（金丹可拍）
  { id: 'treasure_zhenlei', minRealm: 2 }, // 镇雷法宝（金丹可拍）
  { id: 'mat_wannianru', minRealm: 2 },   // 千年灵乳（金丹可拍，V3.5.1）
  { id: 'mat_jiuqu', minRealm: 2 },       // 九曲灵参（金丹可拍，V3.5.7 原著首批）
  { id: 'pill_ningshen', minRealm: 2 },   // 凝神丹（金丹可拍，V3.5.1）
  { id: 'pill_hujie2', minRealm: 2 },     // 九转护劫丹（金丹可拍，V3.5.9 原著第三批）
  { id: 'pill_xisui', minRealm: 3 }       // 洗髓丹（元婴起，更稀有）
]
/** 拍卖价在区间内浮动（设计"抢拍稀有物"的价格感） */
export const AUCTION_PRICE_RANGE = [0.85, 1.1]

/** 取货值；未登记回 0 */
export function getGoodsValue (id) {
  return (GOODS_MAP[id] && GOODS_MAP[id].base) || 0
}

/** 回收单价（灵石/单位）：货值 × 回收率；未登记货（不在货值表）返回 0（坊市不收） */
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
