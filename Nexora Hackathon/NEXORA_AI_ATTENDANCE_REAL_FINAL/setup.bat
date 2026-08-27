@echo off
cd /d "%~dp0"
py -3.11 -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install --no-cache-dir --timeout 3600 --retries 20 -r requirements.txt
python verify_install.py
pause
