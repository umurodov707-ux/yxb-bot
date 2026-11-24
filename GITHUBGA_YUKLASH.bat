@echo off
cd /d "%~dp0"
echo ===================================================
echo Xodimlar tashlagan rasmlar va xabarlarni
echo Mini App Lentasida (birinchi bo'limda) ko'rsatish...
echo ===================================================

git config --global --add safe.directory "%~dp0"
git add .
git commit -m "Set Chat/Lenta as the primary first tab in Admin Mini App"
git push origin main

echo.
echo ===================================================
echo Muvaffaqiyatli yuklandi! Render 30 soniyada o'rnatadi.
echo ===================================================
pause
