/**
 * SectPanel.js —— 宗门面板（#sect-overlay：信息 / 任务板 / 藏经阁 / 商店 / 门下弟子）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层 · V3.5.6 拆分 main.js 第二批）：只碰本面板自己的 DOM；
 *   systems（sect）与装配层工具经 createSectPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（当前无）。任务/职级/商店规则在 SectSystem + data/sect.js，
 *   弟子线（收徒 / 培养 / 职权 / 贡献）规则在 SectSystem + data/disciples.js。
 *
 * V5.5 注入契约（两条铁律，与 DungeonPanel 同口径）：
 *   · Rule A：面板顶**只取 getter**（`const getSect = ctx.sect`），不得把 `ctx.sect` 直取成
 *     局部常量——直传会在 boot 早期被捕获成 null，面板静默全空（V4.7 批 0 实测过）。
 *   · Rule B：委托回调内**自行 getSect() / getState()**，不裸引用 render() 的局部变量。
 *   装配层对应写法见 main.js「宗门（2.4）」区块（`state: () => state, sect: () => sect`）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getTechnique } from '../data/techniques.js'   // 纯数据访问器（ui 层允许 import data/）
import { getItem } from '../data/items.js'
import { getRealmMeta } from '../data/realms.js'

export function createSectPanel (ctx) {
  const dom = ctx.dom
  // V5.5：系统一律 **getter 注入**（Rule A）——直传实例在 boot 早期会被捕获成 null，
  //   面板静默全空（V4.7 批 0 在渡劫面板上实测过）。委托回调内一律自行 getSect() / getState()
  //   （Rule B），不裸引用 render() 的局部变量。
  const getState = ctx.state
  const getSect = ctx.sect
  const H = ctx.helpers
  if (!dom.sectOverlay) return null

// ── 宗门面板（2.4）：信息 / 任务板 / 藏经阁 / 商店 ─────────────────────────

  function open () {
    if (!getState()) return
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

/**
 * V4.7 主人：一键接取 / 一键提交的可用态与计数
 *   无待接的活儿 → 「一键接取」置灰；无到点的活儿 → 「一键提交」置灰（未到期不替你折损）
 */
function syncTaskBulkBtns (taskList) {
  const state = getState()
  const live = Array.isArray(taskList) ? taskList.filter((t) => !t.broken) : []
  const openCnt = live.filter((t) => t.state === 'open').length
  if (dom.btnTaskStartall) {
    dom.btnTaskStartall.disabled = openCnt === 0
    dom.btnTaskStartall.textContent = openCnt ? `一键接取 (${openCnt})` : '一键接取'
  }
  // 自动接取开关（V4.7 主人修订：取代原「一键提交」按钮 —— 提交交给主循环的「到点自动交差」）
  const autoOn = !!(state.settings && state.settings.autoSect !== false)
  if (dom.btnTaskAutostart) {
    dom.btnTaskAutostart.textContent = autoOn ? '开' : '关'
    dom.btnTaskAutostart.classList.toggle('on', autoOn)
    dom.btnTaskAutostart.disabled = !Array.isArray(taskList)   // 未入宗时置灰
    dom.btnTaskAutostart.title = autoOn
      ? '自动接取：开 —— 任务板一刷新就自动把活儿接下来（战力达标的当场办妥）（点按关闭）'
      : '自动接取：关 —— 需自行点「接取」或「一键接取」（点按开启）'
  }
  if (dom.sectAutoNote) {
    dom.sectAutoNote.textContent = autoOn ? '刷新即接下，到点自动交差' : '已关闭：需手动接取'
  }
}

/**
 * V5.5.1 周常两条（设计库 §1.3 任务与贡献表）：宗门大比 / 供奉
 *   渲染进任务板宿主（同属「宗门任务与贡献」口径）；规则在 SectSystem + data/sect.js。
 */
