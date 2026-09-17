/**
 * electron/main.js —— Electron 主进程（壳层）
 * ═══════════════════════════════════════════════════════════════════════════
 * 边界（项目文件结构 §三）：主进程只管窗口 / 托盘 / 生命周期 / **存档文件读写**，
 *                           **不含任何游戏逻辑与数值公式**。
 *
 * 关键行为：
 *   · 无边框 + 透明 + 始终置顶 + 默认右下角 420×320（可拖拽缩放、位置记忆）
 *   · 窗口三态（真源在主进程，渲染层/托盘菜单/快捷键共用）：
 *       置顶 alwaysOnTop ｜ 鼠标穿透 clickThrough ｜ 锁定位置 lockPosition
 *     穿透 = 整窗不接收点击（setIgnoreMouseEvents + forward），顶部热区与 Ctrl+Alt+Q 可恢复
 *   · 关闭 = 隐藏到托盘（不退出，游戏继续）
 *   · 托盘菜单：显示/隐藏小窗、回到右下角、显示存档文件夹、三态勾选、退出
 *   · 单实例锁：重复启动只唤起已有小窗
 *   · 隐藏/显示/退出前后，向渲染层发送时间点事件，用于离线收益结算
 *   · 存档落盘：userData/save.json（原子写 + .bak 滚动备份）+ 导出/导入对话框
 *
 * 兼容开关：启动加 --no-gpu 可禁用硬件加速（个别 Windows 环境透明窗口发黑时的兜底方案）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog, shell, globalShortcut } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const WIN_W = 420
// 主人口径（2026-09-17 / 09-18）：修行日志区要露满 10 行、并且它是全部内容遮罩的宿主
// （背包 / 功法 / 宗门等都要在这块里完整展示），窗口需要足够高度才放得下立绘；
// 旧档若记着低于 PREFERRED_H 的高度，启动时补到 WIN_H（可用性下限）。
const WIN_H = 720
const MIN_W = 380
const MIN_H = 300
const PREFERRED_H = 620
const EDGE_MARGIN = 12

const isDev = !app.isPackaged

// 透明窗口兜底：--no-gpu 时禁用硬件加速（必须在 app ready 之前调用）
if (process.argv.includes('--no-gpu')) {
  app.disableHardwareAcceleration()
}

let win = null
let tray = null
let isQuitting = false
let quitTimer = null

// ── 窗口三态：置顶 / 鼠标穿透 / 锁定位置 ─────────────────────────────────
// 真源在此处（主进程），渲染层只负责"落档 + 画按钮"，托盘菜单与快捷键共用同一份状态。
// 鼠标穿透：整窗不再接收点击（"看得到、点不到"），但 forward:true 仍把 mouse move
//           转发给渲染层，于是顶部热区能感知"鼠标回来了"并临时关掉穿透。
const winState = { alwaysOnTop: true, clickThrough: false, lockPosition: false }

function applyWinState (patch = {}) {
  if (patch && typeof patch === 'object') {
    if (typeof patch.alwaysOnTop === 'boolean') winState.alwaysOnTop = patch.alwaysOnTop
    if (typeof patch.clickThrough === 'boolean') winState.clickThrough = patch.clickThrough
    if (typeof patch.lockPosition === 'boolean') winState.lockPosition = patch.lockPosition
  }
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(winState.alwaysOnTop)
    win.setIgnoreMouseEvents(winState.clickThrough, { forward: true })
    win.webContents.send('window-state', { ...winState })
  }
  refreshTrayMenu()
  console.log(`[win] 置顶=${winState.alwaysOnTop} 穿透=${winState.clickThrough} 锁定=${winState.lockPosition}`)
  return { ...winState }
}

// ── 图标 ─────────────────────────────────────────────────────────────────
// 由 scripts/gen_icon.py 生成；用 fs 读取后 createFromBuffer —— Node 的 fs 对 asar 有原生支持，
// 比 createFromPath 更稳（不会因打包成 asar 而读不到）。绝不再把图标以长 base64 内嵌进源码。
function loadIcon (file) {
  const p = path.join(__dirname, '..', 'assets', file)
  try {
    const img = nativeImage.createFromBuffer(fs.readFileSync(p))
    if (!img.isEmpty()) return img
    console.warn('[icon] 解码为空：', p)
  } catch (err) {
    console.warn('[icon] 读取失败：', p, err && err.message)
  }
  return null
}

// ── 窗口几何 ──────────────────────────────────────────────────────────────

function boundsFile () {
  return path.join(app.getPath('userData'), 'window-bounds.json')
}

function cornerBounds () {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    width: WIN_W,
    height: WIN_H,
    x: Math.round(workArea.x + workArea.width - WIN_W - EDGE_MARGIN),
    y: Math.round(workArea.y + workArea.height - WIN_H - EDGE_MARGIN)
  }
}

/** 把矩形夹回"最近的显示器"工作区（多屏拔插 / 分辨率变化后的兜底，不丢到屏幕外） */
function clampToWorkArea (b) {
  const displays = screen.getAllDisplays()
  if (!displays.length) return b
  let best = displays[0]
  let bestDist = Infinity
  for (const d of displays) {
    const wa = d.workArea
    const cx = b.x + (b.width || WIN_W) / 2
    const cy = b.y + (b.height || WIN_H) / 2
    const dx = Math.max(wa.x - cx, 0, cx - (wa.x + wa.width))
    const dy = Math.max(wa.y - cy, 0, cy - (wa.y + wa.height))
    const dist = dx * dx + dy * dy
    if (dist < bestDist) { bestDist = dist; best = d }
  }
  const wa = best.workArea
  const width = Math.round(Math.min(Math.max(b.width || WIN_W, MIN_W), wa.width))
  const height = Math.round(Math.min(Math.max(b.height || WIN_H, MIN_H), wa.height))
  return {
    width,
    height,
    x: Math.round(Math.min(Math.max(b.x, wa.x), wa.x + wa.width - width)),
    y: Math.round(Math.min(Math.max(b.y, wa.y), wa.y + wa.height - height))
  }
}

