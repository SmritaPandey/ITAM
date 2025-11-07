@echo off
REM ITAM Scanner - Windows Service Installation Script
REM This script installs the ITAM scanner as a Windows service using NSSM

echo ========================================
echo ITAM Scanner Windows Service Installer
echo ========================================
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Configuration
set SERVICE_NAME=ITAMScanner
set PYTHON_EXE=python
set SCRIPT_PATH=%~dp0itam_scanner.py
set LOG_PATH=%~dp0logs\service.log

REM Check if Python is installed
%PYTHON_EXE% --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH!
    echo Please install Python 3.8 or higher from https://python.org
    pause
    exit /b 1
)

REM Check if script exists
if not exist "%SCRIPT_PATH%" (
    echo ERROR: Scanner script not found at %SCRIPT_PATH%
    pause
    exit /b 1
)

REM Install required Python packages
echo Installing required Python packages...
%PYTHON_EXE% -m pip install --upgrade pip
%PYTHON_EXE% -m pip install -r requirements.txt
if %errorLevel% neq 0 (
    echo ERROR: Failed to install Python packages!
    pause
    exit /b 1
)

REM Download NSSM if not present
if not exist "nssm.exe" (
    echo Downloading NSSM service manager...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip'"
    powershell -Command "Expand-Archive -Path 'nssm.zip' -DestinationPath '.'"
    copy /y "nssm-2.24\win64\nssm.exe" "nssm.exe"
    del /f /q nssm.zip
    rmdir /s /q nssm-2.24
)

REM Check if service already exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Service already exists. Stopping and removing...
    nssm.exe stop %SERVICE_NAME%
    timeout /t 3 /nobreak >nul
    nssm.exe remove %SERVICE_NAME% confirm
)

REM Create logs directory
if not exist "%~dp0logs" mkdir "%~dp0logs"

REM Install service
echo Installing %SERVICE_NAME% service...
nssm.exe install %SERVICE_NAME% "%PYTHON_EXE%" "%SCRIPT_PATH%"

REM Configure service
nssm.exe set %SERVICE_NAME% AppDirectory "%~dp0"
nssm.exe set %SERVICE_NAME% DisplayName "ITAM Asset Scanner"
nssm.exe set %SERVICE_NAME% Description "Automated IT Asset Management scanner that collects hardware, software, and telemetry data"
nssm.exe set %SERVICE_NAME% Start SERVICE_AUTO_START
nssm.exe set %SERVICE_NAME% AppStdout "%LOG_PATH%"
nssm.exe set %SERVICE_NAME% AppStderr "%LOG_PATH%"
nssm.exe set %SERVICE_NAME% AppRotateFiles 1
nssm.exe set %SERVICE_NAME% AppRotateSeconds 86400
nssm.exe set %SERVICE_NAME% AppRotateBytes 10485760

REM Set service dependencies
nssm.exe set %SERVICE_NAME% DependOnService Tcpip

REM Start service
echo Starting %SERVICE_NAME% service...
nssm.exe start %SERVICE_NAME%

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo Service installed and started successfully!
    echo ========================================
    echo.
    echo Service Name: %SERVICE_NAME%
    echo Status: Running
    echo Log File: %LOG_PATH%
    echo.
    echo To view service status: sc query %SERVICE_NAME%
    echo To stop service: nssm stop %SERVICE_NAME%
    echo To restart service: nssm restart %SERVICE_NAME%
    echo To uninstall: run uninstall_windows_service.bat
    echo.
) else (
    echo ERROR: Failed to start service!
    nssm.exe remove %SERVICE_NAME% confirm
)

pause
