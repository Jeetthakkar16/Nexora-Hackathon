# NEXORA AI ATTENDANCE — REAL DATA / OLD FRONTEND

This build uses the uploaded original frontend as the visual source of truth.

## Pages
1. Dashboard — real database totals, today's attendance, class-wise values, trend and activity.
2. Students — add/edit/delete real students and create FaceNet embeddings.
3. Live Recognition — webcam, pre-recorded video and authorized RTSP/CCTV.
4. Attendance Register — real saved attendance.
5. Reports — real filtered attendance insights.

## AI pipeline
Registration:
image -> RetinaFace -> exactly one face -> FaceNet -> embedding -> SQLite

Attendance:
webcam/MP4/RTSP -> RetinaFace -> bounding box for each detected face -> FaceNet -> cosine distance -> dynamic threshold -> confirmation -> attendance

Default cosine-distance threshold: 0.45.
Input range: 0.20 to 0.80. Lower is stricter.

## Duplicate protection
Attendance has a UNIQUE(session_id, student_db_id) constraint, so one student cannot be inserted twice in the same lecture/session.

## Performance
- Detection is sampled rather than sent on every browser frame.
- Recognition requests are serialized.
- Backend has one inference lock.
- Frames are resized to a maximum width of 960px before AI processing.
- Uvicorn runs with one worker.

## Important
There is NO seed/demo student data. The database is intentionally empty on first run.

## Run
```cmd
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install --no-cache-dir --timeout 3600 --retries 20 -r requirements.txt
python verify_install.py
python backend\main.py
```

Open http://127.0.0.1:8000

Keep the terminal open.

## Video
Use the Live Recognition page. Select Pre-recorded video and choose an MP4. The whole video frame is used; users do not manually place the video inside a face box.

## RTSP
Use only an authorized CCTV/RTSP URL. The stream is consumed continuously; AI attendance recognition is bound to the active attendance session.
