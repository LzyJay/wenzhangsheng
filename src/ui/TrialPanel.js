/**
 * TrialPanel.js —— 渡劫面板（#trial-overlay：八关口 / 准备加成 / 静养）+ 引雷气泡「已备 +N%」
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   systems（cult / alchemy）与装配层工具经 createTrialPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（TRIBULATION ← data/realms.js）。渡劫规则在 CultivationSystem 2.5 区块。
 * 引雷主流程（onBreakthrough）留在装配层，本面板只负责「关闭自己 → 交回装配层」。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TRIBULATION } from '../data/realms.js'

export function createTrialPanel (ctx) {
  const dom = ctx.dom
  const state = ctx.state            // boot 后引用稳定（重置走整页 reload）
  const cult = ctx.cult
  const alchemy = ctx.alchemy
  const H = ctx.helpers
  if (!dom.trialOverlay) return null

  function open () {
    if (!state) return
    H.closeTip()
    H.closeAllOverlays('trial')
    render()
    H.ovShow(dom.trialOverlay)
    dom.btnTrial.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.trialOverlay)
    dom.btnTrial.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.trialOverlay.classList.contains('show')) close()
    else open()
  }

/** 该准备项所需的丹，丹房能否现炼（材料够了就允许"炼丹服下"一键走完） */
function canAutoBrew (v) {
  if (!v || !v.itemId || !alchemy) return false
  const rec = alchemy.recipeForPill(v.itemId)
  return !!(rec && alchemy.canBrew(rec.id).ok)
}

/** 引雷气泡上的「已备 +N%」——让玩家在按下引雷前最后一眼确认自己备了什么 */
function renderBubblePrep (preview) {
  const pct = (preview && preview.trial && preview.trial.preps) ? preview.trial.preps.pct : 0
  dom.bubblePrep.textContent = pct > 0 ? ` ｜ 已备 +${Math.round(pct * 100)}%` : ''
}

