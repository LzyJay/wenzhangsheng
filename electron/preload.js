/**
 * electron/preload.js —— 预加载脚本（渲染层与主进程之间唯一的桥）
 * ═══════════════════════════════════════════════════════════════════════════
 * 安全基线：contextIsolation: true + nodeIntegration: false，
 *          只把「必要且最小」的能力通过 contextBridge 暴露为 window.desktop。
 * 浏览器开发模式（无 Electron）下 window.desktop 不存在，渲染层自动降级为 localStorage。
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron')

/** 订阅主进程事件，返回取消订阅函数 */
function subscribe (channel, callback) {
  if (typeof callback !== 'function') return () => {}
  const handler = () => callback()
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },

  // ── 主进程 → 渲染层：时间点通知（离线收益结算依赖这三个钩子）──────────
  onWindowHidden: (cb) => subscribe('window-hidden', cb),   // 刚被隐藏到托盘
  onWindowShown: (cb) => subscribe('window-shown', cb),     // 从托盘恢复显示
  onBeforeQuit: (cb) => subscribe('app-before-quit', cb),   // 即将退出

  // ── 渲染层 → 主进程 ────────────────────────────────────────────────────
  hide: () => ipcRenderer.send('window-hide'),        // 关闭按钮 = 隐藏到托盘
  quitReady: () => ipcRenderer.send('app-quit-ready'), // 存档完成，可以退出了

  // ── 存档落盘（userData/save.json 唯一真源，主进程负责原子写 + .bak）──
  save: {
    read: () => ipcRenderer.invoke('save:read'),          // → { ok, data|null, path }
    write: (json) => ipcRenderer.invoke('save:write', json), // → { ok, path, bytes }
    info: () => ipcRenderer.invoke('save:info'),          // → { dir, path, backupPath, save, backup }
    export: (json) => ipcRenderer.invoke('save:export', json), // 弹出另存为 → { ok, path }
    import: () => ipcRenderer.invoke('save:import'),      // 弹出打开 → { ok, data, path }
    restoreBackup: () => ipcRenderer.invoke('save:restore-backup'), // 从 .bak 恢复
    reveal: () => ipcRenderer.invoke('save:reveal')       // 在资源管理器中定位存档
  },

  // ── 窗口行为（顶栏三键 / 设置面板共用）────────────────────────────────
  // 三态：alwaysOnTop 置顶 ｜ clickThrough 鼠标穿透 ｜ lockPosition 锁定位置
  window: {
    getState: () => ipcRenderer.invoke('window:get-state'),                    // → { ok, state }
    setState: (patch) => ipcRenderer.invoke('window:set-state', patch),        // → { ok, state }
    /** 穿透生效期间：热区感知到鼠标靠近时临时放行（不改动 clickThrough 设置本身） */
    ignoreMouseNow: (ignore) => ipcRenderer.invoke('window:ignore-mouse-now', !!ignore),
    setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-always-on-top', value),
    getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
    onStateChanged: (cb) => subscribe('window-state', cb)                       // 托盘/快捷键改动时回调
  }
})
