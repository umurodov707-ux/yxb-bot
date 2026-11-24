@echo off
cd /d "%~dp0"
echo ===================================================
echo Xatolikni to'liq bartaraf etish va yuklash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Fix 500 error in auth/me by safe UserOut instantiation and optional created_at"
git push origin main

echo.
echo ===================================================
echo Yuklandi! Render 30 soniyada o'rnatadi.
echo ===================================================
pause