/**
 * 位置记忆（主人 2026-09-18 要求：下次打开就显示在上次关闭的位置）
 *   · 读：window-bounds.json → 夹回工作区（屏拔了也不会丢到看不见的地方）
 *   · 写：移动/缩放过程中节流落盘 + 事件结束各落一次 + 隐藏/退出前再落一次，
 *         这样"拖到一半被强杀"也不丢位置。
 */
function loadBounds () {
  try {
    const raw = fs.readFileSync(boundsFile(), 'utf8')
    const b = JSON.parse(raw)
    if (typeof b.x !== 'number' || typeof b.y !== 'number') return null
    const width = Math.max(b.width || WIN_W, MIN_W)
    // 旧档记着"矮窗"（320 / 560 那两版）时补到当前默认高度（可用性下限）
    let height = Math.max(b.height || WIN_H, MIN_H)
    if (height < PREFERRED_H) height = WIN_H
    return clampToWorkArea({ ...b, width, height })
  } catch (_) { /* 无记忆位置：用默认右下角 */ }
  return null
}

/** 位置记忆的兜底校验：多屏拔插后保证小窗仍在可见工作区内 */
function isOnScreen (b) {
  return screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return b.x < wa.x + wa.width - 40 && b.x + 40 > wa.x && b.y < wa.y + wa.height - 40 && b.y + 40 > wa.y
  })
}

function saveBounds () {
  if (!win || win.isDestroyed() || win.isMinimized()) return
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify(win.getBounds()), 'utf8')
  } catch (_) { /* 位置记忆失败不影响运行 */ }
}

let boundsTimer = null
/** 移动/缩放**进行中**的节流落盘（300ms），拖到一半被强杀也不丢位置 */
function scheduleBoundsSave () {
  if (boundsTimer) return
  boundsTimer = setTimeout(() => { boundsTimer = null; saveBounds() }, 300)
}

// ── 存档文件（save.json 唯一真源）──────────────────────────────────────────

function saveFilePath () {
  return path.join(app.getPath('userData'), 'save.json')
}

function backupFilePath () {
  return path.join(app.getPath('userData'), 'save.bak')
}

function readSave () {
  const target = saveFilePath()
  try {
    if (!fs.existsSync(target)) return { ok: true, data: null, path: target }
    return { ok: true, data: fs.readFileSync(target, 'utf8'), path: target }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err), path: target }
  }
}

/** 写档：先把现有档转存 .bak，再写 .tmp 后 rename（原子写，断电也不会留下半截文件） */
function writeSave (json) {
  const target = saveFilePath()
  const tmp = target + '.tmp'
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (fs.existsSync(target)) {
      try { fs.copyFileSync(target, backupFilePath()) } catch (_) { /* 备份失败不阻塞写档 */ }
    }
    fs.writeFileSync(tmp, json, 'utf8')
    fs.renameSync(tmp, target)
    return { ok: true, path: target, bytes: Buffer.byteLength(json, 'utf8') }
  } catch (err) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch (_) {}
    return { ok: false, error: String(err && err.message || err) }
  }
}

