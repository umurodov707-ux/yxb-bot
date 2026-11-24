@echo off
cd /d "%~dp0"
echo ===================================================
echo Telegram Desktopda 100%% ishlashini ta'minlash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Full Telegram Desktop support: auto-authenticate and unblock all endpoints"
git push origin main

echo.
echo ===================================================
echo Muvaffaqiyatli yuklandi! Render 30 soniyada yangilaydi.
echo ===================================================
pause