function appendWeeklyRows (frag, sect) {
  // ① 宗门大比（周常）
  const db = sect.dabiInfo()
  const r1 = document.createElement('div')
  r1.className = 'sect-row' + (db.done ? ' locked' : '')
  const tn1 = document.createElement('span')
  tn1.className = 'tn'
  tn1.textContent = '宗门大比（周常）'
  const td1 = document.createElement('span')
  td1.className = 'td'
  td1.textContent = `每 ${db.days} 游戏天一届：以战力争胜，得贡献 ${db.lo}~${db.hi} 与头衔` +
    (db.title ? `　上一届：${db.title}` : '') + (db.wins ? ` · 魁首 ×${db.wins}` : '')
  const tp1 = document.createElement('span')
  tp1.className = 'tp dim'
  tp1.textContent = db.done ? '本届已赴' : '可赴'
  const btn1 = document.createElement('button')
  btn1.className = 'mini gap'
  btn1.textContent = db.done ? '已赴' : '赴大比'
  btn1.dataset.dabi = '1'
  btn1.disabled = !db.canClaim
  if (!db.done) btn1.title = `定标战力 ${H.fmt(db.req)}：战力越高贡献越厚（rate ≥ 0.9 记魁首）`
  r1.append(tn1, td1, tp1, btn1)
  frag.appendChild(r1)

  // ② 供奉（周常）
  const of = sect.offerInfo()
  const r2 = document.createElement('div')
  r2.className = 'sect-row' + (of.done ? ' locked' : '')
  const tn2 = document.createElement('span')
  tn2.className = 'tn'
  tn2.textContent = '供奉（周常）'
  const td2 = document.createElement('span')
  td2.className = 'td'
  td2.textContent = `捐出材料折贡献（货值 ×${of.rate}，每次至多 ${of.maxUnits} 份；每 ${db.days} 游戏天一次）`
  const btns = document.createElement('div')
  if (!of.rows.length) {
    const em = document.createElement('em')
    em.textContent = '行囊里暂无可供奉的材料'
    em.style.color = 'rgba(180,180,180,0.6)'
    btns.appendChild(em)
  } else {
    for (const m of of.rows) {
      const b = document.createElement('button')
      b.className = 'mini'
      b.style.marginRight = '4px'
      b.textContent = `${m.name}×${m.units}（+${m.contrib}）`
      b.dataset.offer = m.id
      b.disabled = of.done
      b.title = `${m.name} 货值 ${m.perUnit}/份 → 贡献 ×${of.rate}`
      btns.appendChild(b)
    }
  }
  td2.appendChild(btns)
  const tp2 = document.createElement('span')
  tp2.className = 'tp dim'
  tp2.textContent = of.done ? '本轮已供奉' : ''
  const ph = document.createElement('button')
  ph.className = 'mini gap'
  ph.textContent = '—'
  ph.disabled = true
  r2.append(tn2, td2, tp2, ph)
  frag.appendChild(r2)
}

/**
 * V5.5 门下弟子区（收徒 → 培养 → 职权 → 贡献；V5.5.1 增忠诚 / 被掳救援 / 师徒近事）
 *   数据全部取自 sect.disciplesView()（纯读）；本区只做接线与展示，规则在 SectSystem + data/disciples.js。
 */
