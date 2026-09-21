/**
 * GmPanel.js —— GM 控制台（#gm-overlay）（V6.2 · 开发者工具）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（src/ui/ 层）：只碰本面板自己的 DOM；world / roots 与装配层工具经 createGmPanel(ctx) 注入，
 *   禁止 import systems；纯数据层可 import（当前用 data/worlds.js 的 WORLDS 列 12 界卡片）。
 *
 * 用途（主人 2026-09-21：想真机看分界事件池与灵根分池）：
 *   ① **自选世界开局** —— 未抽定走 WorldSystem.assign（合法抽界，不动免费重掷次数）；
 *      已抽定走 WorldSystem.changeWorld（**原子换界**：熟练度清零 + 专属机制两叶重置），面板内二次确认；
 *   ② **重测灵根** —— RootSystem.drawFirst（不计洗髓次数、不消耗洗髓丹，覆盖当前灵根）；
 *   ③ **立即触发一次随机事件** —— 装配层 helper `gmForceEvent()`，与主循环同走 EventSystem._trigger。
 *
 * 两条铁律：① 系统一律 getter 注入（防捕获旧引用）；② 委托回调内自行取 system。
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { WORLDS } from '../data/worlds.js'

export function createGmPanel (ctx) {
  const dom = ctx.dom
  const getState = ctx.state
  const getWorld = ctx.world
  const getRoots = ctx.roots
  const H = ctx.helpers
  if (!dom.gmOverlay) return null

  const esc = (s) => String(s == null ? '' : s)
  let pendingWorld = ''     // 已抽定世界时换界不可逆 → 二次确认（只用一个闭包标志，不引新宿主）

  function worldRowHtml (w, curId) {
    const isCur = w.id === curId
    const confirm = pendingWorld === w.id
    const label = isCur ? '当前界' : (confirm ? '确认换到此界' : (curId ? '换到此界' : '以此界开局'))
    return '<div class="dungeon-row">' +
      `<span class="dn">${esc(w.name)}</span>` +
      '<span class="dd">' +
      `${esc(w.proto)} · ${esc(w.tag)}　产出 ×${w.rateMul.toFixed(2)}` +
      '<span class="dbtns">' +
      `<button class="d-btn" data-gm-world="${esc(w.id)}"${isCur ? ' disabled' : ''}>${label}</button>` +
      '</span>' +
      (confirm ? '　<span class="world-d-tax">⚠ 再点一次即生效：熟练度清零、专属机制状态重置（招牌首通保留）</span>' : '') +
      '</span></div>'
  }

  function render () {
    const st = getState()
    if (!st) return
    const curId = (st.world && typeof st.world.worldId === 'string') ? st.world.worldId : null
    const cur = curId ? WORLDS.find((x) => x.id === curId) : null

    if (dom.gmHead) dom.gmHead.textContent = cur ? `本世 · ${cur.name}` : '尚未抽定世界'

    if (dom.gmWorlds) {
      dom.gmWorlds.innerHTML =
        '<div class="dungeon-row"><span class="dn">世界 · 自选开局</span><span class="dd">' +
        (cur
          ? `当前：<b>${esc(cur.name)}</b>（${esc(cur.proto)} · ${esc(cur.tag)}）。点「换到此界」为<b>原子换界</b>：熟练度清零、专属机制状态重置。`
          : '尚未抽定世界。点任一界即<b>以此界开局</b>（等于指定抽界，不动免费重掷次数）。') +
        '</span></div>' +
        WORLDS.map((w) => worldRowHtml(w, curId)).join('')
    }

    if (dom.gmNote) {
      const st0 = getState()
      const ascended = !!(st0 && st0.player.flags && st0.player.flags.ascended)
      dom.gmNote.innerHTML =
        '<div class="dbtns">' +
        '<button class="d-btn" data-gm-act="reroll-root">重 测 灵 根</button>' +
        '<button class="d-btn" data-gm-act="force-event">立即触发一次事件</button>' +
        `<button class="d-btn" data-gm-act="ascend">${ascended ? '取消飞升标记' : '模 拟 飞 升'}</button>` +
        '</div>' +
        'GM 工具仅供开发验收：自选世界用于对照各界的<b>专属随机事件池</b>与<b>开局灵根池</b>；' +
        '「立即触发一次事件」按当前气运档位真抽一条（绝/仙级会入事件簿等你亲断）。' +
        '灵根重测不消耗洗髓丹、不计洗髓次数（会覆盖当前灵根）。' +
        '「模拟飞升」把境界置 72 并标记已飞升 —— 用于验收<b>本世终局演出与转世</b>（再点一次取消标记）。' +
        '快捷键 <b>Ctrl+Shift+G</b>。'
    }
  }

  /** 世界变更后：交给装配层刷新（世界徽记 / 皮肤 / 主渲染），本面板只补自己的渲染 */
  function afterWorldChange () {
    if (H.gmAfterWorld) H.gmAfterWorld()
    render()
  }

  function applyWorld (wid) {
    const world = getWorld()
    if (!world) return
    if (!world.drawn) {                       // 未抽定：合法指定抽界
      const r = world.assign(wid)
      H.pushLog(r.ok ? `【GM】以此界开局：${r.world.name}` : r.message, r.ok ? 'ok' : 'fail')
      pendingWorld = ''
      afterWorldChange()
      return
    }
    if (pendingWorld !== wid) {               // 第一次点：只挂确认，不生效
      pendingWorld = wid
      H.pushLog('【GM】再点一次同一界即确认换界（熟练度清零 · 专属机制状态重置）', 'info')
      render()
      return
    }
    const r = world.changeWorld(wid)          // 第二次点：原子换界
    H.pushLog(r.ok ? `【GM】换界：${r.world.name}（熟练度已清零）` : r.message, r.ok ? 'ok' : 'fail')
    pendingWorld = ''
    afterWorldChange()
  }

  function rerollRoot () {
    const roots = getRoots()
    if (!roots) return
    const r = roots.drawFirst()
    H.pushLog(`【GM】灵根重测：${r.displayName}（不消耗洗髓丹）`, 'ok')
    if (H.gmAfterRoot) H.gmAfterRoot()
    render()
  }

  function forceEvent () {
    const out = H.gmForceEvent ? H.gmForceEvent() : []
    if (!out || !out.length) H.pushLog('【GM】本次未触发（概率未命中，可再点一次）', 'info')
    render()
  }

  /** V6.8 批 F：模拟飞升（验收本世终局演出与转世用；只动 flags 与等级，不改任何数值口径） */
  function toggleAscend () {
    const st = getState()
    if (!st || !st.player) return
    if (!st.player.flags || typeof st.player.flags !== 'object') st.player.flags = {}
    const on = !st.player.flags.ascended
    if (on) {
      st.player.flags.ascended = true
      st.player.flags.firstTrialDone = true
      H.pushLog('【GM】模拟飞升：已标记飞升 —— 打开「渡劫」面板可见本世终局与转世入口。', 'ok')
    } else {
      delete st.player.flags.ascended
      H.pushLog('【GM】已取消飞升标记，可继续正常突破。', 'info')
    }
    if (H.gmAfterAscend) H.gmAfterAscend()
    render()
  }

  if (dom.gmWorlds) {
    dom.gmWorlds.addEventListener('click', (ev) => {
      const t = ev.target
      if (t && t.dataset && t.dataset.gmWorld) applyWorld(t.dataset.gmWorld)
    })
  }
  if (dom.gmNote) {
    dom.gmNote.addEventListener('click', (ev) => {
      const t = ev.target
      if (!t || !t.dataset || !t.dataset.gmAct) return
      if (t.dataset.gmAct === 'reroll-root') rerollRoot()
      else if (t.dataset.gmAct === 'force-event') forceEvent()
      else if (t.dataset.gmAct === 'ascend') toggleAscend()
    })
  }
  if (dom.btnGmClose) {
    dom.btnGmClose.addEventListener('click', () => {
      close()
    })
  }

  function open () {
    if (!getState()) return
    H.closeTip()
    H.closeAllOverlays('gm')
    render()
    // ⚠ 本遮罩**不在 .ov 家族**（照 #world-overlay 先例：`.ov` 计数钉保持 11），
    //   故不走 ovShow/ovHide（那两个含 .ov 转场与音效），自行 add/remove 'show'。
    if (dom.gmOverlay) dom.gmOverlay.classList.add('show')
    H.syncDragRegions()
  }

  function close () {
    if (dom.gmOverlay) dom.gmOverlay.classList.remove('show')
    H.syncDragRegions()
  }

  return { open, close, render }
}
