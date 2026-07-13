@echo off
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — Windows installer entry point
:: Prefers a real Windows Service (NSSM / sc.exe) when elevated;
:: falls back to Task Scheduler logon task if PowerShell service
:: install is unavailable.
:: ═══════════════════════════════════════════════════════════════
setlocal EnableDelayedExpansion
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  Installing QS Discovery Agent (Windows Service)     ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: Ensure administrator privileges
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo  This installer requires Administrative Privileges.
    echo  Requesting administrator elevation...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "AGENT_DIR=%~dp0"
if "%AGENT_DIR:~-1%"=="\" set "AGENT_DIR=%AGENT_DIR:~0,-1%"

set "CORE_DIR=%AGENT_DIR%\core"
if not exist "%CORE_DIR%\qs-discovery-agent.js" set "CORE_DIR=%AGENT_DIR%"

if not exist "%CORE_DIR%\qs-discovery-agent.js" (
    echo.
    echo  ERROR: qs-discovery-agent.js not found.
    echo  Extract the ZIP completely, then run this script from the extracted folder.
    echo.
    pause
    exit /b 1
)

set "PS_INSTALL=%AGENT_DIR%\packaging\windows\install-windows-service.ps1"
if not exist "%PS_INSTALL%" set "PS_INSTALL=%AGENT_DIR%\install-windows-service.ps1"

:: Prefer true boot-level Windows Service via PowerShell installer
if exist "%PS_INSTALL%" (
    echo  Installing as Windows Service ^(Automatic start, recovery restart^)...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_INSTALL%" -InstallDir "%CORE_DIR%"
    if !errorlevel! equ 0 (
        echo.
        echo  Windows Service installed successfully.
        echo  The agent starts at boot and restarts on failure.
        pause
        exit /b 0
    )
    echo.
    echo  Service install reported an error — falling back to Task Scheduler...
    echo.
)

:: Fallback: Task Scheduler logon task (legacy path)
if not exist "%CORE_DIR%\launch-silent.vbs" (
    echo  ERROR: launch-silent.vbs missing; cannot register Task Scheduler fallback.
    pause
    exit /b 1
)

echo  Registering Task Scheduler logon task ^(fallback^)...
schtasks /create /tn "QSDiscoveryAgent" /tr "wscript.exe \"%CORE_DIR%\launch-silent.vbs\"" /sc onlogon /rl highest /f >nul

if %errorlevel% equ 0 (
    echo.
    echo  Task Scheduler task registered. Agent launches at user logon.
    schtasks /run /tn "QSDiscoveryAgent" >nul
    echo  Task started.
) else (
    echo.
    echo  Failed to register Task Scheduler task.
    pause
    exit /b 1
)

pause
exit /b 0