function render () {
  if (!state || !cult) return
  const preview = cult.getBreakthroughPreview(Date.now())
  const nodes = cult.nodesView()
  const cur = cult.trialNode
  const idx = cur >= 0 ? cur : Math.min(cult.trialCleared, nodes.length - 1)
  const node = nodes[idx]
  const preps = cult.prepSummary(idx)
  const fails = (state.trialState.consecutiveFails | 0)

  // ① 当前关口
  let head = ''
  if (preview.ascended) {
    head = '<div class="tn-name">已飞升 · 静待二期</div>' +
      `<div class="tn-line">八道天关皆已渡过，仙界之门暂封。</div>`
  } else {
    const failBonus = Math.min(fails * TRIBULATION.failBonus.per, TRIBULATION.failBonus.cap)
    const pityNext = fails + 1 >= TRIBULATION.pity.fails
    let rateLine = `<div class="tn-line">尚未行至此关：眼下是「${preview.plan.label} → ${preview.plan.targetName}」。</div>`
    if (preview.trial) {
      const t = preview.trial
      const fitPct = t.fitPct || 0
      // 裸口径 = 修为积累 + 契合（不含准备）；与最终 P 的差值拆成「准备」「契合」两段展示
      const naked = cult.getTrialChance(idx, t.fails, t.surplusBonus + fitPct)
      const mods = []
      if (preps.pct > 0) mods.push(`准备 <span class="jade">+${Math.round(preps.pct * 100)}%</span>`)
      if (fitPct !== 0) {
        mods.push(fitPct > 0
          ? `契合 <span class="jade">+${Math.round(fitPct * 100)}%</span>`
          : `契合 <span class="red">−${Math.round(-fitPct * 100)}%</span>`)
      }
      rateLine =
        `<div class="tn-line">单道天雷 <b>${(naked.p * 100).toFixed(1)}%</b>` +
        (mods.length ? ` → <b class="jade">${(t.p * 100).toFixed(1)}%</b>（${mods.join('｜')}）` : '') +
        ` ｜ 三道过二 <b>${(preview.probability * 100).toFixed(1)}%</b></div>`
    }
    head =
      `<div class="tn-name">${node.name}（第 ${node.index + 1} / ${node.total} 关${cur >= 0 ? ' · 已在关口' : ' · 尚未行至'}）</div>` +
      `<div class="tn-line">${node.fromRealm} → ${node.toRealm} ｜ 关口需求战力 <b>${H.fmt(node.trialReq)}</b>（第 ${node.index + 1} 关系数 ${node.fk}）</div>` +
      rateLine +
      `<div class="tn-line">本关战绩：<b>${node.tries}</b> 试 <b>${node.passes}</b> 成 ｜ 垫劫补正 <b>+${Math.round(failBonus * 100)}%</b>（连败 ${fails} 次${pityNext ? '，第 4 次起按保底计' : ''}）</div>` +
      `<div class="tn-desc">${node.desc}</div>`
  }
  dom.trialNode.innerHTML = head + '<div class="tr-gates" id="trial-gates"></div>'

  // ② 八关口格子
  const gateBox = document.getElementById('trial-gates')
  if (gateBox) {
    const frag = document.createDocumentFragment()
    for (const n of nodes) {
      const box = document.createElement('div')
      box.className = 'tr-gate' + (n.passed ? ' passed' : '') + (n.current ? ' cur' : '')
      const nm = document.createElement('span')
      nm.textContent = n.name.replace(/劫$/, '')
      box.appendChild(nm)
      const sub = document.createElement('i')
      sub.textContent = n.passed ? `已渡${n.passes ? '·' + n.passes + '成' : ''}` : (n.current ? '在此' : '未至')
      box.appendChild(sub)
      box.title = `第 ${n.index + 1} 关 · ${n.name}：${n.fromRealm} → ${n.toRealm}\n关口需求战力 ${H.fmt(n.trialReq)}（系数 ${n.fk}）\n战绩 ${n.tries} 试 ${n.passes} 成`
      frag.appendChild(box)
    }
    gateBox.replaceChildren(frag)
  }

  // ③ 准备项
  const fragp = document.createDocumentFragment()
  for (const v of preps.views) {
    const row = document.createElement('div')
    row.className = 'tr-row' + (v.active ? '' : (v.state === 'ready' ? '' : ' locked'))

    const pn = document.createElement('span')
    pn.className = 'pn'
    pn.textContent = v.name
    pn.title = `${v.from}`

    const pd = document.createElement('span')
    pd.className = 'pd'
    pd.textContent = v.message + (v.active ? '' : `　${v.note}`)

    const pb = document.createElement('span')
    pb.className = 'pb'
    pb.textContent = `+${Math.round(v.bonusPct * 100)}%`

    const btn = document.createElement('button')
    btn.className = 'mini' + (v.active ? ' on' : '')
    const lacked = v.kind === 'consume' && v.state === 'lack' && canAutoBrew(v)
    if (v.active) {
      btn.textContent = '已备'
      btn.disabled = true
      btn.title = '这一回天雷已经带上它了'
    } else if (cur >= 0 && (v.state === 'ready' || lacked)) {
      btn.textContent = lacked
        ? '炼 丹 服 下'
        : (v.kind === 'consume' ? '服下' : (v.kind === 'contrib' ? '请援' : '备妥'))
      btn.dataset.prep = v.id
      btn.title = lacked
        ? '囊中无此丹、但材料充足：点一下即由丹房自动开炉，炼成随即服下'
        : (v.kind === 'consume' ? '服下即刻生效；成败皆不退还' : '花贡献请同门结阵护法')
    } else {
      btn.textContent = '—'
      btn.disabled = true
      btn.title = cur >= 0 ? v.note : '需站在第九重关口上才可准备'
    }

    row.append(pn, pd, pb, btn)
    fragp.appendChild(row)
  }
  dom.trialPreps.replaceChildren(fragp)

  // ④ 静养按钮（有道伤才出现）
  const ds = state.buffs.find((b) => b.id === TRIBULATION.daoShang.id)
  dom.btnTrialCure.hidden = !ds
  if (ds) {
    const cost = cult.cureCost()
    const lack = (state.resources.stones | 0) < cost
    dom.btnTrialCure.textContent = `静养疗伤 · ${cost} 灵石`
    dom.btnTrialCure.disabled = lack
    dom.btnTrialCure.title = lack
      ? `灵石不足（需 ${cost}）`
      : `道伤：产出 −30%，剩余 ${H.fmtDuration(ds.endsAt - Date.now())}；花 ${cost} 灵石静养即可尽去`
  }

  // 前往引雷：条件不足时说清楚缺什么
  const goBtn = dom.btnTrialGo
  goBtn.disabled = !preview.ready
  goBtn.title = preview.ready
    ? '关闭本面板，去主界面引雷（三道天雷 · 过二即成）'
    : `尚不可冲击：${preview.blocked || '条件不足'}`

  const capPct = Math.round(preps.cap * 100)
  dom.trialNote.textContent =
    `八道天关（炼气→筑基 · … · 大乘→飞升）每境第九重开启；三道天雷过二即成，` +
    `准备加成合计上限 +${capPct}%（破例项见 item 表：护劫丹 +10% · 镇雷法宝 +8% · 灵兽助战 +7% · 道行天赋 +5% · 宗门援助 +5%）。` +
    `准备只对这一回天雷负责：引雷之后不论成败，服下的丹与请来的援都不留存。渡劫失败损失 30% 修为并落下道伤（可静养或等待消散），不掉级、不遗失宝物。`
}

// 渡劫面板交互（事件委托：面板每次重绘，避免丢监听）
dom.trialPreps.addEventListener('click', (e) => {
  const b = e.target.closest('[data-prep]')
  if (!b || b.disabled) return
  let res = cult.prepare(b.dataset.prep)
  // 护劫丹见底而材料充足 → 丹房自动开炉，炼成随即服下（主人 2026-09-17 口径）
  if (!res.ok) {
    const v = cult.prepViews().find((x) => x.id === b.dataset.prep)
    if (v && v.itemId && /囊中没有/.test(res.message || '')) {
      const ab = alchemy.autoBrewFor(v.itemId)
      if (ab.attempts > 0) {
        H.pushLog(ab.message, ab.success ? 'ok' : 'fail')
        H.persist('alchemy-autobrew')
        if (ab.success) res = cult.prepare(b.dataset.prep)
      }
    }
  }
  H.pushLog(res.message, res.ok ? 'ok' : 'info')
  if (res.ok) {
    H.persist('trial-prep')
    render()
    H.render()
  }
})

dom.btnTrialCure.addEventListener('click', () => {
  const res = cult.cureDaoShang(Date.now())
  H.pushLog(res.message, res.ok ? 'ok' : 'info')
  if (res.ok) {
    H.persist('trial-cure')
    render()
    H.render()
  }
})

dom.btnTrialGo.addEventListener('click', () => {
  close()
  H.onBreakthrough()
})

  return { open, close, toggle, render, renderBubblePrep }
}
