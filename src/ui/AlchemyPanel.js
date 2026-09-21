/**
 * AlchemyPanel.js —— 丹房面板（#alchemy-overlay：丹方 / 炼制 / 自动炼制）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   systems（alchemy / cult）与装配层工具经 createAlchemyPanel(ctx) 注入，禁止 import systems。
 * 「当前所需」＝当下真正卡关的丹药（突破缺的破境丹、渡劫缺的护劫丹），判定归各系统。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { QUALITY_COLOR } from '../data/events.js'   // 品质色板单一真源（原先本文件函数体内硬编码了一份逐字相同的副本）
// V7.3：物品图标网格公用渲染器（ui → ui 同层复用；只碰传入宿主）
import { buildItemGrid, attachItemCard } from './itemTile.js'

export function createAlchemyPanel (ctx) {
  const dom = ctx.dom
  const state = ctx.state
  // 系统实例一律取 getter（() => alchemy / () => cult）：本面板在 boot 里**先于 cult 实例化**，
  // 直取会捕获到 null（V4.7 批 0 修复的实测 bug：neededPills 静默抛错被 catch 吃掉，
  // → 丹方行的「当前所需」标记永远不出现）
  const getAlchemy = ctx.alchemy
  const getCult = ctx.cult
  const H = ctx.helpers
  if (!dom.alchemyOverlay) return null

  /** 当下"正缺"的丹药清单（纯读；判定归各系统，此处只做汇总） */
  function neededPills () {
    const out = []
    const cult = getCult()
    if (!cult) return out
    try {
      const pv = cult.getBreakthroughPreview(Date.now())
      if (pv.pillRequired && pv.pillMissing && pv.plan && pv.plan.pill) out.push(pv.plan.pill)
      if (pv.isTrial && pv.trial && Array.isArray(pv.trial.preps.views)) {
        for (const v of pv.trial.preps.views) {
          if (v.kind === 'consume' && v.itemId && v.state !== 'active' && (v.count | 0) <= 0) out.push(v.itemId)
        }
      }
    } catch (_) { /* 预览不可得时不标"所需"，不影响面板 */ }
    return out
  }

  function render () {
    const alchemy = getAlchemy()
    if (!alchemy) return
    // V4.7 主人：面板内「自动炼制」直观开关（与设置面板同一个叶子 settings.autoBrew，两处同步显示）
    const autoOn = !!(state.settings && state.settings.autoBrew !== false)
    if (dom.tgBrewAuto) {
      dom.tgBrewAuto.textContent = autoOn ? '开' : '关'
      dom.tgBrewAuto.classList.toggle('on', autoOn)
      dom.tgBrewAuto.title = autoOn
        ? '自动炼制：开 —— 每种丹常备 1 枚，库存见底且材料够就自动开炉补上（点按关闭）'
        : '自动炼制：关 —— 丹药不再自动补货，缺丹需手动开炉（点按开启）'
    }
    if (dom.brewAutoNote) {
      dom.brewAutoNote.textContent = autoOn ? '每种丹常备 1 枚，用掉自动补' : '已关闭：缺丹需手动开炉'
    }
    const needed = neededPills()
    const views = alchemy.recipesView({ needed })

    // 材料摘要（一眼看清手上有什么）
    if (dom.alchemyMats) {
      const inv = (state.inventory && state.inventory.items) || {}
      dom.alchemyMats.innerHTML =
        `材料：<b>灵草 ${inv.mat_lingcao | 0}</b> ｜ <b>玄铁矿 ${inv.mat_kuang | 0}</b> ｜ <b>妖丹 ${inv.mat_yaodan | 0}</b>` +
        ` ｜ <b>清灵草 ${inv.mat_qinglingcao | 0}</b> ｜ <b>妖兽精血 ${inv.mat_yaohu | 0}</b> ｜ <b>千年灵乳 ${inv.mat_wannianru | 0}</b>` +
        `　·　打坐偶得 + 宗门任务 / 商店 / 秘境（离线不掉）`
    }

    dom.brewNote.textContent =
      '材料齐即可开炉（一次一炉）；炼失败不白烧，收回一半材料。' +
      '标「当前所需」的是眼下卡关的那味丹。' +
      '上面开着「自动炼制」时，每种丹常备 1 枚、用掉自动补（材料不足则等有料再补）；' +
      '突破 / 渡劫时若发现缺丹，不管开关如何都会自动开炉一次。'

    const frag = document.createDocumentFragment()
    for (const r of views) {
      const row = document.createElement('div')
      row.className = 'brew-row' + (r.needed ? ' needed' : '')

      const bn = document.createElement('span')
      bn.className = 'bn'
      bn.textContent = r.name
      bn.style.color = QUALITY_COLOR[r.quality] || QUALITY_COLOR.fan   // 兜底取真源凡档（V7.2 收敛残留硬编码 hex）
      bn.title = `${r.qualityName} · 成丹率 ${Math.round(r.rate * 100)}% —— ${r.desc}`
      if (r.needed) {
        const mark = document.createElement('span')
        mark.className = 'brew-mark'
        mark.textContent = '当前所需'
        bn.appendChild(mark)
      }
      const have = document.createElement('span')
      have.className = 'brew-have'
      have.textContent = `存 ${r.have | 0}`
      have.title = `囊中现有${r.name} ${r.have | 0} 枚`
      bn.appendChild(have)

      const bi = document.createElement('span')
      bi.className = 'bi'
      // V7.3：输入材料 ＋ 产出丹药改为**图标格**（角标＝「有/需」；缺料格 data-lack=1 → 描边转警戒色）
      //   与全游物品呈现语言统一；每格的 title / 详情卡仍给全信息（含「还差 N 份」）。
      const gh = document.createElement('div')
      gh.className = 'bag-grid-host'
      buildItemGrid(gh, [
        ...r.inputsView.map((iv) => ({
          id: iv.id,
          badge: `${iv.have}/${iv.n}`,
          data: { lack: iv.enough ? '0' : '1' },
          title: iv.enough
            ? `${iv.name}：${iv.have}/${iv.n}（够）`
            : `${iv.name}：${iv.have}/${iv.n} —— 还差 ${iv.n - iv.have} 份`
        })),
        { id: r.pillId, badge: r.have, title: `产出：${r.name}（现有 ${r.have} 枚）` }
      ])
      bi.appendChild(gh)
      const rate = document.createElement('span')
      rate.className = 'rate'
      rate.textContent = `${r.qualityName} ｜ 成丹率 ${Math.round(r.rate * 100)}%`
      bi.appendChild(rate)

      const btn = document.createElement('button')
      btn.className = 'mini'
      btn.textContent = '炼制'
      btn.dataset.brew = r.id
      btn.disabled = !r.canBrew
      btn.title = r.canBrew ? `开炉炼制${r.name}（1 炉）` : `材料不足：${r.missing.join('、')}`

      row.append(bn, bi, btn)
      frag.appendChild(row)
    }
    dom.brewList.replaceChildren(frag)
    // V7.3：丹方图标格的悬停详情卡（本函数每次重绘都会被调 → 只绑一次，避免叠监听）
    if (dom.brewList.dataset && !dom.brewList.dataset.cardBound) {
      attachItemCard(dom.brewList)
      dom.brewList.dataset.cardBound = '1'
    }
  }

  // ── 界面事件绑定 ──────────────────────────────────────────────────────────

  // 坊市页签监听已随面板迁入 src/ui/MarketPanel.js（V3.5.5）
  // 丹房：自动炼制开关 / 单炉炼制（事件委托：面板每次重绘，避免丢监听）
  H.onPress(dom.alchemyOverlay, (e) => {
    const alchemy = getAlchemy()
    if (!alchemy) return
    // 自动炼制开关（面板内直观开关；与设置面板同一叶子）
    const ba = e.target.closest('[data-brew-auto]')
    if (ba) {
      if (!state.settings) state.settings = {}
      const next = state.settings.autoBrew === false
      state.settings.autoBrew = next
      H.pushLog(next
        ? '丹房自动炼制：开 —— 每种丹常备 1 枚，用掉就自动补上。'
        : '丹房自动炼制：关 —— 丹药不再自动补货，缺丹需手动开炉。', 'sys')
      H.persist('settings')
      render()
      H.render()
      return
    }
    const b = e.target.closest('[data-brew]')
    if (b && !b.disabled) {
      const res = alchemy.brew(b.dataset.brew)
      H.pushLog(res.message, res.ok && res.success ? 'ok' : 'fail')
      if (res.ok) {
        H.persist('alchemy-brew')
        render()
      }
      return
    }
    // 每行「自动炼制」按钮已撤（V4.7 主人 2026-09-18：改由上方开关常驻补货，按需开炉走「炼制」）
  })


  function open () {
    if (!state) return
    H.closeTip()
    H.closeAllOverlays('alchemy')
    render()
    H.ovShow(dom.alchemyOverlay)
    dom.btnAlchemy.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.alchemyOverlay)
    dom.btnAlchemy.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.alchemyOverlay.classList.contains('show')) close()
    else open()
  }

  return { open, close, toggle, render }
}
