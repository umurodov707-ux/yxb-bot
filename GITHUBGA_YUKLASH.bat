@echo off
cd /d "%~dp0"
echo ===================================================
echo Xatolikni to'liq tuzatib GitHubga yuklash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Fix async relationship loading error on user.department"
git push origin main

echo.
echo ===================================================
echo Yuklandi! Render 30 soniyada yangilaydi.
echo ===================================================
pause
