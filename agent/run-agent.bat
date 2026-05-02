@echo off
:: ═══════════════════════════════════════════════════════════════
:: ReconAPM Agent — Windows Installer
:: ═══════════════════════════════════════════════════════════════
:: Run this on any Windows laptop/desktop on the LAN.
:: It will download the agent and run it.
::
:: Usage: run-agent.bat 192.168.1.50 staff@acme.com Staff@123
:: ═══════════════════════════════════════════════════════════════

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║         ReconAPM Agent - Windows Setup               ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

set SERVER_IP=%1
set USER_EMAIL=%2
set USER_PASS=%3

if "%SERVER_IP%"=="" (
  set /p SERVER_IP="Enter ReconAPM server IP (e.g., 192.168.1.50): "
)
if "%USER_EMAIL%"=="" (
  set /p USER_EMAIL="Enter your email: "
)
if "%USER_PASS%"=="" (
  set /p USER_PASS="Enter your password: "
)

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ Node.js is not installed.
  echo    Download from: https://nodejs.org/en/download/
  pause
  exit /b 1
)

echo ✅ Node.js found: 
node --version

:: Run agent
echo.
echo 🚀 Starting ReconAPM Agent...
echo    Server: http://%SERVER_IP%:4100
echo    User:   %USER_EMAIL%
echo.

node "%~dp0reconapm-agent.js" --server http://%SERVER_IP%:4100 --user %USER_EMAIL% --pass %USER_PASS%

pause
