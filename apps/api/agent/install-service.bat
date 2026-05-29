@echo off
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — Windows Persistent Service Installer
:: ═══════════════════════════════════════════════════════════════
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║     Installing QS Discovery Agent Background Task    ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Ensure administrator privileges
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  This installer requires Administrative Privileges to register a system task.
    echo 🚀 Requesting administrator elevation...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set CORE_DIR=%~dp0core
if not exist "%CORE_DIR%" set CORE_DIR=%~dp0

:: Check for launch-silent.vbs
if not exist "%CORE_DIR%\launch-silent.vbs" (
    echo ❌ Core launch-silent.vbs file not found.
    pause
    exit /b 1
)

echo ⚙️  Registering persistent background task in Windows Task Scheduler...
schtasks /create /tn "QSDiscoveryAgent" /tr "wscript.exe \"%CORE_DIR%\launch-silent.vbs\"" /sc onlogon /rl highest /f >nul

if %errorlevel% equ 0 (
    echo.
    echo ✅ Persistent background task successfully registered!
    echo 📡 The discovery agent will launch silently at user logon.
    echo 🚀 Starting the background service now...
    schtasks /run /tn "QSDiscoveryAgent" >nul
    echo.
    echo ✅ Service started silently in the background.
) else (
    echo.
    echo ❌ Failed to register Task Scheduler task.
)

pause
