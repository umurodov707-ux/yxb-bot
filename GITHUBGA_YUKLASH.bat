@echo off
cd /d "%~dp0"
echo ===================================================
echo Admin profilini avtomatik faollashtirish...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Auto-create and grant admin status on startup"
git push origin main

echo.
echo ===================================================
echo Tayyor! Render 30 soniyada yangilaydi.
echo ===================================================
pause
