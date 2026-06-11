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
    echo.
    echo  ❌ ERROR: Core files are missing!
    echo  ══════════════════════════════════════════════════════════════
    echo  Did you run this script directly from the ZIP archive without extracting it?
    echo  Windows requires the ZIP folder to be extracted for scripts to work properly.
    echo.
    echo  👉 PLEASE EXTRACT the ZIP folder completely to a directory of your choice,
    echo     then double-click 'Install Service.bat' or 'Start Agent.bat' from the extracted folder.
    echo  ══════════════════════════════════════════════════════════════
    echo.
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
