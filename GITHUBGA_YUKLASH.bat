@echo off
cd /d "%~dp0"
echo ===================================================
echo Yangi ariza kelganda adminga bot orqali
echo [Tasdiqlash / Rad etish] tugmalarini yuklash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Auto-notify admin on Telegram with approve/reject inline buttons on new registration"
git push origin main

echo.
echo ===================================================
echo Muvaffaqiyatli GitHubga yuklandi!
echo Render 1 daqiqada yangi sozlamani yoqadi.
echo ===================================================
pause