function renderDisciples (info) {
  const host = dom.sectDisciples
  if (!host) return
  const sect = getSect()
  if (!sect) return
  if (!info.joined) {
    host.innerHTML = '<div class="bag-empty">入宗后开放</div>'
    return
  }
  const v = sect.disciplesView()
  const g = v.gate
  const st = v.stats
  const capped = st.rawHPerDay > st.capH + 1e-9

  let head = ''
  if (!g.open) {
    head = `<div class="si-line">收徒未开：需 <b>${g.realmName}</b> 期修为，且列身 <b>${g.rankName}</b>` +
      `（今为 ${getRealmMeta(sect.realmIndex).name}期 · ${sect.rankMeta.name}）。先做宗门任务攒贡献、晋职级。</div>`
  } else {
    head =
      `<div class="si-line">门墙 <b>${g.used}/${g.slots}</b> 名（上限 ${g.maxSlots}：每晋一大境界 +1 · 首座 +2 · 掌门 +3）` +
      `　在岗 ${st.posted} 名　保底计数 ${g.pity}/${g.pityNeed}</div>` +
      `<div class="si-line">师徒情分：忠诚低于 <b>${v.loyaltyMeta.revoltAt}</b> 会叛离（轻惩罚）` +
      `　传功 +${v.loyaltyMeta.trainHeal}　事件轮每 ${v.eventDays} 游戏天掷一次（3% / 名）</div>` +
      `<div class="si-line">合计产出 <span class="jade">${st.hPerDay.toFixed(2)} 当量 h/日</span>` +
      `　贡献 +${st.contribPerDay}/日　灵石 +${H.fmt(st.stonesPerDay)}/日　材料 ${st.matsPerDay.toFixed(1)} 份/日` +
      (capped ? `　<span class="dim">（原始 ${st.rawHPerDay.toFixed(2)} h/日，已按宗门线护栏压至 ${st.capH} h/日）</span>` : '') +
      `</div>`
  }
  const gazeNote = !g.open ? '未开启'
    : (g.free <= 0 ? '名额已满'
      : (g.canGaze ? '' : `还差 ${Math.max(1, Math.ceil(g.gazeInMs / 1000))} 秒`))
  head +=
    `<div class="sect-row">` +
    `<span class="tn">收徒</span>` +
    `<span class="td">观礼：免费，每 3 游戏天一次　｜　相看：${g.inspectCost} 贡献，此徒资质系数 +${Math.round(g.inspectLift * 100)}%` +
    `<em style="color:rgba(185,140,255,0.8)">弟子只产材料 / 贡献 / 灵石，不发境界</em></span>` +
    `<span class="tp dim">${g.open ? `空名额 ${g.free}` : ''}</span>` +
    `<button class="mini gap" data-recruit-gaze${g.canGaze ? '' : ' disabled'}>观礼${gazeNote ? `（${gazeNote}）` : ''}</button>` +
    `<button class="mini" data-recruit-inspect${g.canInspect ? '' : ' disabled'}>相看 ${g.inspectCost}</button>` +
    `</div>`
  host.innerHTML = head

  if (!v.list.length) {
    const empty = document.createElement('div')
    empty.className = 'bag-empty'
    empty.textContent = g.open
      ? '门墙尚空 —— 先「观礼」或「相看」收一名弟子（观礼免费，有冷却）。'
      : '收徒开启后可在此培养弟子。'
    host.appendChild(empty)
    return
  }

  const frag = document.createDocumentFragment()
  for (const d of v.list) {
    const row = document.createElement('div')
    row.className = 'sect-row' + (d.post ? '' : ' locked')

    const tn = document.createElement('span')
    tn.className = 'tn'
    tn.textContent = d.name

    const td = document.createElement('span')
    td.className = 'td'
    td.textContent = `${d.apt.name} · 悟性 ${d.wits.id} · 特长${d.spec ? d.spec.name : '—'} · 第 ${d.lv}/${d.lvMax} 级 · 忠诚 ${d.loyalty}`

    const line2 = document.createElement('div')
    line2.textContent = d.captured
      ? '被掳在外（不产出）——可救援赎人，或等下一事件轮自行脱困（忠诚受损）'
      : (d.post
          ? `职司 ${d.post.name}${d.fit ? '（对口 +30%）' : ''} → ${d.rateH.toFixed(3)} 当量 h/日${d.matName ? ` · 出 ${d.matName}` : ''}`
          : '闲居未派职（不产出）')
    line2.style.color = d.captured ? 'rgba(226,120,120,0.85)' : 'rgba(232,185,106,0.78)'
    td.appendChild(line2)

    // V5.5.1：忠诚告急提示（低于叛离线）
    if (d.loyalty < v.loyaltyMeta.revoltAt) {
      const warn = document.createElement('em')
      warn.textContent = `忠诚告急：低于 ${v.loyaltyMeta.revoltAt} 将在下个事件轮叛离（传功 +${v.loyaltyMeta.trainHeal} 可挽回）`
      warn.style.color = 'rgba(226,120,120,0.85)'
      td.appendChild(warn)
    }

    if (d.trainMaxed) {
      const em = document.createElement('em')
      em.textContent = '已至满级'
      em.style.color = 'rgba(127,214,168,0.85)'
      td.appendChild(em)
    } else if (!d.trainAffordable) {
      const em = document.createElement('em')
      em.textContent = `传功需 ${H.fmt(d.trainQi)} 修为（不足）`
      em.style.color = 'rgba(226,120,120,0.85)'
      td.appendChild(em)
    }

    // 职权：每名已实装岗位一枚按钮 + 一枚「撤职 / 闲居」（被掳期间整排禁用）
    const acts = document.createElement('div')
    acts.style.marginTop = '2px'
    for (const p of d.posts) {
      const b = document.createElement('button')
      b.className = 'mini'
      b.style.marginRight = '4px'
      b.textContent = `${p.name}${p.active ? ' ✓' : ''}`
      b.dataset.postSet = d.uid
      b.dataset.post = p.id
      b.title = p.fit ? `${p.name}（特长对口 · 产出 +30%）` : `${p.name}`
      if (p.active || d.captured) b.disabled = true
      acts.appendChild(b)
    }
    const off = document.createElement('button')
    off.className = 'mini'
    off.textContent = d.post ? '撤职' : '闲居'
    off.dataset.postSet = d.uid
    off.dataset.post = 'none'
    off.title = '卸去职司，回山静修（不产出）'
    if (!d.post || d.captured) off.disabled = true
    acts.appendChild(off)
    td.appendChild(acts)

    const tp = document.createElement('span')
    tp.className = 'tp dim'
    tp.textContent = d.captured ? '被掳' : (d.trainMaxed ? '满级' : `传功 ${H.fmt(d.trainQi)}`)

    const btn = document.createElement('button')
    btn.className = 'mini gap'
    if (d.captured) {
      // V5.5.1：被掳 → 主按钮换成「救援」（花贡献赎人）
      btn.textContent = `救援 ${v.rescueCost}`
      btn.dataset.rescue = d.uid
      btn.disabled = v.rescueCost > sect.contribution
      btn.title = `以 ${v.rescueCost} 贡献赎回${d.name}（忠诚 +${v.loyaltyMeta.rescue}）；不救则下一事件轮自行脱困（忠诚 ${v.loyaltyMeta.capturedReturn}）`
    } else if (d.trainMaxed) {
      btn.textContent = '已满'
      btn.disabled = true
    } else {
      btn.textContent = '传功'
      btn.dataset.train = d.uid
      btn.disabled = !d.trainAffordable
      btn.title = `耗灵气 ${H.fmt(d.trainQi)}，修为进一级（代价随等级升、随资质悟性降；忠诚 +${v.loyaltyMeta.trainHeal}）`
    }

    row.append(tn, td, tp, btn)
    frag.appendChild(row)
  }
  host.replaceChildren(frag)

  // V5.5.1：师徒近事（最近 5 条，倒序；事件掷点在系统 tick 内，面板只展示台账）
  if (v.events && v.events.length) {
    const box = document.createElement('div')
    box.className = 'si-line'
    box.style.color = 'rgba(180,180,190,0.75)'
    box.textContent = '师徒近事：' + v.events.map((e) => e.text).join('　')
    host.appendChild(box)
  }
}

