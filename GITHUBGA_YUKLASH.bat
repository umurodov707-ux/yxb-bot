@echo off
cd /d "%~dp0"
echo ===================================================
echo Yangi dizayn va rasmiy logoni serverga yuklash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Update modern design with official Temiryo'linfratuzilma logo and proper department grouping"
git push origin main

echo.
echo ===================================================
echo Muvaffaqiyatli yuklandi! 
echo Render 1 daqiqada yangi dizaynni botga chiqaradi.
echo ===================================================
pause
