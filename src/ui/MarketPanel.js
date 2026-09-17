/**
 * MarketPanel.js —— 坊市面板（#market-overlay 三页签：折扣店 / 回收 / 拍卖行）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 新层 · V3.5.5 拆分 main.js 第一批，§13.1① 修订已登记 §13.4⑤）：
 *   · 允许：操作**本面板自己**的 DOM（dom 注入的 market* 引用）；调用注入的 system
 *     实例（market）与装配层工具（helpers）；import **纯数据层**（data/ 零依赖）。
 *   · 禁止：import 任何 systems（一律经 createMarketPanel(ctx) 注入，依赖单向指向装配层）；
 *     碰其他面板的 DOM；藏业务规则（买/卖/拍规则在 MarketSystem + data/market.js）。
 * 数据源：src/data/market.js（货值表 / 折扣区间 / 回收率）
 * 口径（沿 2.6 装配区）：买/卖/拍只搬动「灵石」与「道具」，不产修为、不晋境界（§七 护栏）。
 * 跨层协作：装配层 boot 时创建本面板并注入；主循环节流调用 render()（PANEL_MS 节拍）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { RECYCLE_RATE } from '../data/market.js'

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

  function renderShop (system) {
    const shop = system.shopView()
    if (!shop.length) {
      dom.marketShop.innerHTML = '<div class="bag-empty">今日货架空了，明日再来。</div>'
    } else {
      const frag = document.createDocumentFragment()
      for (const s of shop) {
        const row = document.createElement('div')
        row.className = 'sect-row'
        const tn = document.createElement('span')
        tn.className = 'tn'
        tn.textContent = s.name
        const disc = document.createElement('span')
        disc.className = 'm-disc'
        disc.textContent = `${(s.discount * 10).toFixed(1)}折`
        const td = document.createElement('span')
        td.className = 'td'
        td.innerHTML = `<span class="m-old">${s.base}</span><span style="color:var(--gold-light)">${s.price}</span> 灵石`
        const btn = document.createElement('button')
        btn.className = 'mini'
        btn.textContent = '购买'
        btn.dataset.buy = String(s.index)
        if (!s.affordable) btn.disabled = true
        row.append(tn, disc, td, btn)
        frag.appendChild(row)
      }
      dom.marketShop.replaceChildren(frag)
    }
    if (dom.marketNote) {
      dom.marketNote.textContent = `折扣店${H.fmtRefreshPeriod()}刷新一次（同一轮内不变，下一轮换新）；灵石不足时按钮置灰。坊市只流通灵石与道具，不产修为、不晋境界。`
    }
  }

  function renderRecycle (system) {
    const list = system.recycleView()
    if (!list.length) {
      dom.marketRecycle.innerHTML = '<div class="bag-empty">行囊里没有可卖之物。</div>'
    } else {
      const frag = document.createDocumentFragment()
      for (const it of list) {
        const row = document.createElement('div')
        row.className = 'sect-row'
        const tn = document.createElement('span')
        tn.className = 'tn'
        tn.textContent = `${it.name} ×${it.count}`
        const td = document.createElement('span')
        td.className = 'td'
        td.innerHTML = `回收 <span style="color:var(--gold-light)">${it.price}</span>/${it.unit} → 共 <span style="color:var(--gold-light)">+${it.total}</span> 灵石`
        const btn = document.createElement('button')
        btn.className = 'mini'
        btn.textContent = '售全'
        btn.dataset.sell = it.id
        row.append(tn, td, btn)
        frag.appendChild(row)
      }
      dom.marketRecycle.replaceChildren(frag)
    }
    if (dom.marketNote) {
      dom.marketNote.textContent = `回收价＝货值 × ${RECYCLE_RATE}（<1，买来再卖会亏，防刷灵石）。一键卖清整堆。`
    }
  }

  function renderAuction (system) {
    const a = system.auctionView()
    const need = a.minRealm >= 3 ? '元婴' : '金丹'
    if (!a.open) {
      dom.marketAuction.innerHTML = `<div class="bag-empty">拍卖行尚未开启。<br>需 ${need}期以上修士方可入拍。</div>`
      if (dom.marketNote) dom.marketNote.textContent = '高境界拍卖行（简化）：每日 1 件稀有物，达标可拍下，每日限 1 次。'
      return
    }
    const frag = document.createDocumentFragment()
    const row = document.createElement('div')
    row.className = 'sect-row'
    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.textContent = a.name
    const td = document.createElement('span')
    td.className = 'td'
    td.innerHTML = a.bought
      ? '今日已拍下，明日再来。'
      : `起拍 <span style="color:var(--gold-light)">${a.price}</span> 灵石${a.realmOk ? '' : `（需${need}期）`}`
    const btn = document.createElement('button')
    btn.className = 'mini'
    btn.textContent = a.bought ? '已结' : '拍下'
    btn.dataset.auction = '1'
    if (a.bought || !a.realmOk || !a.affordable) btn.disabled = true
    row.append(tn, td, btn)
    frag.appendChild(row)
    dom.marketAuction.replaceChildren(frag)
    if (dom.marketNote) {
      dom.marketNote.textContent = '高境界拍卖行（简化）：每日 1 件稀有物，达标可拍下，每日限 1 次。'
    }
  }

  // 面板动作（事件委托：面板每次重绘不丢监听）
  H.onPress(dom.marketOverlay, (e) => {
    const system = getSystem()
    const buy = e.target.closest('[data-buy]')
    if (buy && !buy.disabled) {
      const res = system.buy(+buy.dataset.buy)
      H.pushLog(res.message, res.ok ? 'ok' : 'info')
      if (res.ok) { H.persist('market-buy'); H.emitFloat({ text: `灵石 −${res.cost}`, kind: 'gold' }) }
      render()
      return
    }
    const sell = e.target.closest('[data-sell]')
    if (sell && !sell.disabled) {
      const res = system.sell(sell.dataset.sell)
      H.pushLog(res.message, res.ok ? 'ok' : 'info')
      if (res.ok) { H.persist('market-sell'); H.emitFloat({ text: `灵石 +${res.gain}`, kind: 'gold' }) }
      render()
      return
    }
    const auc = e.target.closest('[data-auction]')
    if (auc && !auc.disabled) {
      const res = system.buyAuction()
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
