/**
 * BeastPanel.js —— 灵兽面板（#beast-overlay：万兽林派遣 / 孵化 / 灵兽园喂养出战）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.5 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   systems（beasts）与装配层工具经 createBeastPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（当前无）。业务规则在 BeastSystem + data/beasts.js，此处只接线。
 * 渡劫助战 / 宗门战力加成不在此接：经 boot 注入由 CultivationSystem / SectSystem 自取。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export function createBeastPanel (ctx) {
  const dom = ctx.dom
  const getState = ctx.state
  const getSystem = ctx.system
  const H = ctx.helpers
  if (!dom.beastOverlay) return null

let lastBeastRender = 0 // 灵兽面板轻刷节拍（V3.5.2：时间驱动，倒计时跟拍）

  function open () {
    if (!getState()) return
    H.closeTip()
    H.closeAllOverlays('beast')
    render()
    H.ovShow(dom.beastOverlay)
    dom.btnBeast.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.beastOverlay)
    dom.btnBeast.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.beastOverlay.classList.contains('show')) close()
    else open()
  }

  function render () {
    const system = getSystem()
    if (!getState() || !system) return
    const now = Date.now()
    const ov = system.overviewView(now)

  // ① 园况总览（主人 2026-09-18：文字精简，细则移进关键名词的悬停说明）
  if (!ov.unlocked && !ov.pets) {
    dom.beastInfo.innerHTML =
      '<div class="si-name">灵兽 · 尚未开园</div>' +
      '<div class="si-line">金丹期方可入万兽林寻蛋。</div>'
  } else {
    dom.beastInfo.innerHTML =
      `<div class="si-name">灵兽园 ${ov.pets}/${ov.parkCap}${ov.eggs ? ` · 蛋 ${ov.eggs}` : ''}</div>` +
      `<div class="si-line">出战：${ov.activeName ? `<b>${ov.activeName}</b>` : '<span style="color:#8f877c">空缺</span>'}` +
      `　产出：${ov.productionHours > 0 ? `<span class="jade" title="被动产出＝基准产出 × 0.2 时/日 × 品级系数 × 等级系数（上限 0.6 时/日），随在线秒入账，离线不发">+${H.fmt(ov.productionPerDay)}/日</span>` : '—'}` +
      `　战力 <span title="出战灵兽战力 +4%（皇品 +8%），计入宗门战力任务定标与秘境门槛">+${Math.round(ov.powerBonusPct * 100)}%</span>` +
      `　渡劫 <span title="渡劫时出战灵兽替你挡一线雷威：单道天雷通过率 +7%（持有即生效，不必另备）">+${Math.round(ov.trialAidPct * 100)}%</span></div>`
  }

  // ② 万兽林派遣
  if (!ov.unlocked) {
    dom.beastDispatch.innerHTML = '<div class="bag-empty">金丹期解锁</div>'
  } else {
    const dv = system.dispatchView(now)
    const autoEggOn = getState().settings.autoEgg !== false
    const row = document.createElement('div')
    row.className = 'sect-row'
    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.textContent = '灵鹰寻蛋'
    const td = document.createElement('span')
    td.className = 'td'
    td.textContent = `每轮 1 次 · 去 ${H.fmtGameDuration(dv.hours * 3600 * 1000)}`
    td.title = `灵鹰入林一次带回一枚灵兽蛋，品级概率：凡 70% ｜ 灵 22% ｜ 王 7% ｜ 皇 1%\n` +
      `一轮＝${H.fmtRefreshPeriod()}（距下一轮 ${H.fmtGameDuration(H.msToNextRefresh(now))}）` +
      `${autoEggOn ? '\n已开「自动寻蛋」：灵鹰得空即入林，归巢自动收蛋（孵化与破壳仍由你决定）' : '\n当前为手动派遣（设置面板可开「自动寻蛋」）'}`
    const tp = document.createElement('span')
    tp.className = 'tp' + (dv.running && !dv.done ? ' dim' : '')
    tp.textContent = dv.collected ? '已归巢' : (dv.running ? `还差 ${dv.leftText}` : '待派遣')
    const btn = document.createElement('button')
    btn.className = 'mini gap'
    if (dv.collected) {
      btn.textContent = '领蛋'
      btn.dataset.dispatchCollect = '1'
    } else if (dv.running) {
      btn.textContent = '搜寻中'
      btn.disabled = true
    } else {
      btn.textContent = '派遣'
      btn.dataset.dispatch = '1'
    }
    row.append(tn, td, tp, btn)
    dom.beastDispatch.replaceChildren(row)
  }

  // ③ 蛋与孵化位（单孵位：同时只孵一枚）
  const eggs = system.eggsView(now)
  if (!eggs.length) {
    dom.beastEggs.innerHTML = '<div class="bag-empty">笼中无蛋 · 先派灵鹰入万兽林</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of eggs) {
      const row = document.createElement('div')
      row.className = 'sect-row'

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = `${e.gradeName}蛋`
      tn.style.color = e.color
      tn.title = `${e.gradeName}灵兽蛋 · 孵期 ${H.fmtGameDuration(e.hatchHours * 3600 * 1000)}（游戏历），1 枚妖丹可催短 ${H.fmtGameDuration(3600 * 1000)}`

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = e.hatching
        ? `${Math.round(e.pct * 100)}% · 孵期 ${H.fmtGameDuration(e.hatchHours * 3600 * 1000)}`
        : `待入孵 · ${H.fmtGameDuration(e.hatchHours * 3600 * 1000)}`

      const tp = document.createElement('span')
      tp.className = 'tp' + (e.hatching && !e.done ? ' dim' : '')
      tp.textContent = e.hatching ? (e.done ? '可破壳' : `还差 ${e.leftText}`) : '—'

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      if (e.hatching && e.done) {
        btn.textContent = '破壳'
        btn.dataset.hatchClaim = '1'
      } else if (e.hatching) {
        btn.textContent = '催孵'
        btn.dataset.hatchSpeed = '1'
        btn.title = `消耗 1 枚妖丹，孵期缩短 ${H.fmtGameDuration(3600 * 1000)}（游戏历）`
      } else if (e.isSlot === false && eggs.some((x) => x.hatching)) {
        btn.textContent = '排队'
        btn.disabled = true
        btn.title = '孵化位只有一个，先孵完这枚'
      } else {
        btn.textContent = '入孵'
        btn.dataset.hatch = e.uid
      }
      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.beastEggs.replaceChildren(frag)
  }

  // ④ 灵兽园（一兽一行：名字 + 等级 + 状态，细则进悬停）
  const pets = system.petsView()
  if (!pets.length) {
    dom.beastPark.innerHTML = '<div class="bag-empty">园中空空 · 灵兽破壳后在此安家</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const p of pets) {
      const row = document.createElement('div')
      row.className = 'sect-row'

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = p.name
      tn.style.color = p.color
      tn.title = `${p.gradeName}「${p.name}」${p.desc ? `\n${p.desc}` : ''}\n品级系数 ×${p.grade === 'huang' ? '2.0' : p.grade === 'wang' ? '1.5' : p.grade === 'ling' ? '1.2' : '1.0'}`

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = p.level >= 9
        ? `${p.gradeName} · Lv.${p.level}/9 · 圆满`
        : `${p.gradeName} · Lv.${p.level}/9 · 成长 ${Math.round(p.growPct * 100)}%`
      td.title = `等级系数 ×${p.levelCoef.toFixed(1)}（每级 +10%）· 产出 ${p.outputHours.toFixed(1)} 时/日 · 战力 +${Math.round(p.powerPct * 100)}%\n` +
        `${p.growText} · 在线挂机自动累积\n喂养消耗 1 枚妖丹升 1 级（快路），8% 概率悟性爆发连升 2 级`

      const tp = document.createElement('span')
      tp.className = 'tp' + (p.active ? '' : ' dim')
      tp.textContent = p.active ? '出战中' : '待命'

      const feedBtn = document.createElement('button')
      feedBtn.className = 'mini'
      feedBtn.textContent = p.level >= 9 ? '圆满' : '喂养'
      feedBtn.title = p.level >= 9 ? '已至 9 级圆满' : '消耗 1 枚妖丹升 1 级（8% 悟性爆发连升 2 级）'
      feedBtn.disabled = p.level >= 9
      feedBtn.dataset.feed = p.uid

      const actBtn = document.createElement('button')
      actBtn.className = 'mini gap'
      if (p.active) { actBtn.textContent = '—'; actBtn.disabled = true }
      else { actBtn.textContent = '出战'; actBtn.dataset.active = p.uid }

      row.append(tn, td, tp, feedBtn, actBtn)
      frag.appendChild(row)
    }
    dom.beastPark.replaceChildren(frag)
  }

  // ⑤ 脚注（只留一句口径；细则都在上面的悬停说明里）
  if (dom.beastNote) {
    dom.beastNote.textContent = ov.unlocked
      ? '出战 1 只即生效（元婴起 2 只随内容批次 2 开放）；被动产出随在线秒入账、离线不发，上限 0.6 时/日。血脉觉醒 / 化形 / 代采随内容批次 2、3 开放。'
      : '金丹期解锁万兽林；血脉觉醒 / 化形 / 灵兽园扩容 / 代采随内容批次 2、3 开放。'
  }
}

// 灵兽面板动作（事件委托：面板每次重绘不丢监听）
dom.beastOverlay.addEventListener('click', (e) => {
  const dp = e.target.closest('[data-dispatch]')
  if (dp && !dp.disabled) {
    const res = system.dispatch()
    H.pushLog(res.message, res.ok ? 'info' : 'info')
    render()
    return
  }
  const dc = e.target.closest('[data-dispatch-collect]')
  if (dc && !dc.disabled) {
    const res = system.collectDispatch()
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { H.persist('beast-egg'); H.emitFloat({ text: `${res.grade === 'huang' ? '皇品蛋！' : '灵兽蛋 +1'}`, kind: 'ok' }) }
    render()
    return
  }
  const h = e.target.closest('[data-hatch]')
  if (h && !h.disabled) {
    const res = system.startHatch(+h.dataset.hatch)
    H.pushLog(res.message, res.ok ? 'info' : 'info')
    render()
    return
  }
  const hs = e.target.closest('[data-hatch-speed]')
  if (hs && !hs.disabled) {
    const res = system.speedHatch(1)
    H.pushLog(res.message, res.ok ? 'info' : 'info')
    if (res.ok) H.persist('beast-hatch-speed')
    render()
    return
  }
  const hc = e.target.closest('[data-hatch-claim]')
  if (hc && !hc.disabled) {
    const res = system.claimHatch()
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.sfx('beast_hatch', { throttleMs: 400 })   // 3.5 音效：灵兽破壳
      H.persist('beast-hatch')
      H.emitBurst({ kind: 'breakthrough' })
    }
    render()
    return
  }
  const fd = e.target.closest('[data-feed]')
  if (fd && !fd.disabled) {
    const res = system.feed(+fd.dataset.feed)
    H.pushLog(res.message, res.ok ? (res.burst ? 'ok' : 'info') : 'info')
    if (res.ok) H.persist('beast-feed')
    render()
    return
  }
  const ac = e.target.closest('[data-active]')
  if (ac && !ac.disabled) {
    const res = system.setActive(+ac.dataset.active)
    H.pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) H.persist('beast-active')
    render()
  }
})

  return { open, close, toggle, render }
}
