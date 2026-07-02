@echo off
setlocal EnableDelayedExpansion
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — One-Click Launcher (Windows)
:: ═══════════════════════════════════════════════════════════════
:: Just double-click this file. No prompts, no questions.
:: If config.json is missing, it tells you what to do.
:: ═══════════════════════════════════════════════════════════════

echo.
echo   ╔══════════════════════════════════════════════╗
echo   ║     QS Discovery Agent  v2.0.0               ║
echo   ╚══════════════════════════════════════════════╝
echo.

:: ─── Check for core files ──────────────────────────────────
if not exist "%~dp0qs-discovery-agent.js" (
    echo   ❌ Agent files missing!
    echo.
    echo   If you're running this from inside a ZIP file,
    echo   please EXTRACT the ZIP first, then try again.
    echo.
    pause
    exit /b 1
)

:: ─── Check for config.json ─────────────────────────────────
if not exist "%~dp0config.json" (
    echo   ⚠️  No configuration found.
    echo.
    echo   To set up this agent:
    echo   ─────────────────────────────────────────────
    echo   1. Open "setup.html" in your web browser
    echo   2. Enter your server address and credentials
    echo   3. Click "Save Configuration"
    echo   4. Move the downloaded config.json into this folder:
    echo      %~dp0
    echo   5. Double-click this file again
    echo.

    if exist "%~dp0setup.html" (
        echo   Opening setup wizard now...
        start "" "%~dp0setup.html"
    )
    pause
    exit /b 1
)

:: ─── Find or download Node.js ──────────────────────────────
where node >nul 2>nul
if %errorlevel% equ 0 (
    set NODE_BIN=node
    goto launch
)

if exist "%~dp0.node\node.exe" (
    set NODE_BIN="%~dp0.node\node.exe"
    goto launch
)

echo   📦 Setting up runtime environment (one-time)...
echo.

set NODE_ZIP="%~dp0.node_temp.zip"
set TEMP_DIR="%~dp0.node_temp_dir"
set URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%URL%', '%NODE_ZIP%')"

if not exist %NODE_ZIP% (
    echo   ❌ Download failed. Check your internet connection.
    pause
    exit /b 1
)

if exist %TEMP_DIR% rmdir /s /q %TEMP_DIR%
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%TEMP_DIR%' -Force"

if exist "%~dp0.node" rmdir /s /q "%~dp0.node"
mkdir "%~dp0.node"
xcopy "%TEMP_DIR%\node-v20.11.1-win-x64\*" "%~dp0.node\" /s /e /y /q >nul

del /f /q %NODE_ZIP%
rmdir /s /q %TEMP_DIR%

if exist "%~dp0.node\node.exe" (
    echo   ✅ Runtime ready
    set NODE_BIN="%~dp0.node\node.exe"
    goto launch
) else (
    echo   ❌ Setup failed. Please install Node.js from nodejs.org
    pause
    exit /b 1
)

:launch

:: ─── Install as background task (silent) ───────────────────
schtasks /query /tn "QSDiscoveryAgent" >nul 2>nul
if !errorlevel! neq 0 (
    :: Only attempt if we have admin rights
    openfiles >nul 2>&1
    if !errorlevel! equ 0 (
        if exist "%~dp0launch-silent.vbs" (
            schtasks /create /tn "QSDiscoveryAgent" /tr "wscript.exe \"%~dp0launch-silent.vbs\"" /sc onlogon /rl highest /f >nul 2>nul
            if !errorlevel! equ 0 (
                echo   ✅ Installed as background service (starts on login)
            )
        )
    )
)

:: ─── Launch the agent ──────────────────────────────────────
echo   🚀 Starting agent...
echo.
%NODE_BIN% "%~dp0qs-discovery-agent.js"
pause
