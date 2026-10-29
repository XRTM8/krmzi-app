@echo off
title Krmzi Pro - Running
cd /d "%~dp0"
echo ========================================================
echo    KRMZI PRO - جاري تشغيل التطبيق بدون اعلانات
echo ========================================================
echo.
start http://localhost:3000
node server.js
pause
