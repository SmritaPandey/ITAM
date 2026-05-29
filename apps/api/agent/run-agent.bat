@echo off
:: ═══════════════════════════════════════════════════════════════
:: QS Discovery Agent — Windows Launcher (Zero-Dependency Wizard Mode)
:: ═══════════════════════════════════════════════════════════════

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║      QS Discovery Agent - Windows Launcher           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

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
