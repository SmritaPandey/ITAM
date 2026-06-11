@echo off
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — Silent Quick-Launcher
:: ═══════════════════════════════════════════════════════════════
set CORE_DIR=%~dp0core
if not exist "%CORE_DIR%" set CORE_DIR=%~dp0

if exist "%CORE_DIR%\launch-silent.vbs" (
    wscript.exe "%CORE_DIR%\launch-silent.vbs"
    exit
) else (
    echo.
    echo  ❌ ERROR: Core files are missing!
    echo  ══════════════════════════════════════════════════════════════
    echo  Did you run this script directly from the ZIP archive without extracting it?
    echo  Windows requires the ZIP folder to be extracted for scripts to work properly.
    echo.
    echo  👉 PLEASE EXTRACT the ZIP folder completely to a directory of your choice,
    echo     then double-click 'Start Agent.bat' or 'Install Service.bat' from the extracted folder.
    echo  ══════════════════════════════════════════════════════════════
    echo.
    pause
)
