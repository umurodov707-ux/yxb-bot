@echo off
cd /d "%~dp0"
echo ===================================================
echo Frontend fayllarini GitHubga yuklash...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Include built frontend static files"
git push origin main

echo.
echo Tayyor!
pause
