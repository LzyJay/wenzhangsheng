@echo off
rem ═══════════════════════════════════════════════════════════════════════════
rem 问长生 · 启动实机窗口（主人验收用）
rem   用途：改完代码后把能点能跑的小窗直接拉起来，交主人过目；
rem         交付默认走这一条，而不是直接打包 exe（需要安装包时再 npm run dist）。
rem   两个环境坑（均已在文档 §九 入库）：
rem     ① ELECTRON_RUN_AS_NODE=1 会让 Electron 当成 node 秒崩 → 这里清掉；
rem     ② 自动化沙箱的作业对象会连带杀掉 Electron → 用 start 脱离作业对象。
rem   前置：dist/ 与 dist-electron/ 已由 `npm run build` 生成（electron 加载 dist/index.html）。
rem   ⚠ 构建环境坑（2026-09-18 实测入库）：`npm run build` 必须用 node 20 跑 ——
rem     node 22.22.2 下 vite 5.4.21 的内联样式代理会崩（No matching HTML proxy module found）；
rem     node 20.18 正常。CDP 自测则相反：要 node 22（node 20 无全局 WebSocket）。
rem ═══════════════════════════════════════════════════════════════════════════
setlocal
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0.."

if not exist "dist\index.html" (
  echo [launch] 缺少 dist\index.html —— 请先执行:  npm run build
  exit /b 1
)
if not exist "dist-electron\main.js" (
  echo [launch] 缺少 dist-electron\main.js —— 请先执行:  npm run build
  exit /b 1
)

rem 额外参数原样透传（例：launch.cmd --remote-debugging-port=9229 供 CDP 真机烟测连）
start "" "%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0.." %*
echo [launch] 已启动问长生窗口（右下角 420x720；关闭窗口 = 缩托盘继续挂机）
exit /b 0
