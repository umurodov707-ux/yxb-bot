@echo off
chcp 65001 > nul
title YXB Bot

echo.
echo  ========================================
echo    YXB Bot - Ishga tushirilmoqda...
echo  ========================================
echo.

cd /d "%~dp0"

REM 1. Cloudflare Tunnel (yangi oynada)
echo  [1] Cloudflare Tunnel ishga tushirilmoqda...
start "Cloudflare Tunnel" cmd /k "cd /d "%~dp0" && cloudflared.exe tunnel --url http://localhost:8000"

REM 2 soniya kut
timeout /t 2 /nobreak > nul

REM 2. FastAPI Server + Bot (shu oynada)
echo  [2] FastAPI Server + Telegram Bot...
echo.
echo  ========================================
echo   Server: http://localhost:8000
echo   Docs:   http://localhost:8000/docs
echo.
echo   Cloudflare Tunnel oynasidagi https://
echo   manzilni backend\.env faylida
echo   WEBAPP_URL= ga kiriting!
echo  ========================================
echo.

cd /d "%~dp0backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
