/**
 * BagPanel.js —— 行囊面板（#bag-overlay；丹房已分离）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   系统实例与装配层工具经 createBagPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（getItem/getUnit/ITEM_TYPE_ORDER/ITEM_TYPE_NAME/USE_ACTIONS ← data/items.js）。
 *
 * V7.1 改版（主人 2026-09-22 拍板）：
 *   ① **按类型五栏网格**：丹药 / 材料 / 法宝 / 符箓 / 残页；只渲染**实际持有**（数量 > 0）的物品，
 *      某栏为空则整栏（含分组头）不渲染；全空仍出「囊中空空」空态。
 *   ② **文字图标**：每格居中显示物品 `icon`（2 字简称）；文字色 / 描边 / 底色统一取该物品**品质**，
 *      色板 import `util/quality.js` **单一真源**（不复制副本——V5.9.1 专门收敛过这种副本）。
 *   ③ **数量角标**：右下角小角标显示持有数（数量 1 亦显示，口径一致；三位数自动收窄字号）。
 *   ④ **悬停详情卡**：鼠标移入图标浮出（名称 / 品质 / 持有量 / 描述 / 来源），卡在本面板内自绘
 *      —— **刻意不用全局 #tip**：ui 层规约是「只碰本面板自己的 DOM」，面板内自绘亦天然不碰
 *      拖拽区（坑 10）与 Esc 链；卡片随图标定位，越界翻到上方、横向夹回面板宽度内。
 *   ⑤ **使用白名单**：只有 `USE_ACTIONS` 里登记过的物品才在详情卡内给「使用」键。
 *      ⚠ 旧实现是按 id 硬编码 + **兜底回落到灵根重掷（`doReroll`）**——物品库扩容到 504 条后，
 *      未登记物品一旦被点到就会把灵根洗掉；白名单化后该分支**已删除**，结构上不可能再落到兜底。
 *
 * V7.2 改版（主人 2026-09-22 拍板）：
 *   ⑥ **类型页签**：顶部「全部 ｜ 丹药 ｜ 材料 ｜ 法宝 ｜ 符箓 ｜ 残页」——一次只渲染一类，
 *      键上带该类**持有种数**；种数为 0 的类置灰不可点；默认「全部」（仍按五类分栏）。
 *      `curType` 是**本面板内存态**（不落存档 → 不动 SaveSystem / SCHEMA_VERSION / 迁移链）。
 *      页签键位每次渲染重建，故切换走 **#bag-tabs 上的事件委托**（逐键绑会漏解绑）。
 *   ⑦ **详情卡精炼**：默认只显 `getBrief(it)` 一句话简介（截断口径唯一在 data 层），
 *      长说明收进「展开全文 / 收起」；展开态**按物品 id 记忆**（切到别的物品自动收起），
 *      展开 / 收起后正文高度变化 → 必须重跑 `placeCard()` 重新定位。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getItem, getUnit, getBrief, ITEM_TYPE_ORDER, ITEM_TYPE_NAME, USE_ACTIONS } from '../data/items.js'
import { QUALITY_KEYS, QUALITY_NAME, QUALITY_COLOR } from '../util/quality.js'

export function createBagPanel (ctx) {
  const dom = ctx.dom
  const state = ctx.state
  const H = ctx.helpers
  if (!dom.bagOverlay) return null

  // ── 凝神丹（V3.5.1 新增可用丹药）：限时产出增益，走 state.buffs 公共乘区 ──
  const NINGSHEN = { itemId: 'pill_ningshen', buffId: 'buff_ningshen', pct: 0.15, durSec: 600 }

  /** 服用凝神丹：现实 10 分钟修为产出 +15%（不叠加，再服只刷新时长） */
  function useNingshen () {
    if (!state) return
    const inv = state.inventory.items
    const have = inv[NINGSHEN.itemId] | 0
    if (have <= 0) { H.pushLog('凝神丹不足。', 'info'); return }
    inv[NINGSHEN.itemId] = have - 1
    const now = Date.now()
    const i = (state.buffs || []).findIndex((b) => b.id === NINGSHEN.buffId)
    if (i >= 0) state.buffs.splice(i, 1)
    state.buffs.push({
      id: NINGSHEN.buffId,
      name: '凝神丹',
      kind: 'buff',
      mods: { qiRatePct: NINGSHEN.pct },
      endsAt: now + NINGSHEN.durSec * 1000,
      source: { type: 'pill', ref: NINGSHEN.itemId }
    })
    H.pushLog('凝神丹入腹，灵台一片清明——现实 10 分钟内修为产出 +15%。', 'ok')
    H.persist('pill-ningshen')
    H.render()
  }

  // ── 降灵符（V3.5.7 原著首批：符箓线第一张实装符）——同走 state.buffs 公共乘区 ──
  const JIANGLING = { itemId: 'talisman_jiangling', buffId: 'buff_jiangling', pct: 0.10, durSec: 300 }

  /** 焚降灵符：现实 5 分钟修为产出 +10%（与凝神丹可叠加；再焚只刷新时长） */
  function useJiangling () {
    if (!state) return
    const inv = state.inventory.items
    const have = inv[JIANGLING.itemId] | 0
    if (have <= 0) { H.pushLog('降灵符不足。', 'info'); return }
    inv[JIANGLING.itemId] = have - 1
    const now = Date.now()
    const i = (state.buffs || []).findIndex((b) => b.id === JIANGLING.buffId)
    if (i >= 0) state.buffs.splice(i, 1)
    state.buffs.push({
      id: JIANGLING.buffId,
      name: '降灵符',
      kind: 'buff',
      mods: { qiRatePct: JIANGLING.pct },
      endsAt: now + JIANGLING.durSec * 1000,
      source: { type: 'talisman', ref: JIANGLING.itemId }
    })
    H.pushLog('降灵符焚起，天地灵气应召而来——现实 5 分钟内修为产出 +10%。', 'ok')
    H.persist('talisman-jiangling')
    H.render()
  }

  /**
   * 白名单执行器（唯一入口）：只认 `USE_ACTIONS` 登记过的 id。
   * 未登记者在面板里**根本不会渲染出「使用」键**，故此处 default 返回 false 只是双保险。
   */
  function useItemById (id) {
    const act = USE_ACTIONS[id]
    if (!act) return false
    if (act === 'buff-ningshen') { useNingshen(); return true }
    if (act === 'buff-jiangling') { useJiangling(); return true }
    if (act === 'reroll-root') { close(); H.doReroll(); return true }   // 洗髓丹（白名单内，非兜底）
    return false
  }

  // ══ 详情卡（面板内自绘；挂 #bag-list，绝对定位随图标）════════════════════════
  let cardEl = null
  let cardTimer = null
  let cardTile = null        // 卡锚定的图标（展开 / 收起后正文高度变了要重跑定位）
  let cardId = null          // 当前卡展示的物品 id
  let cardCount = 0
  let descOpenFor = null     // V7.2 全文展开态：**按物品 id 记忆**（换物品自动收起）

  function ensureCard () {
    if (cardEl && cardEl.isConnected) return cardEl
    cardEl = document.createElement('div')
    cardEl.className = 'bag-card'
    cardEl.hidden = true
    // hover 桥接：鼠标从图标移到卡片（跨过 6px 间隙）期间不能收卡，否则卡内「使用」永远点不到
    cardEl.addEventListener('mouseenter', () => { if (cardTimer) { clearTimeout(cardTimer); cardTimer = null } })
    cardEl.addEventListener('mouseleave', () => scheduleCardHide())
    // 卡内两键一律走 pointerdown（与项目「按下即响应」口径一致；重绘也不丢这一次点击）
    //   ① 使用 ② 展开全文 / 收起（V7.2）
    cardEl.addEventListener('pointerdown', (e) => {
      const use = e.target.closest('[data-act="use-item"]')
      if (use) {
        if (use.disabled) return
        e.stopPropagation()
        if (useItemById(use.dataset.item)) render()   // 用掉立刻重绘，角标同步减一
        return
      }
      const tg = e.target.closest('[data-act="toggle-desc"]')
      if (!tg) return
      e.stopPropagation()
      descOpenFor = descOpenFor === cardId ? null : cardId
      paintCard()                                     // 正文高度变了，paintCard 内会重跑定位
    })
    return cardEl
  }

  /** 定位：默认贴图标下方；越出内容高度则翻到上方；横向夹回面板宽度内 */
  function placeCard (tile) {
    const host = dom.bagList
    if (!host || !cardEl) return
    const tw = tile.offsetWidth
    const th = tile.offsetHeight
    const cw = cardEl.offsetWidth
    const ch = cardEl.offsetHeight
    const hostW = host.clientWidth || 0
    const hostH = host.scrollHeight || 0
    let left = tile.offsetLeft + tw / 2 - cw / 2
    left = Math.max(0, Math.min(left, Math.max(0, hostW - cw)))
    let top = tile.offsetTop + th + 6
    if (top + ch > hostH && tile.offsetTop - ch - 6 >= 0) top = tile.offsetTop - ch - 6
    cardEl.style.left = `${Math.round(left)}px`
    cardEl.style.top = `${Math.round(top)}px`
  }

  /** 重建卡内内容（showCard 与「展开 / 收起」共用；按 descOpenFor 决定简体还是全文 · V7.2） */
  function paintCard () {
    if (cardId == null) return
    const it = getItem(cardId)
    const col = QUALITY_COLOR[it.quality] || QUALITY_COLOR.fan
    const qn = QUALITY_NAME[it.quality] || '凡'
    const unit = getUnit(it)
    const brief = getBrief(it)                              // 一句话简介（截断口径在 data 层）
    const full = String(it.desc || '').trim()
    const hasMore = !!full && full !== brief                // 简介 ≠ 全文才给展开入口
    const open = hasMore && descOpenFor === cardId
    const el = ensureCard()
    el.dataset.for = cardId
    el.innerHTML =
      `<div class="bc-head"><span class="bc-name" style="color:${col}">${it.name}</span>` +
      `<span class="bc-q" style="color:${col};border-color:${col}">${qn}</span></div>` +
      `<div class="bc-row"><span class="k">持有</span><span class="v">${cardCount} ${unit}</span></div>` +
      `<div class="bc-desc${open ? ' open' : ''}">${open ? full : brief}</div>` +
      (hasMore
        ? `<div class="bc-toggle" data-act="toggle-desc" role="button" tabindex="0">${open ? '收 起 ▲' : '展开全文 ▾'}</div>`
        : '') +
      (it.from ? `<div class="bc-from">得自 ${it.from}</div>` : '') +
      (USE_ACTIONS[cardId]
        ? `<div class="bc-act"><button class="mini" data-act="use-item" data-item="${cardId}"${H.rootBusy() ? ' disabled' : ''} title="${it.useHint || ''}">使 用</button></div>`
        : '')
    if (!el.parentNode) dom.bagList.appendChild(el)
    el.hidden = false
    if (cardTile) placeCard(cardTile)                       // 正文高度可能已变（展开），必须重定位
  }

  function showCard (tile, id, count) {
    if (cardTimer) { clearTimeout(cardTimer); cardTimer = null }
    if (descOpenFor && descOpenFor !== id) descOpenFor = null   // 换物品自动收起旧展开态
    cardTile = tile
    cardId = id
    cardCount = count
    paintCard()
  }

  function hideCard () { if (cardEl) cardEl.hidden = true }

  function scheduleCardHide () {
    if (cardTimer) clearTimeout(cardTimer)
    cardTimer = setTimeout(() => { cardTimer = null; hideCard() }, 160)
  }

  // ══ 渲染 ═══════════════════════════════════════════════════════════════════
  /** 内容签名：**当前类** + 持有集合与数量未变即不重绘（面板每 100ms 会被 render 触发，504 条库也不抖） */
  let lastSig = ''
  /** 页签签名：当前类 + 各类种数未变即不重建键位（避免 100ms 级 DOM churn） */
  let lastTabSig = ''
  /** 当前浏览类：`'all'` 或五类型之一（V7.2 · 本面板内存态，**不落存档**） */
  let curType = 'all'

  /** 各类型的**持有种数**（≠ 持有数量；与页签上的小字同口径） */
  function typeCounts (held) {
    const c = {}
    for (const [id] of held) {
      const t = getItem(id).type || 'material'
      c[t] = (c[t] || 0) + 1
    }
    return c
  }

  /** 页签行：全部 ＋ 五类型；键上小字＝该类持有种数，种数为 0 的类置灰不可点 */
  function renderTabs (counts) {
    if (!dom.bagTabs) return
    const frag = document.createDocumentFragment()
    for (const k of ['all', ...ITEM_TYPE_ORDER]) {
      const n = k === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[k] || 0)
      const label = k === 'all' ? '全部' : (ITEM_TYPE_NAME[k] || k)
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'bag-tab' + (curType === k ? ' on' : '')
      b.dataset.bagtab = k
      b.disabled = n <= 0                                     // 空类置灰不可点
      b.title = `${label}：持有 ${n} 种${n ? '' : '（暂无，故不可点）'}`
      b.textContent = label
      const cnt = document.createElement('span')
      cnt.className = 'cnt'
      cnt.textContent = String(n)
      b.appendChild(cnt)
      frag.appendChild(b)
    }
    dom.bagTabs.replaceChildren(frag)
  }

  function render () {
    if (!state) return
    const items = (state.inventory && state.inventory.items) || {}
    const held = []
    for (const [id, n] of Object.entries(items)) {
      const c = n | 0
      if (c > 0) held.push([id, c])
    }
    const counts = typeCounts(held)

    // 当前类被用空（例如刚用掉最后一枚丹）→ 回到「全部」，避免停在空栏干瞪眼
    if (curType !== 'all' && !(counts[curType] > 0)) curType = 'all'

    const tabSig = `${curType}|${ITEM_TYPE_ORDER.map((t) => counts[t] || 0).join(',')}`
    if (tabSig !== lastTabSig) { lastTabSig = tabSig; renderTabs(counts) }

    if (dom.bagNote) {
      dom.bagNote.textContent = '数量角标＝持有数；鼠标移到图标上看详情，可用的丹药 / 符箓在详情卡里点「使用」。'
    }

    if (!held.length) {
      lastSig = ''
      hideCard()
      const empty = document.createElement('div')
      empty.className = 'bag-empty'
      empty.append('囊中空空')
      empty.appendChild(document.createElement('br'))
      empty.append('打坐时会偶得灵草 · 玄铁矿 · 妖丹，也可去「丹房」查看丹方')
      dom.bagList.replaceChildren(empty)
      return
    }

    const sig = `${curType}|` + held.map(([id, c]) => `${id}:${c}`).join(',')
    if (sig === lastSig && dom.bagList.querySelector('.bag-grid')) return
    lastSig = sig
    hideCard()   // 重绘前收卡，避免卡片挂在被移除的节点上

    const frag = document.createDocumentFragment()
    let kinds = 0
    // 「全部」走五栏；选中某类时只出该类一栏（且不再重复分组头——页签已指示当前类，省一行高度）
    const types = curType === 'all' ? ITEM_TYPE_ORDER : [curType]
    for (const type of types) {
      // 同栏内按品质降序（仙 → 凡），同品质按 id 稳定排序
      const list = held
        .filter(([id]) => (getItem(id).type || 'material') === type)
        .sort((a, b) => {
          const d = QUALITY_KEYS.indexOf(getItem(b[0]).quality) - QUALITY_KEYS.indexOf(getItem(a[0]).quality)
          return d !== 0 ? d : a[0].localeCompare(b[0])
        })
      if (!list.length) continue
      kinds += list.length

      if (curType === 'all') {
        const head = document.createElement('div')
        head.className = 'tech-sec bag-sec'                      // 复用既有分组头范式
        head.textContent = `${ITEM_TYPE_NAME[type] || type} · ${list.length} 种`
        frag.appendChild(head)
      }

      const grid = document.createElement('div')
      grid.className = 'bag-grid'
      for (const [id, count] of list) {
        const it = getItem(id)
        const col = QUALITY_COLOR[it.quality] || QUALITY_COLOR.fan
        const tile = document.createElement('button')
        tile.type = 'button'
        tile.className = 'bag-tile'
        tile.dataset.id = id
        tile.style.setProperty('--q', col)                       // 品质色：描边 / 底色 / 文字统一取它
        tile.setAttribute('aria-label', `${it.name}（${QUALITY_NAME[it.quality] || '凡'}）持有 ${count} ${getUnit(it)}`)
        const ic = document.createElement('span')
        ic.className = 'bt-ic'
        ic.textContent = it.icon || (it.name || '').slice(0, 2)
        const num = document.createElement('span')
        num.className = 'bt-num' + (String(count).length >= 3 ? ' long' : '')   // 三位数收窄字号
        num.textContent = String(count)
        tile.append(ic, num)
        if (USE_ACTIONS[id]) {
          const dot = document.createElement('span')             // 可用标记：极小鎏金点（不占格内空间）
          dot.className = 'bt-dot'
          tile.appendChild(dot)
        }
        tile.addEventListener('mouseenter', () => showCard(tile, id, count))
        tile.addEventListener('mouseleave', () => scheduleCardHide())
        tile.addEventListener('focus', () => showCard(tile, id, count))
        tile.addEventListener('blur', () => scheduleCardHide())
        tile.addEventListener('click', () => {                   // 点击＝聚焦查看（触摸屏 / 键盘走查）
          if (cardEl && !cardEl.hidden && cardEl.dataset.for === id) hideCard()
          else showCard(tile, id, count)
        })
        grid.appendChild(tile)
      }
      frag.appendChild(grid)
    }

    dom.bagList.replaceChildren(frag)
    if (dom.bagNote) {
      dom.bagNote.textContent = (curType === 'all'
        ? `持有 ${kinds} 种 · 按「${ITEM_TYPE_ORDER.map((t) => ITEM_TYPE_NAME[t]).join(' / ')}」分栏；点上方页签可只看一类。`
        : `${ITEM_TYPE_NAME[curType] || curType} · 持有 ${kinds} 种；点页签「全部」看其余分类。`) +
        '数量角标＝持有数；鼠标移到图标上看详情（默认一句话简介，点「展开全文」看细节），' +
        '可用的丹药 / 符箓在详情卡里点「使用」。'
    }
  }

  // ── V7.2 页签切换：**事件委托**挂一次（键位每次渲染都重建，逐键绑会漏解绑 / 重复绑）──
  if (dom.bagTabs) {
    dom.bagTabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bagtab]')
      if (!b || b.disabled || b.dataset.bagtab === curType) return
      curType = b.dataset.bagtab
      descOpenFor = null
      hideCard()
      render()
    })
  }

  function open () {
    if (!state) return
    H.closeTip()
    H.closeAllOverlays('bag')
    render()
    H.ovShow(dom.bagOverlay)
    dom.btnBag.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    hideCard()
    H.closeTip()          // 收面板时一并清掉残留卡 / 残留全局浮层
    H.ovHide(dom.bagOverlay)
    dom.btnBag.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.bagOverlay.classList.contains('show')) close()
    else open()
  }

  return { open, close, toggle, render }
}