function saveInfo () {
  const target = saveFilePath()
  const bak = backupFilePath()
  const stat = (p) => { try { return { exists: true, size: fs.statSync(p).size, mtime: fs.statSync(p).mtimeMs } } catch (_) { return { exists: false } } }
  return { dir: path.dirname(target), path: target, backupPath: bak, save: stat(target), backup: stat(bak) }
}

function stamp () {
  const d = new Date()
  const p = (v) => String(v).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

async function exportSave (json) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '导出存档',
    defaultPath: `问长生-备份-${stamp()}.json`,
    filters: [{ name: '问长生存档', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }
  try {
    fs.writeFileSync(filePath, json, 'utf8')
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
}

async function importSave () {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '导入存档（会覆盖当前进度，原档自动转存 .bak）',
    properties: ['openFile'],
    filters: [{ name: '问长生存档', extensions: ['json'] }]
  })
  if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true }
  try {
    const data = fs.readFileSync(filePaths[0], 'utf8')
    JSON.parse(data) // 先校验是合法 JSON，避免把坏档写进去
    const res = writeSave(data)
    if (!res.ok) return res
    return { ok: true, data, path: filePaths[0] }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
}

/** 从 save.bak 恢复（当前进度先另存 .before-restore，避免"恢复"变成"数据丢掉"） */
function restoreSaveBackup () {
  const bak = backupFilePath()
  if (!fs.existsSync(bak)) return { ok: false, error: '尚无备份档（写档一次后才会产生）' }
  try {
    const data = fs.readFileSync(bak, 'utf8')
    JSON.parse(data) // 备份也要先验
    const cur = saveFilePath()
    if (fs.existsSync(cur)) {
      try { fs.copyFileSync(cur, cur + '.before-restore') } catch (_) { /* 留痕失败不阻塞 */ }
    }
    const res = writeSave(data)
    if (!res.ok) return res
    return { ok: true, data, from: bak }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) }
  }
}

// ── 窗口 ──────────────────────────────────────────────────────────────────

function createWindow () {
  const bounds = loadBounds() || cornerBounds()
  const appIcon = loadIcon('icon.png')

  win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_W,
    minHeight: MIN_H,
    ...(appIcon ? { icon: appIcon } : {}),
    frame: false,                 // 无边框
    transparent: true,            // 透明背景，与桌面融合
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,            // 桌面小窗不进任务栏（托盘常驻）
    alwaysOnTop: winState.alwaysOnTop,
    show: false,
    acceptFirstMouse: true,
    title: '问长生',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false // 隐藏到托盘后计时器不被节流
    }
  })

  win.setAlwaysOnTop(winState.alwaysOnTop)

  // 关闭 = 隐藏到托盘（只有主动退出才真正关闭）
  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    saveBounds()      // 隐到托盘前先把位置落下（下次显示 / 下次启动都用它）
    hideWindow()
  })

  // 位置记忆：进行中节流 + 结束落一次 + 隐藏前再落一次（主人 2026-09-18）
  win.on('move', scheduleBoundsSave)
  win.on('resize', scheduleBoundsSave)
  win.on('moved', saveBounds)
  win.on('resized', saveBounds)
  win.on('hide', saveBounds)

  win.once('ready-to-show', () => {
    win.show()
    isOnScreen(win.getBounds()) || moveToCorner()
    applyWinState()   // 渲染层就绪：把三态同步过去（托盘勾选也随之刷新）
  })

  // 开发期：F12 打开 DevTools（正式包不开放）
  if (isDev) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
    })
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function showWindow () {
  if (!win || win.isDestroyed()) return
  win.show()
  win.setAlwaysOnTop(winState.alwaysOnTop)
  win.focus()
  // 通知渲染层"回来了"：由渲染层结算离线收益
  win.webContents.send('window-shown')
  refreshTrayMenu()
}

function hideWindow () {
  if (!win || win.isDestroyed()) return
  // 先通知渲染层"要走了"（记录离开时间点），再隐藏
  win.webContents.send('window-hidden')
  win.hide()
  refreshTrayMenu()
}

function toggleWindow () {
  if (!win || win.isDestroyed()) return
  if (win.isVisible()) hideWindow()
  else showWindow()
}

function moveToCorner () {
  if (!win || win.isDestroyed()) return
  const b = cornerBounds()
  win.setBounds({ x: b.x, y: b.y, width: Math.max(win.getBounds().width, MIN_W), height: Math.max(win.getBounds().height, MIN_H) })
  saveBounds()
}

