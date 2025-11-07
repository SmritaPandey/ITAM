@echo off
REM ITAM Scanner - Windows Service Uninstallation Script

echo ========================================
echo ITAM Scanner Windows Service Uninstaller
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

set SERVICE_NAME=ITAMScanner

REM Check if service exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% neq 0 (
    echo Service %SERVICE_NAME% is not installed.
    pause
    exit /b 0
)

echo Stopping %SERVICE_NAME% service...
nssm.exe stop %SERVICE_NAME%
timeout /t 3 /nobreak >nul

echo Removing %SERVICE_NAME% service...
nssm.exe remove %SERVICE_NAME% confirm

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo Service uninstalled successfully!
    echo ========================================
    echo.
) else (
    echo ERROR: Failed to uninstall service!
)

pause
