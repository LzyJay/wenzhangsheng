/**
 * itemTile.js —— 物品图标网格公用渲染器（V7.3 · 全游戏统一物品呈现语言）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层）：只碰**传入的宿主节点**及其内部 DOM；只 import 纯数据层
 *   （data/items.js）与零依赖叶子层（util/quality.js）；禁止 import systems、
 *   禁止碰其他面板的 DOM。所有业务规则（能不能买 / 能不能用）由调用方经
 *   `opts` 注入，本文件只负责「画格子 + 浮卡片」。
 *
 * 复用点（7 处，V7.3）：行囊 · 坊市（折扣店 / 回收 / 拍卖）· 秘境积分商店 ·
 *   宗门商店 · 丹房丹方行 · 世界机制产物 · 成就与事件奖励（后两处在装配层调用）。
 *
 * 视觉语言（与行囊逐位一致，CSS 复用 index.html 的 .bag-grid / .bag-tile / .bag-card）：
 *   · 方形铭牌格：格心 2 字 `icon`；描边 / 底色 / 文字由品质色 `--q` 驱动（同源不同透明度）；
 *   · 右下角数量角标 `.bt-num`（三位数自动收窄）；可用物品加极小鎏金点 `.bt-dot`；
 *   · 悬停 / 聚焦浮出 `.bag-card` 详情卡：一句话简介 + 「展开全文 / 收起」，
 *     卡在宿主内自绘、随格定位、越界翻到上方、横向夹回宿主宽度。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getItem, getUnit, getBrief, USE_ACTIONS } from '../data/items.js'
import { QUALITY_NAME, QUALITY_COLOR } from '../util/quality.js'

/** 空白态（各面板统一文案口径） */
export function emptyNote (host, text) {
  if (!host) return
  const d = document.createElement('div')
  d.className = 'bag-empty'
  d.textContent = text
  host.replaceChildren(d)
}

/**
 * 渲染一排「物品格」。
 * @param {HTMLElement} host 宿主节点（其内容会被替换）
 * @param {Array<{id:string,count?:number,badge?:string,disabled?:boolean,title?:string}>} items
 * @param {{tile?:string, section?:string}} [opts] tile＝自定义格类（默认 bag-tile）
 * @returns {HTMLElement|null} 生成的网格节点
 */
export function buildItemGrid (host, items, opts = {}) {
  if (!host) return null
  if (!items || !items.length) return null
  const grid = document.createElement('div')
  grid.className = 'bag-grid'
  const tileCls = opts.tile || 'bag-tile'
  for (const x of items) {
    const it = getItem(x.id)
    const col = QUALITY_COLOR[it.quality] || QUALITY_COLOR.fan
    const tile = document.createElement('button')
    tile.type = 'button'
    tile.className = tileCls
    tile.dataset.item = x.id
    if (x.count != null) tile.dataset.count = String(x.count | 0)
    // 调用方附加数据（如坊市货架位 / 拍卖件 id），用 data-* 透出
    for (const [k, v] of Object.entries(x.data || {})) {
      if (v != null) tile.dataset[k] = String(v)
    }
    if (x.disabled) tile.disabled = true
    tile.style.setProperty('--q', col)
    const qn = QUALITY_NAME[it.quality] || '凡'
    const badge = x.badge != null ? x.badge : x.count
    tile.setAttribute('aria-label',
      `${it.name}（${qn}）${badge != null ? `持有 ${badge} ${getUnit(it)}` : ''}`)
    if (x.title) tile.title = x.title
    const ic = document.createElement('span')
    ic.className = 'bt-ic'
    ic.textContent = it.icon || (it.name || '').slice(0, 2)
    tile.appendChild(ic)
    if (badge != null) {
      const num = document.createElement('span')
      num.className = 'bt-num' + (String(badge).length >= 3 ? ' long' : '')
      num.textContent = String(badge)
      tile.appendChild(num)
    }
    if (x.dot != null ? x.dot : !!USE_ACTIONS[x.id]) {
      const dot = document.createElement('span')
      dot.className = 'bt-dot'
      tile.appendChild(dot)
    }
    grid.appendChild(tile)
  }
  host.replaceChildren(grid)
  return grid
}

/**
 * 给宿主挂「悬停详情卡」（事件委托，宿主重绘不丢监听）。
 * @param {HTMLElement} host 承载格子与卡片的宿主（须 position:relative）
 * @param {{onUse?:(id:string)=>void, actions?:(id:string)=>Array<{act:string,label:string,disabled?:boolean,title?:string}>}} [opts]
 * @returns {{hide:Function, refresh:Function}|null}
 */
