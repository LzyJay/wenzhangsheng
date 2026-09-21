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
  GOODS, SHOP_SLOTS, SHOP_SPLIT, SHOP_QUALITY_WEIGHT, DISCOUNT_RANGE, RECYCLE_RATE,
  GOODS_POOL_COMMON, goodsPoolOfWorld,
  AUCTION_MIN_REALM, AUCTION_PRICE_RANGE, AUCTION_PER_TIER, auctionWindow,
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

  /** 坊市子树（懒建：老档 market 为 null 时补全结构）
   *  V7.3：新增 `auctionList`（分层 12 件）；`auction` **保持单件形状**（既有三处断言依赖它） */
  get m () {
    if (!this.state.market || typeof this.state.market !== 'object') {
      this.state.market = { lastDay: null, shop: [], auction: null, auctionList: [] }
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

  /** 按品质权重抽 1 件（池内权重和 > 0）；池空返回 null */
  _pickWeighted (pool) {
    if (!pool.length) return null
    const w = (id) => SHOP_QUALITY_WEIGHT[getItem(id).quality] || 1
    let total = 0
    for (const x of pool) total += w(x.id)
    if (total <= 0) return pool[0]
    let r = Math.random() * total
    for (const x of pool) { r -= w(x.id); if (r <= 0) return x }
    return pool[pool.length - 1]
  }

  /** 按品质权重抽 n 件（去重；`used` 为已占位 id 集） */
  _pickManyWeighted (pool, n, used) {
    const out = []
    for (let i = 0; i < n; i++) {
      const avail = pool.filter((x) => !used.has(x.id))
      if (!avail.length) break
      const pick = this._pickWeighted(avail)
      if (!pick) break
      used.add(pick.id)
      out.push(pick)
    }
    return out
  }

  /** 抽 SHOP_SLOTS 件（V7.3：分池 —— 4 常驻基础 ＋ 4 本界 ＋ 2 公用），每件随机折扣定当日价 */
  rollShop () {
    const wid = (this.state.world && this.state.world.worldId) || null
    const used = new Set()
    const shop = []
    const push = (g, pool) => {
      const base = getGoodsValue(g.id)
      if (!(base > 0)) return
      const discount = clamp(randRange(DISCOUNT_RANGE[0], DISCOUNT_RANGE[1]), 0.1, 1)
      shop.push({ id: g.id, base, price: Math.max(1, Math.round(base * discount)), discount, pool })
    }
    // ① 常驻基础席：基础货值表内均匀轮换（Fisher–Yates 后取前 SHOP_SPLIT.base 件）
    const basePool = [...GOODS]
    for (let i = basePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = basePool[i]; basePool[i] = basePool[j]; basePool[j] = t
    }
    for (const g of basePool.slice(0, SHOP_SPLIT.base)) { used.add(g.id); push(g, 'base') }
    // ② 本界席：本界专属池品质加权（未抽定世界 / 本界无货 → 回落公用池，保证不空）
    const worldPool = goodsPoolOfWorld(wid)
    for (const it of this._pickManyWeighted(worldPool.length ? worldPool : GOODS_POOL_COMMON, SHOP_SPLIT.world, used)) push(it, 'world')
    // ③ 公用席：公用新增池品质加权
    for (const it of this._pickManyWeighted(GOODS_POOL_COMMON, SHOP_SPLIT.common, used)) push(it, 'common')
    this.m.shop = shop
    return shop
  }

  /** 抽拍卖稀有物（V7.3：按境界分层的「当前 ＋ 往下三层」窗口，每层 AUCTION_PER_TIER 件）
   *  `m.auctionList` ＝ 分层明细（UI 用）；`m.auction` ＝ 首件（**兼容既有单件视图**） */
  rollAuction () {
    const tiers = auctionWindow(this.realmIndex)
    if (!tiers.length) {
      this.m.auction = null
      this.m.auctionList = []
      return null
    }
    const list = []
    for (const t of tiers) {
      const ids = t.items.slice()
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const x = ids[i]; ids[i] = ids[j]; ids[j] = x
      }
      for (const id of ids.slice(0, AUCTION_PER_TIER)) {
        const base = getGoodsValue(id)
        if (!(base > 0)) continue
        const price = Math.max(1, Math.round(base * randRange(AUCTION_PRICE_RANGE[0], AUCTION_PRICE_RANGE[1])))
        list.push({ id, base, price, bought: false, minRealm: t.realm, realm: t.realm, realmName: t.realmName })
      }
    }
    this.m.auctionList = list
    this.m.auction = list.length ? { ...list[0] } : null
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

  /** 拍下（高境界拍卖行）
   *  V7.3：`id` 可选（不传＝拍 `m.auction` 首件，兼底既有调用）；**每件各限拍 1 次** */
  buyAuction (id = null, now = Date.now()) {
    this.ensureDaily(now)
    const list = this.m.auctionList || []
    const wantId = id || (this.m.auction && this.m.auction.id)
    const a = list.find((x) => x.id === wantId) || this.m.auction
    if (!a) return { ok: false, message: '拍卖行尚未开启（需更高境界）。' }
    if (this.realmIndex < a.minRealm) {
      return { ok: false, message: `境界不足：此拍需 ${a.realmName || '金丹'}期以上。` }
    }
    if (a.bought) return { ok: false, message: '此拍已结，本轮不再上架。' }
    if (this.stones < a.price) {
      return { ok: false, message: `灵石不足：拍下需 ${a.price}，还差 ${a.price - this.stones}。` }
    }
    this.stones = this.stones - a.price
    this._addItem(a.id, 1)
    a.bought = true
    const mirror = list.find((x) => x.id === a.id)
    if (mirror) mirror.bought = true
    if (this.m.auction && this.m.auction.id === a.id) this.m.auction.bought = true
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
        icon: it.icon,
        quality: it.quality,
        pool: slot.pool || 'base',
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
      icon: it.icon,
      quality: it.quality,
      unit: getUnit(it),
      price: a.price,
      bought: a.bought,
      minRealm: a.minRealm,
      realm: a.realm,
      realmName: a.realmName,
      realmOk: this.realmIndex >= a.minRealm,
      affordable: this.realmIndex >= a.minRealm && !a.bought && this.stones >= a.price
    }
  }

  /** 分层拍卖视图（V7.3 · UI 用）：按境界分组返回「当前 ＋ 往下三层」共 12 件 */
  auctionListView () {
    const list = this.m.auctionList || []
    const tiers = []
    let cur = null
    for (const x of list) {
      const it = getItem(x.id)
      if (!cur || cur.realm !== x.realm) {
        cur = { realm: x.realm, realmName: x.realmName, items: [] }
        tiers.push(cur)
      }
      cur.items.push({
        id: x.id,
        name: it.name,
        icon: it.icon,
        quality: it.quality,
        unit: getUnit(it),
        base: x.base,
        price: x.price,
        bought: x.bought,
        realm: x.realm,
        realmName: x.realmName,
        minRealm: x.minRealm,
        realmOk: this.realmIndex >= x.minRealm,
        affordable: this.realmIndex >= x.minRealm && !x.bought && this.stones >= x.price
      })
    }
    return {
      open: this.realmIndex >= AUCTION_MIN_REALM,
      minRealm: AUCTION_MIN_REALM,
      count: list.length,
      tiers
    }
  }
}

export default MarketSystem
