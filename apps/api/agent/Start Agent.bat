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
    echo ❌ Core directory launcher not found.
    pause
)
