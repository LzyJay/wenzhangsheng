@echo off
rem 问长生 · 带 CDP 调试端口启动（自动化真机烟测用；主人日常验收请用 launch.cmd）
rem   端口 9229 与 tests/V2整合版-CDP烟测.mjs 一致；9222 给 V2.2-CDP 用。
rem   用法：scripts\launch-debug.cmd  →  再跑 node tests\V2整合版-CDP烟测.mjs
call "%~dp0launch.cmd" --remote-debugging-port=9229
