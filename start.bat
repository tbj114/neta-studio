@echo off
chcp 65001 >nul 2>&1
title Nieta Studio (纯前端)
color 0A

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     Nieta Studio - 纯前端版                     ║
echo ║     无需 Python 后端，直接打开 index.html        ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: 直接用浏览器打开 index.html
start "" "%~dp0index.html"

echo 已打开！
echo.
echo 如果没有自动打开，请手动打开 index.html
echo.
pause