export function attachItemCard (host, opts = {}) {
  if (!host) return null
  let card = null
  let timer = null
  let tile = null
  let curId = null
  let curCount = 0
  let descOpenFor = null

  function ensureCard () {
    if (card && card.isConnected) return card
    card = document.createElement('div')
    card.className = 'bag-card'
    card.hidden = true
    card.addEventListener('mouseenter', () => { if (timer) { clearTimeout(timer); timer = null } })
    card.addEventListener('mouseleave', () => scheduleHide())
    card.addEventListener('pointerdown', (e) => {
      const use = e.target.closest('[data-act="use-item"]')
      if (use) {
        if (use.disabled) return
        e.stopPropagation()
        if (opts.onUse) opts.onUse(use.dataset.item)
        return
      }
      const tg = e.target.closest('[data-act="toggle-desc"]')
      if (!tg) return
      e.stopPropagation()
      descOpenFor = descOpenFor === curId ? null : curId
      paint()
    })
    return card
  }

  function place (t) {
    if (!t || !card) return
    const tw = t.offsetWidth
    const th = t.offsetHeight
    const cw = card.offsetWidth
    const ch = card.offsetHeight
    const hostW = host.clientWidth || 0
    const hostH = host.scrollHeight || 0
    let left = t.offsetLeft + tw / 2 - cw / 2
    left = Math.max(0, Math.min(left, Math.max(0, hostW - cw)))
    let top = t.offsetTop + th + 6
    if (top + ch > hostH && t.offsetTop - ch - 6 >= 0) top = t.offsetTop - ch - 6
    card.style.left = `${Math.round(left)}px`
    card.style.top = `${Math.round(top)}px`
  }

  function paint () {
    if (curId == null || !card) return
    const it = getItem(curId)
    const col = QUALITY_COLOR[it.quality] || QUALITY_COLOR.fan
    const qn = QUALITY_NAME[it.quality] || '凡'
    const unit = getUnit(it)
    const brief = getBrief(it)
    const full = String(it.desc || '').trim()
    const hasMore = !!full && full !== brief
    const open = hasMore && descOpenFor === curId
    card.dataset.for = curId
    const acts = opts.actions ? (opts.actions(curId) || []) : []
    card.innerHTML =
      `<div class="bc-head"><span class="bc-name" style="color:${col}">${it.name}</span>` +
      `<span class="bc-q" style="color:${col};border-color:${col}">${qn}</span></div>` +
      (curCount > 0
        ? `<div class="bc-row"><span class="k">持有</span><span class="v">${curCount} ${unit}</span></div>`
        : '') +
      `<div class="bc-desc${open ? ' open' : ''}">${open ? full : brief}</div>` +
      (hasMore
        ? `<div class="bc-toggle" data-act="toggle-desc" role="button" tabindex="0">${open ? '收 起 ▲' : '展开全文 ▾'}</div>`
        : '') +
      (it.from ? `<div class="bc-from">得自 ${it.from}</div>` : '') +
      (acts.length
        ? `<div class="bc-act">${acts.map((a) => `<button class="mini" data-act="${a.act}" data-item="${curId}"${a.disabled ? ' disabled' : ''} title="${a.title || ''}">${a.label}</button>`).join('')}</div>`
        : '')
    if (!card.parentNode) host.appendChild(card)
    card.hidden = false
    if (tile) place(tile)
  }

  function show (t, id, count) {
    if (timer) { clearTimeout(timer); timer = null }
    if (curId !== id) descOpenFor = null          // 换物品自动收起旧展开态
    tile = t
    curId = id
    curCount = count | 0
    ensureCard()
    paint()
  }

  function hide () { if (card) card.hidden = true }
  function scheduleHide () {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; hide() }, 160)
  }

  host.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.bag-tile')
    if (!t || !host.contains(t) || !t.dataset.item) return
    if (t === tile && card && !card.hidden) return   // 同格内移动不重绘（防抖）
    show(t, t.dataset.item, Number(t.dataset.count || 0))
  })
  host.addEventListener('mouseout', (e) => { if (e.target.closest('.bag-tile')) scheduleHide() })
  host.addEventListener('focusin', (e) => {
    const t = e.target.closest && e.target.closest('.bag-tile')
    if (t && t.dataset.item) show(t, t.dataset.item, Number(t.dataset.count || 0))
  })
  host.addEventListener('focusout', (e) => { if (e.target.closest && e.target.closest('.bag-tile')) scheduleHide() })
  host.addEventListener('click', (e) => {
    const t = e.target.closest('.bag-tile')
    if (!t || !t.dataset.item || t.disabled) return
    if (card && !card.hidden && card.dataset.for === t.dataset.item) hide()
    else show(t, t.dataset.item, Number(t.dataset.count || 0))
  })

  return { hide, refresh: () => { if (card && !card.hidden) paint() } }
}