// ── 托盘 ──────────────────────────────────────────────────────────────────

function refreshTrayMenu () {
  if (!tray) return
  const visible = !!win && !win.isDestroyed() && win.isVisible()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? '隐藏小窗' : '显示小窗', click: toggleWindow },
    { label: '回到右下角', click: moveToCorner },
    { label: '显示存档文件夹', click: () => shell.showItemInFolder(saveFilePath()) },
    { type: 'separator' },
    { label: '窗口置顶', type: 'checkbox', checked: winState.alwaysOnTop, click: (mi) => applyWinState({ alwaysOnTop: mi.checked }) },
    { label: '鼠标穿透（Ctrl+Alt+Q）', type: 'checkbox', checked: winState.clickThrough, click: (mi) => applyWinState({ clickThrough: mi.checked }) },
    { label: '锁定位置', type: 'checkbox', checked: winState.lockPosition, click: (mi) => applyWinState({ lockPosition: mi.checked }) },
    { type: 'separator' },
    { label: '退出', click: quitApp }
  ]))
}

/** 全局快捷键：鼠标穿透的唯一"紧急出口"（穿透后窗口点不到，快捷键盘外可用） */
function registerShortcuts () {
  const ok = globalShortcut.register('CommandOrControl+Alt+Q', () => {
    applyWinState({ clickThrough: !winState.clickThrough })
    if (win && !win.isDestroyed() && !win.isVisible()) showWindow()
  })
  console.log(`[shortcut] Ctrl+Alt+Q 切换鼠标穿透：${ok ? '注册成功' : '注册失败（可能被其他程序占用，可用托盘菜单切换）'}`)
}

function createTray () {
  const img = loadIcon('tray.png')
  if (!img) {
    console.error('[tray] 图标加载失败，托盘将不可见——请重跑 scripts/gen_icon.py 生成 assets/tray.png')
    return
  }
  tray = new Tray(img)
  console.log('[tray] 图标已加载 size=' + JSON.stringify(img.getSize()) + ' empty=' + img.isEmpty())
  tray.setToolTip('问长生 · 挂机修仙（双击显示/隐藏）')
  tray.on('click', toggleWindow)
  tray.on('double-click', toggleWindow)
  refreshTrayMenu()
}

// ── 退出（给渲染层最后一次存档机会）──────────────────────────────────────

function quitApp () {
  if (isQuitting) return
  isQuitting = true
  saveBounds()

  if (win && !win.isDestroyed()) {
    win.webContents.send('app-before-quit')
    // 兜底：渲染层 700ms 内未确认也照常退出
    quitTimer = setTimeout(() => app.quit(), 700)
  } else {
    app.quit()
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────

ipcMain.on('window-hide', () => hideWindow())
ipcMain.on('app-quit-ready', () => {
  if (quitTimer) clearTimeout(quitTimer)
  app.quit()
})

ipcMain.handle('save:read', () => readSave())
ipcMain.handle('save:write', (_e, json) => writeSave(json))
ipcMain.handle('save:info', () => saveInfo())
ipcMain.handle('save:export', (_e, json) => exportSave(json))
ipcMain.handle('save:import', () => importSave())
ipcMain.handle('save:restore-backup', () => restoreSaveBackup())
ipcMain.handle('save:reveal', () => {
  shell.showItemInFolder(saveFilePath())
  return { ok: true }
})
ipcMain.handle('window:set-always-on-top', (_e, value) => {
  const s = applyWinState({ alwaysOnTop: !!value })
  return { ok: true, value: s.alwaysOnTop }
})
ipcMain.handle('window:get-always-on-top', () => ({ ok: true, value: winState.alwaysOnTop }))
ipcMain.handle('window:get-state', () => ({ ok: true, state: { ...winState } }))
ipcMain.handle('window:set-state', (_e, patch) => ({ ok: true, state: applyWinState(patch) }))
// 穿透期间热区放行：只临时改 ignore，不动 winState（否则设置会被"路过鼠标"改掉）
ipcMain.handle('window:ignore-mouse-now', (_e, ignore) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore, { forward: true })
  return { ok: true, ignore: !!ignore }
})

// ── 生命周期 ──────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())

  app.whenReady().then(() => {
    createWindow()
    createTray()
    registerShortcuts()
    app.on('activate', () => showWindow())
  })

  app.on('before-quit', () => {
    isQuitting = true
    saveBounds()
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())

  // 常驻托盘：窗口全关也不退出
  app.on('window-all-closed', () => { /* 保持进程存活 */ })
}
