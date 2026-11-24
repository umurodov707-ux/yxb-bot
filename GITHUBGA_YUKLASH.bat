@echo off
cd /d "%~dp0"
echo ===================================================
echo GitHubga yuklash boshlanmoqda...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git remote remove origin 2>nul
git remote add origin https://github.com/umurodov707-ux/yxb-bot.git
git branch -M main
git add .
git commit -m "Deploy YXB Bot"
git push -u origin main

echo.
echo Tayyor!
pause
