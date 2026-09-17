/**
 * SectPanel.js —— 宗门面板（#sect-overlay：信息 / 任务板 / 藏经阁 / 商店）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   systems（sect）与装配层工具经 createSectPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（当前无）。任务/职级/商店规则在 SectSystem + data/sect.js。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getTechnique } from '../data/techniques.js'   // 纯数据访问器（ui 层允许 import data/）
import { getItem } from '../data/items.js'
import { getRealmMeta } from '../data/realms.js'

export function createSectPanel (ctx) {
  const dom = ctx.dom
  const state = ctx.state
  const sect = ctx.sect
  const H = ctx.helpers
  if (!dom.sectOverlay) return null

// ── 宗门面板（2.4）：信息 / 任务板 / 藏经阁 / 商店 ─────────────────────────

  function open () {
    if (!state) return
    H.closeTip()
    H.closeAllOverlays('sect')
    render()
    H.ovShow(dom.sectOverlay)
    dom.btnSect.classList.add('on')
    H.syncDragRegions()
  }

  function close () {
    H.ovHide(dom.sectOverlay)
    dom.btnSect.classList.remove('on')
    H.syncDragRegions()
  }

  function toggle () {
    if (dom.sectOverlay.classList.contains('show')) close()
    else open()
  }

/** 剩余时长文案：一律走游戏历（主人 2026-09-17：界面时间用游戏时间，不用现实时分） */
const fmtHoursLeft = (ms) => H.fmtGameDuration(ms)

/**
 * 宗门任务倒计时（主人 2026-09-19：任务限时按**游戏时辰**计）
 *   一条活计只有几个时辰 ≈ 现实十几秒，光看"2 时辰"不直观 → 游戏时辰 + 现实秒并列。
 */
function fmtTaskLeft (ms) {
  const sec = Math.max(0, Math.ceil((Number(ms) || 0) / 1000))
  if (sec <= 0) return '已到点'
  return `${H.fmtGameDuration(ms)}（现实 ${sec} 秒）`
}

