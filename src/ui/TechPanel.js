/**
 * TechPanel.js —— 功法面板（#tech-overlay：已习 / 图鉴 / 装备升级 / 参悟）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   systems（tech）与装配层工具经 createTechPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（TIER_MAP ← data/techniques.js）。功法规则在 TechniqueSystem。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TIER_MAP, maxRatePct, maxCombatPct } from '../data/techniques.js'
import { WORLDS } from '../data/worlds.js'   // V6.11：图鉴按界分组，界名取卡池真源（data→data）

function tierColor (tier) {
  const m = TIER_MAP[tier]
  return m ? m.color : 'var(--ash)'
}

export function createTechPanel (ctx) {
  const dom = ctx.dom
  const state = ctx.state
  const tech = ctx.tech
  const H = ctx.helpers
  if (!dom.techOverlay) return null

  function open () {
    if (!state) return
    H.closeTip()
    H.closeAllOverlays('tech')
    render()
    H.ovShow(dom.techOverlay)
    dom.btnTech.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.techOverlay)
    dom.btnTech.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.techOverlay.classList.contains('show')) close()
    else open()
  }

/** 槽位短名（按钮文案用） */
const SLOT_LABEL = { main: '主修', side0: '辅修一', side1: '辅修二' }
let lastTechRender = 0 // 功法面板轻刷节拍（V3.5.2：时间驱动，见 PANEL_MS）
let catOpen = false    // V6.11：功法图鉴折叠状态（运行期变量，不入档；关面板不复位，玩家回来后仍是上次的样子）
const WORLD_IDS = WORLDS.map((w) => w.id)   // 图鉴分组顺序（＝卡池顺序，与 worlds.js 同源）

/** 品阶名带的颜色（品质语汇：灰→金→玉→紫→青） */


/** 主辅修徽记文案（V3.5.1 主人：一眼要分清这本功法是主修还是辅修） */
function slotKindText (slotKinds) {
  const kinds = slotKinds || []
  if (kinds.includes('main') && kinds.includes('side')) return '主辅皆可'
  if (kinds.includes('main')) return '主修'
  if (kinds.includes('side')) return '辅修'
  return '—'
}

