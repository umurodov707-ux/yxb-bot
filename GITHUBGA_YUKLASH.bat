@echo off
cd /d "%~dp0"
echo ===================================================
echo Broadcast va xabar yuborishni to'g'irlash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Fix record relationship serialization on broadcast"
git push origin main

echo.
echo ===================================================
echo Muvaffaqiyatli yuklandi! Render 30 soniyada o'rnatadi.
echo ===================================================
pause