function render () {
  const state = getState()
  const sect = getSect()
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
    syncTaskBulkBtns(null)
  } else {
    const taskList = sect.tasksView()
    const frag = document.createDocumentFragment()
    for (const t of taskList) {
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
    // V5.5.1：周常两条（宗门大比 / 供奉）——设计库 §1.3，与任务板同宿主
    appendWeeklyRows(frag, sect)
    dom.sectTasks.replaceChildren(frag)
    syncTaskBulkBtns(taskList)
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

  // ⑤ 门下弟子（V5.5：收徒 / 传功 / 派职 / 贡献）
  renderDisciples(info)

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
  // V5.5 Rule B：委托回调内自行取 system / state —— 不裸引用 render() 的局部变量
  const state = getState()
  const sect = getSect()
  if (!state || !sect) return
  // V4.7 主人：一键接取 / 一键提交（回执合并成一条，避免逐槽刷屏）
  const tsa = e.target.closest('[data-task-startall]')
  if (tsa && !tsa.disabled) {
    const res = sect.startAllOpen()
    if (res.started > 0) {
      const inst = res.instant > 0 ? `，其中 ${res.instant} 件战力达标、当场办妥（贡献 +${res.contrib}）` : ''
      H.pushLog(`一键接取：接下 ${res.started} 件活儿${inst}。`, res.instant > 0 ? 'ok' : 'info')
      if (res.instant > 0) H.emitFloat({ text: `当场办妥 ×${res.instant}`, kind: 'gold' })
      H.persist('sect-task-startall')
    } else {
      H.pushLog('一键接取：眼下没有待接的活儿。', 'info')
    }
    render()
    return
  }
  // 自动接取开关（V4.7 主人修订：取代原「一键提交」按钮）
  const tas = e.target.closest('[data-task-autostart]')
  if (tas && !tas.disabled) {
    const next = state.settings.autoSect === false
    state.settings.autoSect = next
    H.pushLog(next
      ? '宗门自动接取：开 —— 任务板一刷新就自动把活儿接下来（到点仍自动交差）。'
      : '宗门自动接取：关 —— 任务改由你手动接取。', 'sys')
    H.persist('settings')
    render()
    return
  }
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
    return
  }
  // ── V5.5 弟子线（收徒 / 传功 / 职权）───────────────────────────────────────
  const rg = e.target.closest('[data-recruit-gaze]')
  if (rg && !rg.disabled) {
    const res = sect.recruitByGaze()
    H.pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) {
      H.persist('sect-recruit-gaze')
      H.emitBurst({ kind: 'breakthrough' })
    }
    render()
    return
  }
  const ri = e.target.closest('[data-recruit-inspect]')
  if (ri && !ri.disabled) {
    const res = sect.recruitByInspect()
    H.pushLog(res.message, res.ok ? 'root' : 'info')
    if (res.ok) {
      H.persist('sect-recruit-inspect')
      H.emitBurst({ kind: 'breakthrough' })
    }
    render()
    return
  }
  const tr = e.target.closest('[data-train]')
  if (tr && !tr.disabled) {
    const res = sect.train(tr.dataset.train)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      // 传功＝灵气支出（宗门线净额的负项）→ 回传既有 `sect` 归因线，不新增线
      // ⚠ 大数禁 `| 0`（会 32 位溢出），一律 Number(x) || 0
      if (H.noteSect) H.noteSect({ qi: -(Number(res.cost) || 0) })
      H.persist('sect-train')
      H.emitFloat({ text: `${res.name} · 第 ${res.lv} 级`, kind: 'gold' })
    }
    render()
    return
  }
  const ps = e.target.closest('[data-post-set]')
  if (ps && !ps.disabled) {
    const res = sect.assignPost(ps.dataset.postSet, ps.dataset.post)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) H.persist('sect-post')
    render()
    return
  }
  // ── V5.5.1 弟子线后续批（周常大比 / 供奉 / 救援）────────────────────────────
  const db = e.target.closest('[data-dabi]')
  if (db && !db.disabled) {
    const res = sect.claimDabi()
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('sect-dabi')
      H.emitFloat({ text: `${res.title} · 贡献 +${res.contrib}`, kind: 'gold' })
    }
    render()
    return
  }
  const ofr = e.target.closest('[data-offer]')
  if (ofr && !ofr.disabled) {
    const res = sect.offer(ofr.dataset.offer)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) {
      H.persist('sect-offer')
      H.emitFloat({ text: `贡献 +${res.contrib}`, kind: 'info' })
    }
    render()
    return
  }
  const rc = e.target.closest('[data-rescue]')
  if (rc && !rc.disabled) {
    const res = sect.rescue(rc.dataset.rescue)
    H.pushLog(res.message, res.ok ? 'ok' : 'info')
    if (res.ok) H.persist('sect-rescue')
    render()
  }
})

  return { open, close, toggle, render }
}
