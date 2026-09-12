@echo off
setlocal
echo ============================================
echo LogiShield - Windows Setup
echo ============================================
py -3.11 -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if not exist .env copy .env.example .env
echo.
echo Setup complete. Run scripts\start.bat
pause