function render () {
  if (!state || !sect) return
  const info = sect.infoView()

  // ① 宗门信息（未入宗给「拜入」入口）
  let infoHtml = ''
  if (!info.joined) {
    infoHtml =
      `<div class="si-name">${info.sect.name}</div>` +
      `<div class="si-line">${info.sect.intro}</div>` +
      `<div class="si-line">道统：<span class="violet">${info.sect.daoTong.name}</span> —— ${info.sect.daoTong.desc}</div>` +
      `<div class="si-line">入宗免费，列身外门：领宗门任务攒贡献，可在藏经阁借功法、商店换丹药材料。</div>` +
      `<div class="si-btns"><button class="mini" data-join>拜 入 云 岚 宗</button></div>`
  } else {
    const r = info.rank
    const p = info.promo
    const promoLine = p.maxed
      ? `职级：<b>${r.name}</b>（已至掌门）`
      : `<b>${r.name}</b> → 下一职 ${p.next.name}（需 ${p.realmName}期 ／ 累计贡献 ${p.next.contrib}，现 ${info.totalContrib}）`
    // V3.3.1：宗门按境界下发功法的进度（哪一档已领、哪一档待领）
    const granted = (info.realmGrants || [])
      .filter((g) => g.unlocked)
      .map((g) => `${g.label}${g.techId && g.techId !== '—' ? `已授《${(getTechnique(g.techId) || {}).name || g.techId}》` : '已授'}`)
      .join(' ｜ ')
    const pendingGrant = (info.pendingGrants || []).length
      ? `<div class="si-line">宗门授功：<span class="jade">${info.pendingGrants.join('、')}</span>档的普通功法即将下发（每晋一大境界补一本）</div>`
      : ''
    infoHtml =
      `<div class="si-name">${info.sect.name}</div>` +
      `<div class="si-line">道统：<span class="violet">${info.sect.daoTong.name}</span> —— ${info.sect.daoTong.desc}</div>` +
      `<div class="si-line">职级：${promoLine}</div>` +
      `<div class="si-line">境界：<b>${info.realmName}</b>期　任务板按此境界出题、悬赏随境界递增</div>` +
      `<div class="si-line">贡献：<b>${info.contribution}</b>（累计 ${info.totalContrib}）　俸禄：${r.salaryHours} 时/日 ≈ <span class="jade">+${H.fmt(info.salaryPerDay)} 修为/日</span>（在线随秒入账）</div>` +
      (granted ? `<div class="si-line">宗门授功：${granted}</div>` : '') +
      pendingGrant +
      (p.can ? `<div class="si-btns"><button class="mini" data-promote>晋 升 ${p.next.name}</button></div>` : '')
  }
  dom.sectInfo.innerHTML = infoHtml

  // ② 任务板
  if (!info.joined) {
    dom.sectTasks.innerHTML = '<div class="bag-empty">入宗后开放</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const t of sect.tasksView()) {
      if (t.broken) continue
      const row = document.createElement('div')
      row.className = 'sect-row' + (t.state === 'empty' ? ' locked' : '')

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = t.def.name

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = t.def.desc
      // 悬赏：贡献 +（材料）——主人 2026-09-17 标清奖励；09-18 起随境界递增
      const reward = document.createElement('div')
      const mat = t.def.material ? ` · ${getItem(t.def.material.id).name} ×${t.def.material.min}~${t.def.material.max}` : ''
      reward.textContent = `悬赏：贡献 +${t.contrib}${mat}${t.def.failHalf ? '（战力校验失败减半）' : ''}`
      reward.style.color = 'rgba(232,185,106,0.78)'
      td.appendChild(reward)
      if (t.def.minRealm > 0) {
        const tag = document.createElement('em')
        tag.textContent = `${getRealmMeta(t.def.minRealm).name}期解锁 · 重赏`
        tag.style.color = 'rgba(185,140,255,0.8)'
        td.appendChild(tag)
      }
      // 战力类：达标提示（接取即办妥 / 达标必成）
      if (t.def.kind === 'power' && t.state === 'open' && t.outmatched) {
        const em = document.createElement('em')
        em.textContent = '战力已过定标 · 接取即办妥'
        em.style.color = 'rgba(127,214,168,0.85)'
        td.appendChild(em)
      }
      if (t.state === 'running' && t.def.kind === 'power') {
        const em = document.createElement('em')
        em.textContent = `定标战力 ${H.fmt(t.req)} ｜ 当前成率 ${(t.liveRate * 100).toFixed(0)}%${t.outmatched ? ' · 达标必成' : ''}`
        em.style.color = 'rgba(232,185,106,0.75)'
        td.appendChild(em)
      }
      if (t.state === 'running') {
        // 提前交差：看得见"现在交能拿多少"
        const pre = document.createElement('em')
        pre.textContent = t.done
          ? '时辰已到 · 下一拍自动交差并结算'
          : `已办妥 ${Math.round((t.ratio || 0) * 100)}% → 提前交差可得贡献 +${t.previewContrib}（到点自动满额结算）`
        pre.style.color = 'rgba(127,214,168,0.8)'
        td.appendChild(pre)
      }

      const tp = document.createElement('span')
      tp.className = 'tp' + (t.state === 'running' && !t.done ? ' dim' : '')
      // 任务时长与倒计时：限时＝游戏时辰，倒计时另附现实秒（短活计只有十几秒）
      if (t.state === 'open') tp.textContent = `${t.def.hours} 时辰`
      else if (t.state === 'running') tp.textContent = t.done ? '已到点' : `还差 ${fmtTaskLeft(t.autoInMs)}`
      else tp.textContent = '本轮已交'

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      if (t.state === 'open') {
        btn.textContent = '接取'
        btn.dataset.taskStart = t.index
        if (t.def.kind === 'power') {
          btn.title = t.outmatched
            ? '战力已过定标：接取当场办妥（贡献按满额算）'
            : '战力未过定标：接取后到时按战力判定成败，也可提前交差'
        }
      } else if (t.state === 'running') {
        // 接取后随时可交（门槛 min(10% 时长, 1 秒)）；到点则由主循环自动交差
        btn.textContent = t.done ? '交差' : '提前交差'
        btn.disabled = !t.claimable
        btn.dataset.taskClaim = t.index
        if (!t.claimable) {
          const wait = Math.max(1, Math.ceil((t.gateMs - t.elapsedMs) / 1000))
          btn.title = `才刚接手，至少办够 ${(t.gateMs / 1000).toFixed(1)} 秒才好交差（约 ${wait} 秒后）`
        } else if (!t.done) {
          btn.title = `提前交差：按已办妥 ${Math.round((t.ratio || 0) * 100)}% 折算（贡献 +${t.previewContrib}）；\n不点也行——到点会自动满额交差`
        } else {
          btn.title = '办妥交差，满额结算（到点也会自动交）'
        }
      } else {
        btn.textContent = '—'
        btn.disabled = true
      }

      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.sectTasks.replaceChildren(frag)
  }

  // ③ 藏经阁
  if (!info.joined) {
    dom.sectLibrary.innerHTML = '<div class="bag-empty">入宗后开放</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of sect.libraryView()) {
      const row = document.createElement('div')
      row.className = 'sect-row' + (e.rankLocked ? ' locked' : '')

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = e.name

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = `${e.tierLabel} ｜ ${e.rankLocked ? '需内门职级' : '可借阅'}`

      const tp = document.createElement('span')
      tp.className = 'tp dim'
      tp.textContent = `${e.cost} 贡献`

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      if (e.owned) { btn.textContent = '已习得'; btn.disabled = true }
      else { btn.textContent = '借阅'; btn.dataset.libBuy = e.id; btn.disabled = e.rankLocked }

      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.sectLibrary.replaceChildren(frag)
  }

  // ④ 宗门商店
  if (!info.joined) {
    dom.sectShop.innerHTML = '<div class="bag-empty">入宗后开放</div>'
  } else {
    const frag = document.createDocumentFragment()
    for (const e of sect.shopView()) {
      const row = document.createElement('div')
      row.className = 'sect-row'

      const tn = document.createElement('span')
      tn.className = 'tn'
      tn.textContent = e.name

      const td = document.createElement('span')
      td.className = 'td'
      td.textContent = `${getItem(e.id).desc}`

      const tp = document.createElement('span')
      tp.className = 'tp dim'
      tp.textContent = e.discounted ? `${e.cost}→${e.price} 贡献` : `${e.price} 贡献`

      const btn = document.createElement('button')
      btn.className = 'mini gap'
      btn.textContent = '兑换'
      btn.dataset.shopBuy = e.id

      row.append(tn, td, tp, btn)
      frag.appendChild(row)
    }
    dom.sectShop.replaceChildren(frag)
  }

  if (dom.sectNote) {
    dom.sectNote.textContent = info.joined
      ? `任务板${info.refreshText || H.fmtRefreshPeriod()}刷新一次（交完本轮转空 · 距下一轮 ${fmtTaskLeft(info.nextRefreshInMs || H.msToNextRefresh(Date.now()))}）；` +
        '任务按境界出题、悬赏随境界递增（每晋一大境界 +60%）；' +
        '限时按**游戏时辰**计（如巡山两个时辰），**时辰一到自动交差入账**，中途也可手动提前交差（按已办妥比例折算）；' +
        '战力校验类的定标以「基准战力 × 系数」为准：**战力已达标者接取即办妥**，未达标则到时按概率判定、失败贡献减半。' +
        '每晋一大境界，宗门还会下发一本该境界的普通功法（藏经阁高阶功法仍须贡献借阅）。' +
        '俸禄只随在线时间发放，闭关（离线）不结俸。'
      : '青岚界三宗：云岚宗（剑）｜丹霞谷（丹）｜磐石门（体）。本档开放云岚宗；名册随世界替换（2.9 世界卡池接入）。入宗即按当前境界下发普通功法，可在藏经阁以贡献借阅更多。'
  }
}