function render () {
  if (!state || !tech) return
  const sm = tech.summary()

  // ① 槽位
  const slotFrag = document.createDocumentFragment()
  for (const s of tech.slotList()) {
    const row = document.createElement('div')
    row.className = 'slot' + (s.id ? '' : ' empty')

    const sk = document.createElement('span')
    sk.className = 'sk'
    sk.textContent = s.label

    if (!s.unlocked) {
      const sp = document.createElement('span')
      sp.className = 'sp'
      sp.textContent = `未开启 · 需 ${s.unlockName} 期`
      row.append(sk, sp)
      slotFrag.appendChild(row)
      continue
    }

    if (!s.id) {
      const sp = document.createElement('span')
      sp.className = 'sp'
      sp.textContent = s.kind === 'main' ? '空 · 从下方「已习得」中入主修' : '空 · 可从下方「已习得」中入辅修'
      row.append(sk, sp)
      slotFrag.appendChild(row)
      continue
    }

    const sn = document.createElement('span')
    sn.className = 'sn'
    sn.style.color = tierColor(s.tech.tier)
    sn.textContent = s.tech.name

    const sl = document.createElement('span')
    sl.className = 'sl'
    const tr = s.train
    const trText = tr ? (tr.maxed ? '· 圆满' : `· 参悟 ${Math.round(tr.pct * 100)}%`) : ''
    sl.textContent = `${s.level}级 修为+${(s.pct * 100).toFixed(0)}% 战力+${(s.combatPct * 100).toFixed(1)}% ${trText}`
    sl.title = tr
      ? (tr.maxed
          ? '已至圆满：修为与战力加成都吃满'
          : `长期参悟：还差约 ${H.fmtRealSpan(tr.remainSec * 1000)}（在线挂机）自行精进 1 级，不耗灵气与灵石`)
      : ''

    const sp = document.createElement('span')
    sp.className = 'sp'
    sp.textContent = s.label2

    const up = document.createElement('button')
    up.className = 'mini'
    up.dataset.up = s.id
    const info = tech.upgradeInfo(s.id)
    up.textContent = info.maxed ? '圆满' : `升级 ${H.fmt(info.cost.qi)}`
    up.title = info.maxed
      ? '已至圆满'
      : `消耗 ${H.fmt(info.cost.qi)} 灵气 + ${H.fmt(info.cost.stone)} 灵石（${info.blocker || '可升级'}）\n` +
        `升级后：修为 +${(info.nextPct * 100).toFixed(0)}%，战力 +${(info.nextCombatPct * 100).toFixed(1)}%`
    up.disabled = info.maxed || !info.affordable

    const off = document.createElement('button')
    off.className = 'mini'
    off.dataset.unequip = s.kind
    off.textContent = '卸下'

    row.append(sk, sn, sl, sp, up, off)
    slotFrag.appendChild(row)
  }
  dom.techSlots.replaceChildren(slotFrag)

  // ② 已习得
  const cat = tech.catalog()
  const ownedRows = cat.filter((c) => c.owned)
  const ownedFrag = document.createDocumentFragment()
  for (const c of ownedRows) {
    const row = document.createElement('div')
    row.className = 'tech-row'

    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.style.color = tierColor(c.tech.tier)
    tn.textContent = c.tech.name

    const tg = document.createElement('span')
    tg.className = 'tg'
    tg.textContent = `${c.tierLabel} · ${slotKindText(c.slotKinds)}`

    const tl = document.createElement('span')
    tl.className = 'tl'
    tl.textContent = `${c.level}/${c.tech.maxLevel}级`

    const tp = document.createElement('span')
    tp.className = 'tp'
    tp.textContent = `修为+${(c.pct * 100).toFixed(0)}% 战力+${(c.combatPct * 100).toFixed(1)}%`
    tp.title = c.train
      ? (c.train.maxed
          ? '已至圆满'
          : `参悟进度 ${Math.round(c.train.pct * 100)}%（还差约 ${H.fmtRealSpan(c.train.remainSec * 1000)} 自行精进，仅在线计）`)
      : ''

    const ta = document.createElement('span')
    ta.className = 'ta'
    const matchText = c.match === 'any' ? '通用' : (c.match === 'yes' ? '与灵根同源' : (c.match === 'no' ? '异于灵根' : '—'))
    ta.textContent = c.equippedLabel ? `${c.equippedLabel} · ${matchText}` : matchText

    row.append(tn, tg, tl, tp, ta)

    if (!c.equipped) {
      const kinds = c.slotKinds
      const slots = tech.slotList()
      const tryKinds = (kinds.includes('main') ? ['main'] : []).concat(kinds.includes('side') ? ['side0', 'side1'] : [])
      for (const kind of tryKinds) {
        const slot = slots.find((s) => s.kind === kind)
        const locked = !slot.unlocked
        const btn = document.createElement('button')
        btn.className = 'mini'
        btn.dataset.equip = `${c.tech.id}|${kind}`
        btn.textContent = locked ? `${SLOT_LABEL[kind]}锁` : `入${SLOT_LABEL[kind]}`
        btn.disabled = locked
        if (locked) btn.title = `${SLOT_LABEL[kind]}需 ${slot.unlockName} 期开启`
        row.appendChild(btn)
      }
    }
    ownedFrag.appendChild(row)
  }
  dom.techOwned.replaceChildren(ownedFrag)

  // ③ 功法图鉴（V6.11：**折叠头** ＋ 按「公用库 ＋ 12 界」跨世界分组）
  //   收起时不渲染（省 DOM）；展开时按分组渲染，且用 dataset.sig 做重绘短路（照项目既有 buff 条范式）
  if (dom.techCatHead) {
    dom.techCatHead.textContent = `功法图鉴 · 共 ${cat.length} 本 ${catOpen ? '▾' : '▸'}`
  }
  if (dom.techCatalog) {
    dom.techCatalog.hidden = !catOpen
    const sig = `${cat.length}|${cat.filter((x) => x.owned).length}|${catOpen}`
    if (!catOpen) {
      dom.techCatalog.replaceChildren()
      dom.techCatalog.dataset.sig = ''
    } else if (dom.techCatalog.dataset.sig !== sig) {
      dom.techCatalog.dataset.sig = sig
      const catFrag = document.createDocumentFragment()
      const groups = tech.libraryView(WORLD_IDS, (id) => {
        const w = WORLDS.find((x) => x.id === id)
        return w ? w.name : id
      })
      for (const g of groups) {
        const gh = document.createElement('div')
        gh.className = 'tech-sec'
        gh.style.margin = '6px 0 2px'
        gh.textContent = `${g.name} · ${g.total} 本（已习 ${g.owned}）`
        catFrag.appendChild(gh)

        for (const c of g.items) {
          if (c.owned) continue          // 已习得的在上一区，图鉴只做「内容预告」
          const row = document.createElement('div')
          row.className = 'tech-row locked'

          const tn = document.createElement('span')
          tn.className = 'tn'
          tn.textContent = c.top ? `${c.tech.name} ◆` : c.tech.name
          if (c.top) tn.title = '顶级灵根专属（硬门槛）'

          const tg = document.createElement('span')
          tg.className = 'tg'
          tg.textContent = `${c.tierLabel} · ${slotKindText(c.slotKinds)}`

          const ta = document.createElement('span')
          ta.className = 'ta'
          ta.textContent = c.learnBlock
            ? c.learnBlock
            : `${c.tech.source.label} · 满级 修为+${(maxRatePct(c.tech) * 100).toFixed(0)}% 战力+${(maxCombatPct(c.tech) * 100).toFixed(1)}%`

          row.append(tn, tg, ta)
          catFrag.appendChild(row)
        }
      }
      dom.techCatalog.replaceChildren(catFrag)
    }
  }

  // ④ 脚注
  if (dom.techNote) {
    dom.techNote.textContent =
      `已装备功法合计：修为 ×${(1 + sm.pct).toFixed(2)}（+${(sm.pct * 100).toFixed(0)}%），战力 +${(sm.combatPct * 100).toFixed(1)}%。` +
      `两条升级路：① 花灵气 + 灵石即刻参悟（灵气与境界推进共用同一池）；② 装备中的功法随时间自行精进（在线挂机才计，免费但更慢）。` +
      `品阶越高，每一级给的修为与战力都越多 —— 玄阶每级 +17% 修为，天阶每级 +40%。` +
      `未习得的功法见上方「功法图鉴」（点开可按「公用库 ＋ 各界」浏览全部世界的功法；他界功法可在本界奇遇中学到）`
  }
}

