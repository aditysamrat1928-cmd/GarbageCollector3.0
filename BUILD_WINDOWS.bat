@echo off
title Garbage Collector - Windows Build
echo ==========================================
echo   GARBAGE COLLECTOR 2.0 - WINDOWS BUILD
echo ==========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js 22 LTS and run this file again.
  pause
  exit /b 1
)
echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
echo Building Windows installer and portable EXE...
call npm run dist:win
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo BUILD COMPLETE. Check the dist folder.
pause
