@echo off
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — Quick Start (Windows)
:: ═══════════════════════════════════════════════════════════════
:: Double-click this file to start the agent.
:: First time? It will open the setup wizard automatically.
:: ═══════════════════════════════════════════════════════════════

set CORE_DIR=%~dp0core
if not exist "%CORE_DIR%" set CORE_DIR=%~dp0

:: Check if agent files exist (user might be running from inside ZIP)
if not exist "%CORE_DIR%\qs-discovery-agent.js" (
    echo.
    echo   ❌ Agent files not found!
    echo.
    echo   If you downloaded a ZIP file, please:
    echo   1. Right-click the ZIP file
    echo   2. Click "Extract All..."
    echo   3. Open the extracted folder
    echo   4. Double-click "Start Agent.bat" again
    echo.
    pause
    exit /b 1
)

:: If config exists, launch silently in background
if exist "%CORE_DIR%\config.json" (
    if exist "%CORE_DIR%\launch-silent.vbs" (
        wscript.exe "%CORE_DIR%\launch-silent.vbs"
        exit
    ) else (
        call "%CORE_DIR%\run-agent.bat"
        exit /b
    )
)

:: No config — run the interactive launcher which will open setup.html
call "%CORE_DIR%\run-agent.bat"
