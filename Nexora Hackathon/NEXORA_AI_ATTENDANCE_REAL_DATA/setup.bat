@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Python launcher not found. Install Python 3.11 x64.&pause&exit /b 1)
py -3.11 --version >nul 2>nul || (echo Python 3.11 not found. Install Python 3.11 x64.&pause&exit /b 1)
if not exist ".venv\Scripts\python.exe" py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip || goto fail
.venv\Scripts\python.exe -m pip install -r requirements.txt || goto fail
.venv\Scripts\python.exe -c "import fastapi,uvicorn,pydantic,numpy,cv2,tensorflow; from deepface import DeepFace; print('All required modules imported successfully.')" || goto fail
echo Preloading FaceNet. The first setup can take several minutes...
.venv\Scripts\python.exe -c "from deepface import DeepFace; DeepFace.build_model('Facenet'); print('FaceNet model ready.')" || goto fail
echo SETUP COMPLETE. Run run.bat or start backend\main.py.
pause
exit /b 0
:fail
echo SETUP FAILED. Read the error above.
pause
exit /b 1
