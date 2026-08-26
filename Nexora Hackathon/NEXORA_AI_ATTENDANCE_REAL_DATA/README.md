# Nexora AI Attendance — REAL DATA BUILD

The uploaded frontend is preserved visually. Dummy students, dummy attendance,
dummy activities and fake recognition are removed.

The first run has an EMPTY database:
`data/attendance.db`

AI pipeline:
Camera/image -> OpenCV -> DeepFace -> FaceNet embedding -> cosine distance ->
threshold 0.40 -> registered student / Unknown Face -> attendance.

Recognition is ON-DEMAND. One frame is sent only after **Recognize Now**.
There is no continuous recognition polling.

## Install on Windows
Python 3.11 x64 is recommended.

If Smart App Control blocks BAT files, use CMD:
```cmd
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe backend\main.py
```

Open http://127.0.0.1:8000

Or run `setup.bat`, then `run.bat`.

## Database
SQLite: `data/attendance.db`
Tables: students, attendance, activities.

For a completely fresh demo, stop the server and delete `data\attendance.db`.

## Threshold
Default FaceNet cosine-distance threshold: **0.40**. This is a starting value and
should be calibrated with your real student images before the final presentation.

## Production
The local judging build uses SQLite for reliability. The persistence layer can later
be replaced with the planned Cloudflare Worker + D1 layer.

## REAL DATA DASHBOARD
Dashboard trend and class-wise cards contain no hardcoded demo percentages. They are derived from the SQLite attendance table and show an explicit empty state until real attendance exists.
