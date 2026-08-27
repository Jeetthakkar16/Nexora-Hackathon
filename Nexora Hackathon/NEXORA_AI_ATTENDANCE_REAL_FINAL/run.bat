@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo .venv not found. Create it with:
  echo py -3.11 -m venv .venv
  pause
  exit /b 1
)
".venv\Scripts\python.exe" backend\main.py