// 宗门面板动作（事件委托：面板每次重绘不丢监听）
dom.sectOverlay.addEventListener('click', (e) => {
  const join = e.target.closest('[data-join]')
  if (join) {
    const res = sect.join()
    H.pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) {
      // 入宗即按境界下发功法（主人 2026-09-18）
      for (const g of (res.grants || [])) {
        H.pushLog(`宗门授功：${g.realmName}期弟子当习《${g.name}》，已录入功法册（去「功法」装槽）。`, 'root')
      }
      H.persist('sect-join')
      H.emitBurst({ kind: 'breakthrough' })
    }
    render()
    return
  }
  const promo = e.target.closest('[data-promote]')
  if (promo) {
    const res = sect.promote()
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) { H.persist('sect-promote'); H.emitBurst({ kind: 'breakthrough' }) }
    render()
    return
  }
  const ts = e.target.closest('[data-task-start]')
  if (ts && !ts.disabled) {
    const res = sect.startTask(+ts.dataset.taskStart)
    H.pushLog(res.message, res.ok ? (res.instant ? 'ok' : 'info') : 'info')
    if (res.ok && res.instant) {
      // 战力碾压：接取当场办妥（主人 2026-09-19）
      H.persist('sect-task-instant')
      H.emitFloat({ text: `贡献 +${res.contrib}`, kind: 'gold' })
    }
    render()
    return
  }
  const tc = e.target.closest('[data-task-claim]')
  if (tc && !tc.disabled) {
    const res = sect.claimTask(+tc.dataset.taskClaim)
    H.pushLog(res.message, res.ok && res.success ? 'ok' : (res.ok ? 'fail' : 'info'))
    if (res.ok) {
      H.persist('sect-claim')
      H.emitFloat({ text: `贡献 +${res.contrib}${res.early ? '（提前）' : ''}`, kind: 'info' })
    } else {
      // 提前交差被拒（还没过门槛）也要给回执，别让人以为按钮坏了
      render()
      return
    }
    render()
    return
  }
  const lb = e.target.closest('[data-lib-buy]')
  if (lb && !lb.disabled) {
    const res = sect.buyLibrary(lb.dataset.libBuy)
    H.pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) { H.persist('sect-library'); H.emitBurst({ kind: 'breakthrough' }) }
    render()
    return
  }
  const sb = e.target.closest('[data-shop-buy]')
  if (sb && !sb.disabled) {
    const res = sect.buyShop(sb.dataset.shopBuy)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) H.persist('sect-shop')
    render()
  }
})

  return { open, close, toggle, render }
}
