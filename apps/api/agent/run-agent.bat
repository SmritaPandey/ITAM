@echo off
setlocal EnableDelayedExpansion
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — Windows Launcher (Zero-Dependency Wizard Mode)
:: ═══════════════════════════════════════════════════════════════

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║      QS Discovery Agent - Windows Launcher           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

set SILENT=false
for %%a in (%*) do (
  if "%%a"=="--silent" set SILENT=true
)

:: Check if qs-discovery-agent.js exists
if not exist "%~dp0qs-discovery-agent.js" (
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
    exit /b 1
)

:: Check for system Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
  set NODE_BIN=node
  goto run
)

:: Check for sandboxed Node.js
if exist "%~dp0.node\node.exe" (
  set NODE_BIN="%~dp0.node\node.exe"
  goto run
)

echo ⚙️  Node.js runtime not found on this system.
echo 🚀 Setting up a lightweight, portable Node.js environment automatically...
echo.

set NODE_ZIP="%~dp0node_temp.zip"
set TEMP_DIR="%~dp0node_temp_dir"
set URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip

echo 📥 Downloading portable Node.js runtime from official mirrors...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%URL%', '%NODE_ZIP%')"

if not exist %NODE_ZIP% (
  echo ❌ Download failed. Please check your internet connection.
  pause
  exit /b 1
)

echo 📦 Extracting Node.js package...
if exist %TEMP_DIR% rmdir /s /q %TEMP_DIR%
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%TEMP_DIR%' -Force"

if exist "%~dp0.node" rmdir /s /q "%~dp0.node"
mkdir "%~dp0.node"
xcopy "%TEMP_DIR%\node-v20.11.1-win-x64\*" "%~dp0.node\" /s /e /y /q >nul

:: Cleanup
del /f /q %NODE_ZIP%
rmdir /s /q %TEMP_DIR%

if exist "%~dp0.node\node.exe" (
  echo.
  echo ✅ Lightweight Node.js runtime sandboxed inside .\.node\
  set NODE_BIN="%~dp0.node\node.exe"
  echo.
  goto run
) else (
  echo ❌ Extraction failed or binary not found.
  pause
  exit /b 1
)

:run
if "!SILENT!"=="true" (
  if exist "%~dp0config.json" (
    %NODE_BIN% "%~dp0qs-discovery-agent.js" --silent
    exit /b !errorlevel!
  )
)

:: Check if the persistent background task QSDiscoveryAgent is already registered in Task Scheduler
schtasks /query /tn "QSDiscoveryAgent" >nul 2>nul
if !errorlevel! equ 0 (
    echo ⚠️  A background service daemon for QS Discovery Agent is already registered on this machine.
    echo    Running another instance interactively will cause port conflicts and duplicate reporting.
    set /p ContinueInteractive="❓ Do you still want to run another instance interactively? (y/n): "
    if /i not "!ContinueInteractive!"=="y" (
        echo 👋 Exiting launcher. The background service is already running active scans.
        exit /b 0
    )
    echo.
) else (
    :: Offer to install the persistent background service once
    echo 💡 Tip: To run the agent silently in the background on boot, we can configure it as a persistent service.
    echo    This will ask for administrator credentials exactly once during this setup.
    set /p InstallService="⚙️  Do you want to install and start the background service now? (y/n): "
    if /i "!InstallService!"=="y" (
        echo 🚀 Requesting administrator elevation to install the background service...
        powershell -Command "Start-Process '%~dp0install-service.bat' -Verb RunAs"
        exit /b 0
    )
    echo.
)

if exist "%~dp0config.json" (
  echo 🚀 Launching pre-configured QS Discovery Agent...
  echo.
  %NODE_BIN% "%~dp0qs-discovery-agent.js"
  pause
  exit /b %errorlevel%
)

set SERVER_IP=%1
set USER_EMAIL=%2
set USER_PASS=%3

if "%SERVER_IP%"=="" (
  set /p SERVER_IP="Enter QS Discovery server IP (e.g., 192.168.1.50): "
)
if "%USER_EMAIL%"=="" (
  set /p USER_EMAIL="Enter your email: "
)
if "%USER_PASS%"=="" (
  set /p USER_PASS="Enter your password: "
)

echo.
echo ✅ Node.js found:
%NODE_BIN% --version
echo.

echo 🚀 Starting QS Discovery Agent...
echo    Server: http://%SERVER_IP%:4100
echo    User:   %USER_EMAIL%
echo.

%NODE_BIN% "%~dp0qs-discovery-agent.js" --server http://%SERVER_IP%:4100 --user %USER_EMAIL% --pass %USER_PASS%

pause
