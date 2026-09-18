/**
 * MarketSystem.js —— 坊市系统（纯逻辑层）（2.6）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：禁止 import Phaser、禁止操作 DOM；只读写 state。
 * 数据源：src/data/market.js（货值 / 折扣区间 / 回收率 / 拍卖池）
 *
 * 口径（设计库《挂机修仙游戏设定书》§9 +《游戏设计文档》§13 坊市 + 单机降维 §六）：
 *   · 折扣商店：每轮刷新（一轮 = 30 游戏天 ≈ 现实 2 小时），从货池抽 SHOP_SLOTS 件，
 *     每件随机折扣（DISCOUNT_RANGE）；玩家花灵石买道具入库（不晋境界、不产修为）。
 *   · 回收出口：卖库存中「有货值」的道具换灵石；单价 = 货值 × RECYCLE_RATE（<1，
 *     买→卖净亏，杜绝刷灵石）。一次卖清整堆。
 *   · 拍卖行（高境界）：每日 1 件稀有物（按 minRealm 过滤后随机），金丹期起可拍下，
 *     每日限 1 次；价在 AUCTION_PRICE_RANGE 内浮动。
 *
 * 存档子树：state.market（null＝未初始化；get m 懒建并兜底老档）
 *   { lastDay: string, shop: [{id, base, price, discount}], auction: {id, base, price, bought, minRealm} | null }
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  GOODS, SHOP_SLOTS, DISCOUNT_RANGE, RECYCLE_RATE,
  AUCTION_MIN_REALM, AUCTION_POOL, AUCTION_PRICE_RANGE,
  getGoodsValue, recycleUnitPrice, realmIndexOf, dayKey
} from '../data/market.js'
import { getItem, getUnit } from '../data/items.js'
import { clamp } from '../util/num.js'   // 区间钳制单一真源（零依赖叶子层 src/util/）

const randRange = (lo, hi) => lo + Math.random() * (hi - lo)

class MarketSystem {
  /** @param {object} state 存档状态 */
  constructor (state) {
    this.state = state
  }

  // ── 基础 ────────────────────────────────────────────────────────────────

  /** 坊市子树（懒建：老档 market 为 null 时补全结构） */
  get m () {
    if (!this.state.market || typeof this.state.market !== 'object') {
      this.state.market = { lastDay: null, shop: [], auction: null }
    }
    return this.state.market
  }

  get stones () { return this.state.resources.stones | 0 }
  set stones (v) { this.state.resources.stones = Math.max(0, Math.round(v)) }

  inv () { return this.state.inventory.items }
  count (id) { return (this.state.inventory.items[id] | 0) }
  _addItem (id, n) { this.state.inventory.items[id] = this.count(id) + n }
  _removeItem (id, n) { this.state.inventory.items[id] = Math.max(0, this.count(id) - n) }

  get realmIndex () { return realmIndexOf(this.state.player.realm.level) }

  // ── 每日刷新 ────────────────────────────────────────────────────────────

  /** 每日 5 点刷新（同日幂等；返回是否发生了刷新） */
  ensureDaily (now = Date.now()) {
    const key = dayKey(now)
    if (this.m.lastDay === key) return false
    this.m.lastDay = key
    this.rollShop()
    this.rollAuction()
    return true
  }

  /** 抽 SHOP_SLOTS 件（去重），每件随机折扣定当日价 */
  rollShop () {
    const pool = [...GOODS]
    // Fisher–Yates 后取前 SHOP_SLOTS 件（不足则全取）
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t
    }
    const n = Math.min(SHOP_SLOTS, pool.length)
    const shop = []
    for (let i = 0; i < n; i++) {
      const g = pool[i]
      const discount = clamp(randRange(DISCOUNT_RANGE[0], DISCOUNT_RANGE[1]), 0.1, 1)
      const price = Math.max(1, Math.round(g.base * discount))
      shop.push({ id: g.id, base: g.base, price, discount })
    }
    this.m.shop = shop
    return shop
  }

  /** 抽 1 件拍卖稀有物（按当前境界过滤池；无资格则 null） */
  rollAuction () {
    const pool = AUCTION_POOL.filter((a) => a.minRealm <= this.realmIndex)
    if (!pool.length) { this.m.auction = null; return null }
    const a = pool[Math.floor(Math.random() * pool.length)]
    const base = getGoodsValue(a.id)
    const price = Math.max(1, Math.round(base * randRange(AUCTION_PRICE_RANGE[0], AUCTION_PRICE_RANGE[1])))
    this.m.auction = { id: a.id, base, price, bought: false, minRealm: a.minRealm }
    return this.m.auction
  }

  // ── 动作 ────────────────────────────────────────────────────────────────

  /** 购买（折扣店一件；灵石扣减，道具入库） */
  buy (slotIndex, now = Date.now()) {
    this.ensureDaily(now)
    const i = slotIndex | 0
    const slot = this.m.shop[i]
    if (!slot) return { ok: false, message: '这格货架空了。' }
    if (this.stones < slot.price) {
      return { ok: false, message: `灵石不足：购 ${getItem(slot.id).name} 需 ${slot.price}，还差 ${slot.price - this.stones}。` }
    }
    this.stones = this.stones - slot.price
    this._addItem(slot.id, 1)
    const it = getItem(slot.id)
    return {
      ok: true,
      cost: slot.price,
      message: `于坊市购得 ${it.name} ×1（灵石 −${slot.price}）。`
    }
  }

  /** 回收（卖清整堆；灵石入账） */
  sell (id, now = Date.now()) {
    const unit = recycleUnitPrice(id)
    if (!unit) return { ok: false, message: '此物坊市不收。' }
    const have = this.count(id)
    if (have <= 0) return { ok: false, message: '行囊里没有可卖的。' }
    this._removeItem(id, have)
    const gain = unit * have
    this.stones = this.stones + gain
    const it = getItem(id)
    return {
      ok: true,
      gain,
      message: `售出 ${it.name} ×${have}（灵石 +${gain}）。`
    }
  }

  /** 拍下（高境界拍卖行；每日限 1 次） */
  buyAuction (now = Date.now()) {
    this.ensureDaily(now)
    const a = this.m.auction
    if (!a) return { ok: false, message: '拍卖行尚未开启（需更高境界）。' }
    if (this.realmIndex < a.minRealm) {
      return { ok: false, message: `境界不足：此拍需 ${a.minRealm + 1 <= 6 ? '金丹' : '元婴'}期以上。` }
    }
    if (a.bought) return { ok: false, message: '今日此拍已结，明日再来。' }
    if (this.stones < a.price) {
      return { ok: false, message: `灵石不足：拍下需 ${a.price}，还差 ${a.price - this.stones}。` }
    }
    this.stones = this.stones - a.price
    this._addItem(a.id, 1)
    a.bought = true
    const it = getItem(a.id)
    return {
      ok: true,
      cost: a.price,
      message: `于拍卖行拍得 ${it.name}（灵石 −${a.price}）。`
    }
  }

  // ── 视图（装配层渲染用，纯读）────────────────────────────────────────────

  shopView () {
    const stones = this.stones
    return this.m.shop.map((slot, index) => {
      const it = getItem(slot.id)
      return {
        index,
        id: slot.id,
        name: it.name,
        unit: getUnit(it),
        base: slot.base,
        price: slot.price,
        discount: slot.discount,
        affordable: stones >= slot.price
      }
    })
  }

  /** 回收列表：库存里有货值的道具，按货值降序 */
  recycleView () {
    const unit = (id) => recycleUnitPrice(id)
    return Object.keys(this.inv())
      .filter((id) => this.count(id) > 0 && unit(id) > 0)
      .map((id) => {
        const it = getItem(id)
        const price = unit(id)
        const c = this.count(id)
        return {
          id,
          name: it.name,
          unit: getUnit(it),
          count: c,
          price,
          total: price * c
        }
      })
      .sort((a, b) => b.total - a.total)
  }

  auctionView () {
    const a = this.m.auction
    if (!a) {
      return { open: false, realmOk: this.realmIndex >= AUCTION_MIN_REALM, minRealm: AUCTION_MIN_REALM }
    }
    const it = getItem(a.id)
    return {
      open: true,
      id: a.id,
      name: it.name,
      unit: getUnit(it),
      price: a.price,
      bought: a.bought,
      minRealm: a.minRealm,
      realmOk: this.realmIndex >= a.minRealm,
      affordable: this.realmIndex >= a.minRealm && !a.bought && this.stones >= a.price
    }
  }
}

export default MarketSystem
