/**
 * WorldPanel.js —— 世界日常面板（#world-overlay 的 `data-state="daily"` 日常态）（V5.2 · P5.2）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层）：只碰本面板自己的 DOM（`#world-overlay` 内的日常态区块）；
 *   systems（worldMech / world）与装配层工具经 createWorldPanel(ctx) 注入，禁止 import systems；
 *   纯数据层可 import（当前用 data/worldMechanics.js 的 MECH 做量级文案）。
 *
 * 结构（已拍板方案①）：**不新增遮罩**——沿用 `#world-overlay`，只多一个 `data-state="daily"`：
 *   intro（开局抽世界）/ result（揭晓）/ **daily（本面板：世界词条 + 专属机制 + 摩擦项 + 换界行）**；
 *   V5.3 A4c 追加「换界 · 界镜 / 界游符」一行（`data-world-travel="<kind>:buy|use"`，第三条委托分支）——
 *   数据与结算在 `WorldSystem.travelView / buyTravel / useTravel`（面板只做按钮与文案，零 state 写入）；
 *   `.ov` 遮罩家族仍 11 个（本遮罩本来就不带 .ov class）。
 * 开合由注入的 helpers.showWorldOverlay / hideWorldOverlay 完成（与 main.js 开局两态同一对函数），
 *   Esc 与面板互斥由装配层登记（A3 已按 K0 预核风险申报，见回执-A3 §1）。
 *
 * 两条铁律：① 系统一律 getter 注入（ctx.system / ctx.world）；② 委托回调内自行取 system。
 * 宿主 `#world-daily-*` 照 V5.6 BeastPanel 惯例在面板内兜底查找（**不动 main.js dom 表**）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { MECH } from '../data/worldMechanics.js'   // 纯数据（ui 层允许 import data/）：量级文案口径

export function createWorldPanel (ctx) {
  const dom = ctx.dom
  const getState = ctx.state
  const getSystem = ctx.system
  const getWorld = ctx.world
  const H = ctx.helpers
  if (!dom.worldOverlay) return null

  // 日常态四个宿主：dom 表未登记（不动装配层公共区），面板内自行兜底查找
  const pick = (key, id) => dom[key] ||
    (typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null)
  const headHost = pick('worldDailyHead', 'world-daily-head')
  const actsHost = pick('worldDailyActs', 'world-daily-acts')
  const fricHost = pick('worldDailyFriction', 'world-daily-friction')
  const noteHost = pick('worldDailyNote', 'world-daily-note')

  const esc = (s) => String(s == null ? '' : s)

  // V5.3 A4c：换界（界游符）不可逆——熟练度清零 → 面板内**二次确认**（只用一个闭包标志，不引新宿主）
  let pendingSwap = false

  /**
   * 换界道具行（V5.3 A4c）：界镜 / 界游符 各「兑（花灵石）/ 用（消耗一件）」两键。
   * 纯展示 + data 属性；结算全在世界机制/世界系统里（本函数不碰 state）。
   */
  function travelRowHtml (tv) {
    if (!tv || !tv.drawn) return ''
    const line = (p, buyLabel, useLabel) => {
      const buyWhy = p.canBuy ? ''
        : (p.limited && p.leftToday === 0
            ? '本日额度已领完'
            : (p.affordable ? '不可兑领' : `灵石不足（需 ${H.fmt(p.priceStones)}）`))
      const useWhy = p.held >= 1 ? '' : `行囊无${p.name}`
      return '<div class="world-d-travel-line">' +
        `${esc(p.name)} <b>×${p.held}</b>　兑价 ${H.fmt(p.priceStones)} 灵石（${p.priceH}h 当量）` +
        (p.limited ? `　<span class="world-d-quota">本日额度 ${p.usedToday}/${p.dailyLimit}</span>` : '　不限量') +
        '<div class="dbtns">' +
        `<button class="d-btn" data-world-travel="${esc(p.kind)}:buy"${p.canBuy ? '' : ' disabled'}` +
        `${buyWhy ? ` title="${esc(buyWhy)}"` : ''}>${buyLabel}</button>` +
        `<button class="d-btn" data-world-travel="${esc(p.kind)}:use"${p.held >= 1 ? '' : ' disabled'}` +
        `${useWhy ? ` title="${esc(useWhy)}"` : ''}>${useLabel}</button>` +
        '</div></div>'
    }
    const confirmHint = pendingSwap
      ? '<br><span class="world-d-tax">⚠ 再点一次「确 认 换 界」即生效：熟练度清零、专属机制状态重置（招牌首通与秘境积分保留）</span>'
      : ''
    return '<div class="dungeon-row">' +
      '<span class="dn">换界 · 界镜 / 界游符</span>' +
      '<span class="dd">' +
      line(tv.mirror, '兑 界 镜', '用界镜重掷') +
      line(tv.talisman, '兑 界 游 符', pendingSwap ? '确 认 换 界' : '换 界') +
      '<br>换界为<b>原子</b>切换：世界修正 ＋ 熟练度（清零）＋ 专属机制状态一起换；' +
      '招牌首通与秘境积分是跨界资产，保留。' +
      `「界游之礼」期望 ≈ ${(tv.giftExpectH || 0).toFixed(1)}h 当量（灵石或既有材料，单次随机）。` +
      confirmHint +
      '</span></div>'
  }

  function open () {
    if (!getState()) return
    const w = getWorld()
    if (!w || !w.drawn) return                     // 未抽定世界：日常态无内容可看
    H.closeTip()
    H.closeAllOverlays('world')                    // 互斥：先收掉其余面板
    render()
    H.showWorldOverlay('daily')
    H.syncDragRegions()
  }

  function close () {
    // 只在日常态下收起，别把开局 intro / 揭晓 result 两态一起关掉
    if (dom.worldOverlay.dataset && dom.worldOverlay.dataset.state === 'daily') {
      H.hideWorldOverlay()
      H.syncDragRegions()
    }
  }

  function toggle () {
    if (dom.worldOverlay.classList.contains('show') && dom.worldOverlay.dataset.state === 'daily') close()
    else open()
  }

  function render () {
    const system = getSystem()
    const world = getWorld()
    if (!getState() || !system || !actsHost) return
    const now = Date.now()
    const v = system.view(now)
    const wv = (world && world.drawn) ? world.view() : null

    // ① 界况头：世界词条（照开局揭晓卡同源：view() / exclusive / friction）
    if (headHost) {
      if (!v.drawn) {
        headHost.innerHTML = '<div class="bag-empty">尚未抽定世界 · 开局先抽世界再看专属机制</div>'
      } else if (!v.implemented) {
        headHost.innerHTML =
          `<div class="world-d-title">${esc(v.name)}${v.tag ? `　<span class="world-d-tag">${esc(v.tag)}</span>` : ''}</div>` +
          `<div class="world-d-line">专属 · ${esc(v.exclusive)}</div>` +
          `<div class="world-d-line">摩擦 · ${esc(v.friction)}</div>` +
          `<div class="bag-empty">本界专属机制属内容批次 2/3（世界篇）余项——A4a 批铺量；本面板届时自动多出该界的核心与摩擦两行。</div>`
      } else {
        const mods = wv
          ? `产出 ×${wv.baseRateMul.toFixed(2)}　寿元 ×${(wv.lifespanMul || 1).toFixed(2)}${wv.trialMul !== 1 ? `　天劫 ×${wv.trialMul.toFixed(2)}` : ''}` +
            `${wv.masteryPct ? `　轮回熟练 +${Math.round(wv.masteryPct * 100)}%` : ''}　本界第 ${wv.runsInWorld} 世`
          : ''
        const pts = (v.points || []).length
          ? `<div class="world-d-line world-d-points">` +
            v.points.map((p) => `${p.name} <b>${H.fmt(p.value)}</b>${p.unit}`).join('　') +
            (v.stats && v.stats.rank ? `　职级 <b>${v.stats.rank.name}</b>` : '') +
            (v.stats && v.stats.jianJie != null ? `　法宝 <b>${v.stats.jianJie}</b> 阶（战力 +${(v.stats.powerPct * 100).toFixed(1)}%）` : '') +
            `</div>`
          : ''
        const rankTable = v.stats && v.stats.rankTable
          ? `<div class="world-d-sub">族中阶梯：${v.stats.rankTable}</div>`
          : ''
        headHost.innerHTML =
          `<div class="world-d-title">${esc(v.name)}${v.tag ? `　<span class="world-d-tag">${esc(v.tag)}</span>` : ''}</div>` +
          `<div class="world-d-line">${esc(v.identity)}　${mods}</div>` +
          `<div class="world-d-line">专属 · ${esc(v.exclusive)}</div>` +
          `<div class="world-d-line world-d-friction">摩擦 · ${esc(v.friction)}</div>` +
          pts + rankTable
      }
    }

    // ② 核心机制动作行（一界一行一按钮；数据层加了动作，面板自动多出一行）
    const acts = v.acts || []
    let actsHtml = ''
    if (!v.implemented) {
      actsHtml = '<div class="bag-empty">此界暂无已实装的专属机制。</div>'
    } else if (!acts.length) {
      actsHtml = '<div class="bag-empty">此界专属机制登记为空。</div>'
    } else {
      for (const a of acts) {
        const locked = !a.ready
        const btnText = a.kind === 'refine' ? '祭 炼' : (a.kind === 'check' ? '应 考' : '施 为')
        const quotaText = a.quota == null ? ''
          : `　<span class="world-d-quota">本轮 ${(a.quota - (a.quotaLeft == null ? 0 : a.quotaLeft))}/${a.quota}</span>`
        const calcText = a.kind === 'check'
          ? `<br>战力校验：当前 <b>${H.fmt(a.power)}</b> / 需 <b>${H.fmt(a.needPower)}</b>（${a.pass ? '可应考' : '战力不足'}）`
          : (a.kind === 'refine'
            ? `<br>当前 <b>${a.level}</b> / ${a.maxLevel} 阶　每阶：战力 +${(a.powerPctPer * 100).toFixed(1)}%、剑冢产出 +${Math.round(a.ratePctPer * 100)}%`
            : '')
        const rateText = a.ratePct > 0 ? `<br><span class="world-d-tax">族贡抽成 ${Math.round(a.ratePct * 100)}% 已计入本行产出</span>` : ''
        actsHtml +=
          `<div class="dungeon-row${locked ? ' locked' : ''}">` +
          `<span class="dn">${esc(a.label)}</span>` +
          `<span class="dd">${esc(a.note)}` +
          `<br>得：<b>${esc(a.gainText || '—')}</b>${a.costText ? `　　耗：${esc(a.costText)}` : ''}${quotaText}${calcText}${rateText}` +
          `</span>` +
          `<span class="ds">${a.ready ? '可施为' : esc(a.disabledReason)}</span>` +
          `<div class="dbtns"><button class="d-btn" data-world-act="${esc(a.id)}"${a.ready ? '' : ' disabled'}` +
          `${a.note ? ` title="${esc(a.note)}"` : ''}>${esc(btnText)}</button></div>` +
          `</div>`
      }
    }
    // ②-b（V5.3 A4c）换界道具行：界镜 / 界游符（世界系统提供数据，面板只做按钮与文案）
    if (world && typeof world.travelView === 'function') actsHtml += travelRowHtml(world.travelView(now))
    actsHost.innerHTML = actsHtml

    // ③ 摩擦行（三种：已在别处生效的展示联动 / 只做标记 / 可开关）
    if (fricHost) {
      const f = v.frictionRow || {}
      if (!v.drawn) {
        fricHost.innerHTML = ''
      } else {
        const stateText = f.kind === 'tribute'
          ? `<b>${esc(f.label)}</b>（${esc(f.rankName)} ${Math.round((f.ratePct || 0) * 100)}%）　${f.enabled ? '上缴中' : '免缴'}`
          : `<b>${esc(f.label)}</b>　${f.ratePct > 0 ? `本界实际生效 ×${(f.mul || 1).toFixed(2)}（+${Math.round(f.ratePct * 100)}%）` : '已标记'}`
        const table = f.rateTable ? `<br><span class="world-d-sub">抽成率：${esc(f.rateTable)}</span>` : ''
        const btn = f.toggle
          ? `<div class="dbtns"><button class="d-btn" data-world-toggle="tribute">${f.enabled ? '关 闭' : '开 启'}</button></div>`
          : ''
        fricHost.innerHTML =
          `<div class="dungeon-row">` +
          `<span class="dn">摩擦·${esc(f.kind === 'tribute' ? '可开关' : '登记')}</span>` +
          `<span class="dd">${stateText}${table}<br>${esc(f.note)}</span>` +
          btn +
          `</div>`
      }
    }

    // ④ 脚注：口径 + 静态量级（量级护栏，照 §七 / §6.3 报告口径）
    if (noteHost) {
      const sd = v.static || { h: 0 }
      const perDay = `${sd.h.toFixed(2)} h/日`
      const stonesPerDay = H.fmt(v.staticStones || 0)
      noteHost.textContent = v.implemented
        ? `本界专属机制：${esc(v.source)}　静态量级 ${perDay}（≈ ${stonesPerDay} 灵石/日 · 上限 ${v.staticCap.toFixed(2)} h/日）；` +
          `派遣线 0.9 h/h（5 槽满）＝21.6 h/日 —— 本界机制远在其下，且同一时刻只有一界机制在生效。` +
          `产出不发境界；「灵石 ↔ 材料 / 族贡」属转换（按坊市口径不折产出），面板点出的灵石净额回传归因（第 'other' 线，不新增线）。` +
          `周期与坊市同源（${MECH.dayGameDays} 游戏天 = 现实 1 日；1 现实分钟 = 1 游戏天）。`
        : `本界专属机制＝内容批次 2/3（世界篇）余项：A4a 批按 src/data/worldMechanics.js 的「一界一个参数块」模板铺量，` +
          `本面板与系统无需再改（新增一界只动数据层一处）。`
    }
  }

  // 「收起」按钮：与其余面板不同，本面板的宿主遮罩不是 .ov 家族，故按钮由面板自绑（不动 dom 表）
  const closeBtn = pick('btnWorldDailyClose', 'btn-world-daily-close')
  if (closeBtn && typeof closeBtn.addEventListener === 'function') {
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close() })
  }

  // 世界日常态动作（事件委托：面板每次重绘不丢监听；系统实例必须在回调内取——Rule B）
  const onPress = H.onPress || ((host, fn) => host.addEventListener('click', fn))
  onPress(dom.worldOverlay, (e) => {
    const system = getSystem()
    const st = getState()
    // ── V5.3 A4c：换界（界镜 / 界游符）── 先于世界机制分支判定（换界后本界动作整行会随之改变）
    const trBtn = e.target.closest('[data-world-travel]')
    if (trBtn && !trBtn.disabled) {
      const wsys = getWorld()
      if (!wsys || typeof wsys.useTravel !== 'function') {
        H.pushLog('世界系统未接线，暂时无法换界。', 'info')
        return
      }
      const parts = String(trBtn.dataset.worldTravel || '').split(':')
      const kind = parts[0]
      const action = parts[1]
      if (action === 'buy') {
        const res = wsys.buyTravel(kind)
        H.pushLog(res.message, res.ok ? 'ok' : 'info')
        if (res.ok && H.persist) H.persist('world-travel-buy')
      } else if (action === 'use') {
        if (kind === 'talisman' && !pendingSwap) {
          // 换界不可逆（熟练度清零）→ 面板内二次确认（复用同一闭包标志，不引新宿主）
          pendingSwap = true
          H.pushLog('再点一次「确 认 换 界」即生效：熟练度将清零、专属机制状态重置（招牌首通与积分保留）。', 'info')
        } else {
          pendingSwap = false
          const before = (st && st.resources) ? (st.resources.stones | 0) : 0
          const res = wsys.useTravel(kind)
          H.pushLog(res.message, res.ok ? 'ok' : 'info')
          if (res.ok) {
            if (res.giftStones && H.noteWorld && st && st.resources) {
              H.noteWorld({ stones: (st.resources.stones | 0) - before })
            }
            if (H.persist) H.persist('world-travel-use')
            if (H.emitFloat) {
              if (res.giftMat) H.emitFloat({ text: `界游之礼：${esc(res.giftMat.n)} 份材料入库`, kind: 'ok' }, 200)
              else if (res.giftStones) H.emitFloat({ text: `界游之礼：灵石 +${H.fmt(res.giftStones)}`, kind: 'info' })
            }
          }
        }
      }
      render()
      return
    }
    if (!system) return
    const actBtn = e.target.closest('[data-world-act]')
    if (actBtn && !actBtn.disabled) {
      const before = st ? (st.resources.stones | 0) : 0
      const res = system.doAct(actBtn.dataset.worldAct)
      H.pushLog(res.message, res.ok ? 'ok' : (res.failed ? 'fail' : 'info'))
      if (res.ok) {
        if (H.noteWorld) H.noteWorld({ stones: (st.resources.stones | 0) - before })
        if (H.persist) H.persist('world-mech')
        if (res.mats && res.mats.length && H.emitFloat) {
          H.emitFloat({ text: res.mats.map((m) => `${m.n} 份材料入库`).join(' · '), kind: 'ok' }, 200)
        } else if (res.gainStones > 0 && H.emitFloat) {
          H.emitFloat({ text: `灵石 +${H.fmt(res.gainStones)}`, kind: 'info' })
        }
      }
      render()
      return
    }
    const tg = e.target.closest('[data-world-toggle]')
    if (tg && !tg.disabled && tg.dataset.worldToggle === 'tribute') {
      const res = system.setTribute(!system.tributeOn)
      H.pushLog(res.message, res.ok ? 'ok' : 'info')
      if (res.ok && res.changed && H.persist) H.persist('world-tribute')
      render()
    }
  })

  return { open, close, toggle, render }
}
