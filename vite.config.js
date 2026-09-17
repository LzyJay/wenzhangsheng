// vite.config.js —— 构建配置（渲染层 Vite + 主进程/预加载 vite-plugin-electron）
// 职责：一条构建链同时产出 dist/（渲染层）与 dist-electron/（主进程 + 预加载）。
// 注意：main/preload 强制输出 CJS —— Electron 主进程按 CommonJS 加载最稳（本项目不使用 TypeScript）。

import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'

export default defineConfig({
  // 打包后 Electron 以 file:// 加载 dist/index.html，资源必须用相对路径
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 小窗应用，不做代码分割，减少运行期请求
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  plugins: [
    electron([
      {
        // ── 主进程 ──────────────────────────────────────────────
        entry: 'electron/main.js',
        onstart ({ startup }) {
          // 首次启动 / 主进程改动后重启 Electron
          startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
            emptyOutDir: false,
            rollupOptions: { output: { format: 'cjs', entryFileNames: 'main.js' } }
          }
        }
      },
      {
        // ── 预加载脚本（contextBridge 出口）─────────────────────
        entry: 'electron/preload.js',
        onstart ({ reload }) {
          // 预加载改动只需刷新渲染层
          reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
            emptyOutDir: false,
            rollupOptions: { output: { format: 'cjs', entryFileNames: 'preload.js' } }
          }
        }
      }
    ])
  ]
})
