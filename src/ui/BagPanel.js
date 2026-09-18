/**
 * BagPanel.js —— 行囊面板（#bag-overlay；丹房已分离）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   系统实例与装配层工具经 createBagPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（getItem/getUnit ← data/items.js）。
 * 凝神丹服用（useNingshen）走 state.buffs 公共乘区，落在本面板（唯一使用入口）。
 * 洗髓（doReroll）属灵根流程，经装配层回调（H.doReroll）触发。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getItem, getUnit } from '../data/items.js'

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

  function render () {
    if (!state) return
    const items = (state.inventory && state.inventory.items) || {}
    const entries = Object.entries(items).filter(([, n]) => (n | 0) > 0)

    if (dom.bagNote) {
      dom.bagNote.textContent = '「持有 N 枚」＝背包里的实际数量；可「使用」的丹药右侧带按钮，点一下即消耗 1 枚。'
    }

    if (!entries.length) {
      const empty = document.createElement('div')
      empty.className = 'bag-empty'
      empty.append('囊中空空')
      empty.appendChild(document.createElement('br'))
      empty.append('打坐时会偶得灵草 · 玄铁矿 · 妖丹，也可去「丹房」查看丹方')
      dom.bagList.replaceChildren(empty)
      return
    }

    const frag = document.createDocumentFragment()
    for (const [id, count] of entries) {
      const it = getItem(id)
      const unit = getUnit(it)
      const row = document.createElement('div')
      row.className = 'bag-item'

      const nm = document.createElement('span')
      nm.className = 'nm'
      nm.textContent = it.name

      // 数量写成「持有 N 枚」——不再是一个孤零零的数字，避免看不懂
      const qt = document.createElement('span')
      qt.className = 'qt'
      const num = document.createElement('b')
      num.textContent = String(count)
      qt.append('持有 ', num, ` ${unit}`)
      qt.title = `${it.name}：持有 ${count} ${unit}`

      const ds = document.createElement('span')
      ds.className = 'ds'
      ds.textContent = it.desc
      ds.appendChild(document.createElement('br'))
      const from = document.createElement('em')
      from.textContent = it.from
      ds.appendChild(from)

      row.append(nm, qt, ds)

      if (it.usable) {
        const btn = document.createElement('button')
        btn.className = 'mini'
        btn.textContent = '使用'
        btn.title = it.useHint || ''
        btn.disabled = H.rootBusy()
        btn.addEventListener('click', () => {
          if (it.id === 'pill_ningshen') { useNingshen(); render(); return }
          if (it.id === 'talisman_jiangling') { useJiangling(); render(); return }
          close(); H.doReroll()
        })
        row.appendChild(btn)
      }
      frag.appendChild(row)
    }
    dom.bagList.replaceChildren(frag)
  }

  /**
   * 丹房：丹方列表 + 炼制 / 自动炼制（主人 2026-09-17：背包与丹房分离；缺丹时自动开炉）
   * 「当前所需」＝当下真正卡关的丹药（突破缺的破境丹、渡劫缺的护劫丹）。
   */
  let lastAlchemyRender = 0 // 丹房面板轻刷节拍（V3.5.2：时间驱动）


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
