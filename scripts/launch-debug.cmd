@echo off
rem 问长生 · 带 CDP 调试端口启动（自动化真机烟测用；主人日常验收请用 launch.cmd）
rem   端口 9229 供自动化烟测使用；9222 留作备用。
rem   用法：scripts\launch-debug.cmd  →  再用任意 CDP 客户端连 127.0.0.1:9229
call "%~dp0launch.cmd" --remote-debugging-port=9229