// 功法面板内的动作：事件委托（面板每次重绘，避免丢监听）
H.onPress(dom.techOverlay, (e) => {
  const up = e.target.closest('[data-up]')
  if (up && !up.disabled) {
    const id = up.dataset.up
    const res = tech.upgrade(id)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('technique-upgrade')
      render()
      H.render()          // 产出乘区变了 → 立即刷新面板数字
    }
    return
  }
  const eq = e.target.closest('[data-equip]')
  if (eq && !eq.disabled) {
    const [id, kind] = eq.dataset.equip.split('|')
    const res = tech.equip(id, kind)
    H.pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) {
      H.persist('technique-equip')
      render()
      H.render()
      H.emit('cult:burst', { kind: 'breakthrough' })
    }
    return
  }
  const ct = e.target.closest('[data-cat-toggle]')
  if (ct) {
    catOpen = !catOpen                 // V6.11：图鉴折叠开合（运行期变量）
    render()
    return
  }
  const un = e.target.closest('[data-unequip]')
  if (un) {
    const res = tech.unequip(un.dataset.unequip)
    H.pushLog(res.message, res.ok ? 'info' : 'info')
    if (res.ok) {
      H.persist('technique-unequip')
      render()
      H.render()
    }
  }
})

  return { open, close, toggle, render }
}
