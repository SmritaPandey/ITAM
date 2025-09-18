@echo off
setlocal enabledelayedexpansion
cd /d %~dp0
mkdir data 2>nul
mkdir data\attachments 2>nul
cd backend
if not exist .venv\Scripts\python.exe (
  py -3 -m venv .venv
  .venv\Scripts\python.exe -m pip install --no-cache-dir -r requirements.txt
)
set DATABASE_URL=%DATABASE_URL%
set STORAGE_BACKEND=%STORAGE_BACKEND%
set ATTACHMENTS_DIR=%ATTACHMENTS_DIR%
set JWT_SECRET=%JWT_SECRET%
.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8080

