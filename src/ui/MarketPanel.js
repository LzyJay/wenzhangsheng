/**
 * MarketPanel.js —— 坊市面板（#market-overlay 三页签：折扣店 / 回收 / 拍卖行）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 新层 · V3.5.5 拆分 main.js 第一批，§13.1① 修订已登记 §13.4⑤）：
 *   · 允许：操作**本面板自己**的 DOM（dom 注入的 market* 引用）；调用注入的 system
 *     实例（market）与装配层工具（helpers）；import **纯数据层**（data/ 零依赖）与
 *     同层公用渲染器（ui/itemTile.js）。
 *   · 禁止：import 任何 systems（一律经 createMarketPanel(ctx) 注入，依赖单向指向装配层）；
 *     碰其他面板的 DOM；藏业务规则（买/卖/拍规则在 MarketSystem + data/market.js）。
 * 数据源：src/data/market.js（货值表 / 品质价表 / 折扣区间 / 回收率 / 拍卖分层）
 * 口径（沿 2.6 装配区）：买/卖/拍只搬动「灵石」与「道具」，不产修为、不晋境界（§七 护栏）。
 *
 * V7.3 改版（主人 2026-09-22）：三页**全部图标化**——统一走 `ui/itemTile.js` 的方形铭牌格
 *   （2 字铭牌 ＋ 品质色 ＋ 角标），鼠标移入浮出一句话简介详情卡，卡内给「购买 / 售全 / 拍下」。
 *   角标语义改为**价格**（商店与拍卖）与**持有数**（回收）；折扣、起拍与「需某境界」写在卡的
 *   标题与来源行里，不再占一行文字。拍卖页按境界分组（当前 ＋ 往下三层，每层 3 件）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { RECYCLE_RATE, AUCTION_PER_TIER } from '../data/market.js'
import { buildItemGrid, attachItemCard, emptyNote } from './itemTile.js'

export function createMarketPanel (ctx) {
  const dom = ctx.dom
  const getState = ctx.state            // () => state（避免捕获 boot 前的引用）
  const getSystem = ctx.system          // () => market
  const H = ctx.helpers
  if (!dom.marketOverlay) return null

  let tab = 'shop'                      // 当前页签：shop | recycle | auction

  function open () {
    if (!getState()) return
    H.closeTip()
    H.closeAllOverlays('market')        // 与其余遮罩互斥（集中维护，见 closeAllOverlays）
    render()
    H.ovShow(dom.marketOverlay)
    dom.btnMarket.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.marketOverlay)
    dom.btnMarket.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.marketOverlay.classList.contains('show')) close()
    else open()
  }

  function render () {
    const system = getSystem()
    if (!getState() || !system) return
    system.ensureDaily(Date.now())
    if (tab === 'shop') renderShop(system)
    else if (tab === 'recycle') renderRecycle(system)
    else renderAuction(system)
  }

  // ── 折扣店：图标网格（角标＝当日价）× 卡内「购买」──────────────────────────
  function renderShop (system) {
    const shop = system.shopView()
    if (!shop.length) {
      emptyNote(dom.marketShop, '今日货架空了，下一轮再来。')
    } else {
      buildItemGrid(dom.marketShop, shop.map((s) => ({
        id: s.id,
        badge: s.price,
        disabled: !s.affordable,
        title: `${s.name} · ${(s.discount * 10).toFixed(1)}折 · ${s.price} 灵石`
      })))
    }
    if (dom.marketNote) {
      dom.marketNote.textContent = `折扣店${H.fmtRefreshPeriod()}刷新一次（同一轮内不变，下一轮换新）；` +
        '货架 10 席＝常驻基础货 4 席 ＋ 本界 4 席 ＋ 公用 2 席（本界 / 公用按品质抽取，越稀有越难碰上）。' +
        '角标＝当日价，鼠标移入看详情并购买；灵石不足时卡内按键置灰。坊市只流通灵石与道具，不产修为、不晋境界。'
    }
  }

  // ── 回收：图标网格（角标＝持有数）× 卡内「售全」────────────────────────────
  function renderRecycle (system) {
    const list = system.recycleView()
    if (!list.length) {
      emptyNote(dom.marketRecycle, '行囊里没有可卖之物。')
    } else {
      buildItemGrid(dom.marketRecycle, list.map((it) => ({
        id: it.id,
        count: it.count,
        title: `${it.name} ×${it.count} · 回收 ${it.price}/${it.unit} · 共 +${it.total} 灵石`
      })))
    }
    if (dom.marketNote) {
      dom.marketNote.textContent = `回收价＝基准价 × ${RECYCLE_RATE}（<1，买来再卖会亏，防刷灵石）。` +
        '角标＝持有数，鼠标移入看详情并「售全」整堆。'
    }
  }

  // ── 拍卖行：按境界分组的图标网格 × 卡内「拍下」────────────────────────────
  function renderAuction (system) {
    const v = system.auctionListView()
    if (!v.open) {
      emptyNote(dom.marketAuction, `拍卖行尚未开启。需金丹期以上修士方可入拍（现为第 ${v.minRealm + 1} 阶门槛）。`)
      if (dom.marketNote) dom.marketNote.textContent = '高境界拍卖行：金丹期起开放，按境界分层，每层 3 件，只展示当前境界与往下三层。'
      return
    }
    const frag = document.createDocumentFragment()
    for (const t of v.tiers) {
      const head = document.createElement('div')
      head.className = 'tech-sec bag-sec'
      head.textContent = `${t.realmName}层 · ${t.items.length} 件`
      frag.appendChild(head)
      const host = document.createElement('div')
      frag.appendChild(host)
      buildItemGrid(host, t.items.map((x) => ({
        id: x.id,
        badge: x.price,
        disabled: !x.affordable,
        title: `${x.name} · 起拍 ${x.price} 灵石${x.realmOk ? '' : `（需${x.realmName}期）`}${x.bought ? ' · 已结' : ''}`
      })))
      const card = attachItemCard(host, {
        actions: (id) => {
          const it = t.items.find((y) => y.id === id)
          if (!it) return []
          return [{
            act: 'auction',
            label: it.bought ? '已 结' : '拍 下',
            disabled: it.bought || !it.realmOk || !it.affordable,
            title: it.realmOk ? `起拍 ${it.price} 灵石` : `需${it.realmName}期以上`
          }]
        }
      })
      if (card) card.hide()
    }
    dom.marketAuction.replaceChildren(frag)
    if (dom.marketNote) {
      dom.marketNote.textContent = `按境界分层（每层 ${AUCTION_PER_TIER} 件）· 只展示当前境界与往下三层，共 ${v.count} 件；` +
        '角标＝起拍价，鼠标移入看详情并「拍下」；每件本轮各限拍 1 次。'
    }
  }

  // 折扣店 / 回收 两页宿主固定 → 卡片委托挂一次即可（宿主重绘时卡片自愈重建）
  attachItemCard(dom.marketShop, {
    actions: (id) => {
      const system = getSystem()
      const s = system && system.shopView().find((x) => x.id === id)
      return s ? [{ act: 'buy', label: '购 买', disabled: !s.affordable, title: `${s.price} 灵石（${(s.discount * 10).toFixed(1)}折）` }] : []
    }
  })
  attachItemCard(dom.marketRecycle, {
    actions: (id) => {
      const system = getSystem()
      const it = system && system.recycleView().find((x) => x.id === id)
      return it ? [{ act: 'sell', label: '售 全', title: `共 +${it.total} 灵石` }] : []
    }
  })

  // 面板动作（事件委托：面板每次重绘不丢监听）
  H.onPress(dom.marketOverlay, (e) => {
    const system = getSystem()
    const buy = e.target.closest('[data-act="buy"]')
    if (buy && !buy.disabled) {
      const slot = system.shopView().find((x) => x.id === buy.dataset.item)
      if (!slot) return
      const res = system.buy(slot.index)
      H.pushLog(res.message, res.ok ? 'ok' : 'info')
      if (res.ok) { H.persist('market-buy'); H.emitFloat({ text: `灵石 −${res.cost}`, kind: 'gold' }) }
      render()
      return
    }
    const sell = e.target.closest('[data-act="sell"]')
    if (sell && !sell.disabled) {
      const res = system.sell(sell.dataset.item)
      H.pushLog(res.message, res.ok ? 'ok' : 'info')
      if (res.ok) { H.persist('market-sell'); H.emitFloat({ text: `灵石 +${res.gain}`, kind: 'gold' }) }
      render()
      return
    }
    const auc = e.target.closest('[data-act="auction"]')
    if (auc && !auc.disabled) {
      const res = system.buyAuction(auc.dataset.item)
      H.pushLog(res.message, res.ok ? 'ok' : 'info')
      if (res.ok) { H.persist('market-auction'); H.emitFloat({ text: `灵石 −${res.cost}`, kind: 'gold' }) }
      render()
    }
  })

  // 页签切换（面板内部状态；转页显隐一并处理）
  for (const t of dom.marketTabs) {
    t.addEventListener('click', () => {
      tab = t.dataset.markettab || 'shop'
      for (const x of dom.marketTabs) x.classList.toggle('on', x === t)
      dom.marketShopPage.hidden = tab !== 'shop'
      dom.marketRecyclePage.hidden = tab !== 'recycle'
      dom.marketAuctionPage.hidden = tab !== 'auction'
      render()
    })
  }

  return { open, close, toggle, render }
}
