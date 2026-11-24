@echo off
chcp 65001 > nul
title YXB Bot
cd /d "%~dp0"

REM Eski server nusxalarini to'xtatish (port 8000)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do taskkill /PID %%p /F > nul 2>&1
taskkill /IM cloudflared.exe /F > nul 2>&1

python start.py
pause
