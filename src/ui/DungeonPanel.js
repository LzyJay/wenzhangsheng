/**
 * DungeonPanel.js —— 秘境面板（#dungeon-overlay：试炼塔 / 资源秘境派遣 / 分身召回）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.5 拆分 main.js 第三批）：只碰本面板自己的 DOM；
 *   systems（dungeon）与装配层工具经 createDungeonPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（当前无）。业务规则在 DungeonSystem + data/dungeon.js，此处只接线。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export function createDungeonPanel (ctx) {
  const dom = ctx.dom
  const getState = ctx.state
  const getSystem = ctx.system
  const H = ctx.helpers
  if (!dom.dungeonOverlay) return null

// ══ 2.7 秘境 装配区（改动仅限本区块 + 各互斥开关联动行 + 主循环一行）═════════
// 接线内容：秘境遮罩（#dungeon-overlay）· 试炼塔挑战 · 资源秘境首通/派遣 ·
//           分身召回 · 主循环到期结算（真实时间驱动，离线照算）· 周扫荡

let lastDungeonRender = 0 // 秘境面板轻刷节拍（V3.5.2：时间驱动，倒计时跟拍）

  function open () {
    if (!getState()) return
    H.closeTip()
    H.closeAllOverlays('dungeon')
    render()
    H.ovShow(dom.dungeonOverlay)
    dom.btnDungeon.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.dungeonOverlay)
    dom.btnDungeon.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.dungeonOverlay.classList.contains('show')) close()
    else open()
  }

  function render () {
    const system = getSystem()
    if (!getState() || !system) return
    const now = Date.now()

  // ① 试炼塔（首通 + 里程碑的奖励内容都写出来）
  const tv = system.towerView()
  let towerHtml
  if (tv.next) {
    const n = tv.next
    towerHtml =
      `<div class="dungeon-row">` +
      `<span class="dn">试炼塔</span>` +
      `<span class="dd">已通 <b>${tv.cleared}</b> / ${tv.floors} 层　当前战力 <b>${H.fmt(tv.power)}</b></span>` +
      `<span class="ds">周扫荡 <b>+${H.fmt(tv.weekly.stones)}</b> 灵石<br>还差 ${H.fmtGameDuration(tv.weekly.nextInMs)}</span>` +
      `</div>` +
      `<div class="dungeon-row">` +
      `<span class="dn">第 ${n.floor} 层</span>` +
      `<span class="dd">推荐战力 <b>${H.fmt(n.needPower)}</b>　首通奖励：灵石 <b>+${H.fmt(n.stones)}</b>` +
      (n.milestone ? `　里程碑：<b>${n.milestone}</b>（折算灵石 +${H.fmt(n.milestoneStones)}）` : '') +
      `</span>` +
      `<div class="dbtns"><button class="d-btn" data-tower-challenge${n.canChallenge ? '' : ' disabled'}>${n.canChallenge ? '挑 战' : '战力不足'}</button></div>` +
      `</div>`
  } else {
    towerHtml =
      `<div class="dungeon-row"><span class="dn">试炼塔</span><span class="dd">已通满 <b>${tv.floors}</b> 层，更高层随版本开放</span>` +
      `<span class="ds">周扫荡 <b>+${H.fmt(tv.weekly.stones)}</b> 灵石<br>还差 ${H.fmtGameDuration(tv.weekly.nextInMs)}</span></div>`
  }
  dom.dungeonTower.innerHTML = towerHtml

  // ② 资源秘境（首通/派遣的奖励内容逐项标注）
  const resFrag = document.createDocumentFragment()
  for (const r of system.resourceView()) {
    const row = document.createElement('div')
    row.className = 'dungeon-row' + (r.unlocked ? '' : ' locked')
    const dn = document.createElement('span')
    dn.className = 'dn'
    dn.textContent = r.name
    const dd = document.createElement('span')
    dd.className = 'dd'
    if (!r.unlocked) {
      dd.textContent = `需 ${r.unlockRealmName}期开放`
    } else if (r.cleared >= 4) {
      dd.innerHTML = `已通满 4 层 · 派遣收益 <b>+${r.stars * 10}%</b>（★${r.stars}）　材料：<b>${r.materialName}</b>`
    } else {
      // 主人 2026-09-18：只标基础奖励（首通给什么），不再替玩家逐档算派遣收益
      const techLine = r.techId
        ? ` · 功法《${(getTechnique(r.techId) || {}).name || r.techId}》`
        : ''
      dd.innerHTML = `已通 ${r.cleared}/4 层 ｜ 主题：${r.theme}<br>` +
        `首通${r.nextName}（需战力 <b>${H.fmt(r.nextPower)}</b>）：灵石 <b>+${H.fmt(r.nextStones)}</b> · ${r.materialName} <b>+${r.nextMats}</b>${techLine}`
    }
    if (r.surprise) {
      const sup = document.createElement('div')
      sup.textContent = '此境最不可测：派遣归来或有〔机缘〕（遗藏 / 残卷），也可能〔触动禁制〕（所获寥寥）'
      sup.style.color = 'rgba(185,140,255,0.85)'
      dd.appendChild(sup)
    }
    if (r.canDispatch) {
      // 基础收益/小时（时长自选，具体数字不再逐档罗列）
      const line = document.createElement('div')
      const b = r.dispatchBase
      line.textContent =
        `派遣基础（${b.depthName}·★${b.stars}）：灵石 +${H.fmt(b.stonesPerHour)}/小时 · ${b.matName} +${b.matsPerHour}/小时` +
        `　·　每趟 ${Math.round(r.techDropPct * 100)}% 拾得功法残卷`
      line.style.color = 'rgba(127,214,168,0.85)'
      dd.appendChild(line)
    }
    const dbtns = document.createElement('div')
    dbtns.className = 'dbtns'
    if (r.unlocked && r.cleared < 4) {
      const btn = document.createElement('button')
      btn.className = 'd-btn'
      btn.textContent = '首 通'
      btn.dataset.resChallenge = `${r.id}|${r.nextDepth}`
      btn.disabled = !r.canChallenge
      btn.title = `首通奖励：灵石 +${H.fmt(r.nextStones)}、${r.materialName} +${r.nextMats}（按战力溢出评 1~3 星，星级永久提高派遣收益）`
      dbtns.appendChild(btn)
    }
    if (r.canDispatch) {
      for (const o of r.dispatchOptions) {
        const b = document.createElement('button')
        b.className = 'd-btn'
        b.textContent = `派${o.hours}h`
        b.dataset.resDispatch = `${r.id}|${r.cleared}|${o.hours}`
        b.title = `派分身驻留 ${H.fmtGameDuration(o.hours * 3600 * 1000)}（游戏历）：预计灵石 +${H.fmt(o.stones)}、${o.matName} +${o.mats}（离线照算 · 自动续派）`
        dbtns.appendChild(b)
      }
    }
    row.append(dn, dd, dbtns)
    resFrag.appendChild(row)
  }
  dom.dungeonRes.replaceChildren(resFrag)

  // ③ 分身派遣（槽位随大境界递增，阶梯写清楚）
  const dv = system.dispatchView(now)
  const dispatchFrag = document.createDocumentFragment()
  const head = document.createElement('div')
  head.className = 'dungeon-row'
  head.innerHTML = `<span class="dn">分身槽</span><span class="dd">${dv.slots === 0 ? '金丹期解锁第一具分身' : `已用 <b>${dv.used}</b> / <b>${dv.slots}</b> 槽`}</span><span class="ds dim">离线照算 · 自动续派</span>`
  dispatchFrag.appendChild(head)

  const ladder = document.createElement('div')
  ladder.className = 'dungeon-row'
  ladder.innerHTML = '<span class="dn">槽位阶梯</span><span class="dd">' +
    dv.ladder.map((k) => `${k.current ? '<b>' : ''}${k.realmName} ${k.slots} 槽${k.current ? '</b>' : ''}`).join(' → ') +
    '　（每晋一大境界 +1 具，合体 5 槽封顶）</span>'
  dispatchFrag.appendChild(ladder)

  if (!dv.runs.length) {
    const empty = document.createElement('div')
    empty.className = 'bag-empty'
    empty.textContent = dv.slots === 0 ? '金丹期方得第一具分身' : '尚无分身驻留 · 到「资源秘境」选秘境派出一具'
    dispatchFrag.appendChild(empty)
  }
  for (const run of dv.runs) {
    const row = document.createElement('div')
    row.className = 'dungeon-row'
    const dn = document.createElement('span')
    dn.className = 'dn'
    dn.textContent = run.dungeonName
    const dd = document.createElement('span')
    dd.className = 'dd'
    dd.textContent = `${run.depthName} · ${run.hours}h · ★${run.stars} · 每趟结算：灵石 +${H.fmt(run.stones)}、${run.matName} +${run.mats}`
    const ds = document.createElement('span')
    ds.className = 'ds'
    ds.textContent = run.done ? '结算中…' : `还差 ${fmtHoursLeft(run.remainingMs)}`
    const btn = document.createElement('button')
    btn.className = 'd-btn'
    btn.textContent = '召回'
    btn.dataset.recall = run.index
    row.append(dn, dd, ds, btn)
    dispatchFrag.appendChild(row)
  }
  dom.dungeonDispatch.replaceChildren(dispatchFrag)

  if (dom.dungeonNote) {
    dom.dungeonNote.textContent =
      '秘境线以灵石、主题材料与功法残卷结算（不发境界）；当量 h 按灵石时薪折算，与随机事件同口径。' +
      '首通某层必得该档功法一本（已收满则折灵石），派遣每趟另有概率拾得残卷；' +
      '派遣收益随首通评星永久 +10%/星，周扫荡每周一自动入账；界面倒计时按游戏历显示（现实 2 小时 = 游戏 30 天）。'
  }
}

// 秘境面板动作（事件委托：面板每次重绘不丢监听）
H.onPress(dom.dungeonOverlay, (e) => {
  const tc = e.target.closest('[data-tower-challenge]')
  if (tc && !tc.disabled) {
    const res = system.challengeTower()
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('dungeon-tower')
      H.emitBurst({ kind: 'breakthrough' })
      H.emitFloat({ text: `试炼塔第 ${res.floor} 层`, kind: 'info' })
    }
    render()
    return
  }
  const rc = e.target.closest('[data-res-challenge]')
  if (rc && !rc.disabled) {
    const [id, depth] = rc.dataset.resChallenge.split('|')
    const res = system.challengeResource(id, +depth)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('dungeon-res')
      H.emitBurst({ kind: 'breakthrough' })
      H.emitFloat({ text: `首通 ${res.system.name} · ${res.stars} 星`, kind: 'ok' })
      if (res.techName) H.emitFloat({ text: `得功法《${res.techName}》`, kind: 'root' }, 260)
    }
    render()
    return
  }
  const rd = e.target.closest('[data-res-dispatch]')
  if (rd && !rd.disabled) {
    const [id, depth, hours] = rd.dataset.resDispatch.split('|')
    const res = system.dispatch(id, +depth, +hours)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('dungeon-dispatch')
      H.emitFloat({ text: `分身驻留 ${res.dungeonName || ''}`, kind: 'info' })
    }
    render()
    return
  }
  const rcl = e.target.closest('[data-recall]')
  if (rcl && !rcl.disabled) {
    const res = system.recall(+rcl.dataset.recall)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.sfx('dungeon_clear', { throttleMs: 400 })   // 3.5 音效：分身召回结算
      H.persist('dungeon-recall')
      if (res.stones > 0) H.emitFloat({ text: `召回 +${H.fmt(res.stones)} 灵石`, kind: 'info' })
      if (res.techName) H.emitFloat({ text: `残卷《${res.techName}》`, kind: 'root' }, 260)
    }
    render()
  }
})

  return { open, close, toggle, render }
}
