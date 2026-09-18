/**
 * DungeonPanel.js —— 秘境面板（#dungeon-overlay：试炼塔 / 资源秘境 / 招牌秘境 / 积分商店 / 分身派遣）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.5 拆分 main.js 第三批）：只碰本面板自己的 DOM；
 *   systems（dungeon）与装配层工具经 createDungeonPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（当前无）。业务规则在 DungeonSystem + data/dungeon.js，此处只接线。
 *
 * V5.1 增补（招牌秘境 · 内容批次 3 世界篇首步）：
 *   · #dungeon-sig  招牌秘境：三态标签（本源 / 游历 / 他界）+ 首通 / 每轮探取 + 当周限时秘境
 *   · #dungeon-shop 秘境积分商店：余额 + 货架（只卖现有物品；积分→物品是转换，不入归因）
 *   · 点击产出的灵石增量经 helpers.noteDungeon 回传装配层，落 §七 归因的 dungeon 线
 *   · Rule A/B 照旧：面板顶不直取 system 实例；委托回调内自行 getSystem()
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getTechnique } from '../data/techniques.js'   // 纯数据访问器（ui 层允许 import data/）

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
      `<div class="dungeon-row"><span class="dn">试炼塔</span><span class="dd">已通满 <b>${tv.floors}</b> 层，更高层随后续版本开放</span>` +
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

  // ③ 招牌秘境（V5.1 · 12 界洞天：三态标签 + 首通/周期 + 当周限时秘境）
  const sv = system.signatureView(now)
  const sigFrag = document.createDocumentFragment()
  const sigHead = document.createElement('div')
  sigHead.className = 'dungeon-row'
  sigHead.innerHTML = `<span class="dn">秘境积分</span><span class="dd">余额 <b>${H.fmt(sv.points)}</b>　` +
    `（试炼塔 30 层里程碑 / 招牌首通 / 每轮探取 / 限时秘境产出）</span>` +
    `<span class="ds">本轮还差 ${H.fmtGameDuration(sv.cycleInMs)}</span>`
  sigFrag.appendChild(sigHead)

  const wk = sv.weekly
  const wkRow = document.createElement('div')
  wkRow.className = 'dungeon-row' + (wk.unlocked ? '' : ' locked')
  wkRow.innerHTML = `<span class="dn">限时秘境</span><span class="dd">当周：<b>${wk.name}</b>（${wk.stateName}）　产出 ×${wk.mul}<br>` +
    `探一次：灵石 <b>+${H.fmt(wk.stones)}</b> · ${wk.matName} <b>+${wk.mats}</b> · 积分 <b>+${wk.points}</b>　` +
    `<span style="color:rgba(185,140,255,0.85)">当周限定 · 过期作废不可补打</span></span>` +
    `<span class="ds">${wk.done ? '本周已探' : `还差 ${H.fmtGameDuration(wk.nextInMs)}`}</span>` +
    `<div class="dbtns"><button class="d-btn" data-sig-weekly${(!wk.unlocked || wk.done) ? ' disabled' : ''}>` +
    `${wk.done ? '已探过' : (wk.unlocked ? '探 秘' : `需${wk.unlockRealmName}期`)}</button></div>`
  sigFrag.appendChild(wkRow)

  for (const r of sv.rows) {
    const row = document.createElement('div')
    row.className = 'dungeon-row' + (r.unlocked ? '' : ' locked')
    const dn = document.createElement('span')
    dn.className = 'dn'
    dn.textContent = r.name
    const dd = document.createElement('span')
    dd.className = 'dd'
    dd.innerHTML = `<b>${r.stateName}</b>（产出 ${r.mulPct}%）｜主题：${r.theme}<br>` +
      (r.first
        ? `首通已过 ｜ 每轮：灵石 <b>+${H.fmt(r.cycleStones)}</b> · ${r.materialName} <b>+${r.cycleMats}</b>`
        : `首通（需 ${r.unlockRealmName}期）：灵石 <b>+${H.fmt(r.firstStones)}</b> · ${r.materialName} <b>+${r.firstMats}</b><br>` +
          `此后每轮：灵石 +${H.fmt(r.cycleStones)} · ${r.materialName} +${r.cycleMats}`)
    const dbtns = document.createElement('div')
    dbtns.className = 'dbtns'
    if (!r.first) {
      const b = document.createElement('button')
      b.className = 'd-btn'
      b.textContent = '首 通'
      b.dataset.sigFirst = r.id
      b.disabled = !r.unlocked
      b.title = `${r.desc}　（${r.stateName} · 产出 ${r.mulPct}%）`
      dbtns.appendChild(b)
    } else {
      const b = document.createElement('button')
      b.className = 'd-btn'
      b.textContent = '本轮探取'
      b.dataset.sigCycle = r.id
      b.disabled = !r.cycleReady
      b.title = r.cycleReady ? '本轮尚可探取一次' : `本轮已探过，${H.fmtGameDuration(r.cycleInMs)}后再来`
      dbtns.appendChild(b)
    }
    row.append(dn, dd, dbtns)
    sigFrag.appendChild(row)
  }
  dom.dungeonSig.replaceChildren(sigFrag)

  // ④ 秘境积分商店（V5.1：只卖现有物品；积分只从秘境线来）
  const shopFrag = document.createDocumentFragment()
  const shopHead = document.createElement('div')
  shopHead.className = 'dungeon-row'
  shopHead.innerHTML = `<span class="dn">积分余额</span><span class="dd"><b>${H.fmt(sv.points)}</b>　` +
    `（招牌首通 +30/条 · 每轮探取 +5/次 · 限时秘境 +20/次 · 试炼塔 30 层 +100）</span>`
  shopFrag.appendChild(shopHead)
  for (const it of sv.shop) {
    const row = document.createElement('div')
    row.className = 'dungeon-row' + (it.affordable ? '' : ' locked')
    const dn = document.createElement('span')
    dn.className = 'dn'
    dn.textContent = it.name
    const dd = document.createElement('span')
    dd.className = 'dd'
    dd.innerHTML = `价 <b>${it.cost}</b> 积分`
    const dbtns = document.createElement('div')
    dbtns.className = 'dbtns'
    const b = document.createElement('button')
    b.className = 'd-btn'
    b.textContent = '兑 换'
    b.dataset.shopBuy = it.id
    b.disabled = !it.affordable
    b.title = `秘境积分 −${it.cost}，得${it.itemName} ×${it.n}`
    dbtns.appendChild(b)
    row.append(dn, dd, dbtns)
    shopFrag.appendChild(row)
  }
  dom.dungeonShop.replaceChildren(shopFrag)

  // ⑤ 分身派遣（槽位随大境界递增，阶梯写清楚）
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
    ds.textContent = run.done ? '结算中…' : `还差 ${H.fmtHoursLeft(run.remainingMs)}`
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
      '派遣收益随首通评星永久 +10%/星，周扫荡每周一自动入账。' +
      '招牌秘境（V5.1）：本源洞天产出全额且门槛提前 1 大境界，他界与游历洞天六折；' +
      '每轮 30 游戏天可再探一次，每周另有当局限时秘境（产出 ×1.5，过期作废不可补打）；' +
      '秘境积分只在秘境线挣、只能在积分商店花。界面倒计时一律按游戏历显示（现实 1 分钟 = 游戏 1 天）。'
  }
}

// 秘境面板动作（事件委托：面板每次重绘不丢监听）
H.onPress(dom.dungeonOverlay, (e) => {
  // 系统实例必须在回调内取：render() 里的 system 是局部变量，回调作用域链上没有它。
  // （V3.5.5 拆分遗留：引用了裸标识符 → 每次点击抛 ReferenceError，四个按钮全哑；
  //   烟测只断言遮罩开合、不点面板内按钮，故一直没暴露。V4.7 批 0 修复）
  const system = getSystem()
  if (!system) return
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
      const dg = res.dungeon || {}
      H.emitFloat({ text: `首通 ${dg.name} · ${res.stars} 星`, kind: 'ok' })
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
  // V5.1 招牌秘境：首通 / 每轮探取 / 当周限时（三条都回传灵石增量给 dungeon 归因线）
  const sf = e.target.closest('[data-sig-first]')
  if (sf && !sf.disabled) {
    const st = getState()
    const before = (st.resources.stones | 0)
    const res = system.signatureFirstClear(sf.dataset.sigFirst)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      if (H.noteDungeon) H.noteDungeon({ stones: (st.resources.stones | 0) - before })
      H.sfx('dungeon_clear', { throttleMs: 400 })
      H.persist('dungeon-sig-first')
      H.emitBurst({ kind: 'breakthrough' })
      const dg = res.dungeon || {}
      H.emitFloat({ text: `首通 ${dg.name}`, kind: 'ok' })
      if (res.mats > 0) H.emitFloat({ text: `${res.matName} +${res.mats}`, kind: 'info' }, 260)
    }
    render()
    return
  }
  const sc = e.target.closest('[data-sig-cycle]')
  if (sc && !sc.disabled) {
    const st = getState()
    const before = (st.resources.stones | 0)
    const res = system.signatureCycle(sc.dataset.sigCycle)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      if (H.noteDungeon) H.noteDungeon({ stones: (st.resources.stones | 0) - before })
      H.persist('dungeon-sig-cycle')
      const dg = res.dungeon || {}
      H.emitFloat({ text: `${dg.name} +${H.fmt(res.stones)} 灵石`, kind: 'info' })
    }
    render()
    return
  }
  const sw = e.target.closest('[data-sig-weekly]')
  if (sw && !sw.disabled) {
    const st = getState()
    const before = (st.resources.stones | 0)
    const res = system.signatureWeekly()
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      if (H.noteDungeon) H.noteDungeon({ stones: (st.resources.stones | 0) - before })
      H.sfx('dungeon_clear', { throttleMs: 400 })
      H.persist('dungeon-sig-weekly')
      H.emitBurst({ kind: 'breakthrough' })
      const dg = res.dungeon || {}
      H.emitFloat({ text: `限时秘境 ${dg.name}`, kind: 'root' })
    }
    render()
    return
  }
  // 积分商店：积分→物品的**转换**（不是产出），按 EconLedger 口径不入归因
  const sb = e.target.closest('[data-shop-buy]')
  if (sb && !sb.disabled) {
    const res = system.buyShopItem(sb.dataset.shopBuy)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('dungeon-shop')
      H.emitFloat({ text: `得 ${res.itemName} ×${res.n}`, kind: 'ok' })
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
