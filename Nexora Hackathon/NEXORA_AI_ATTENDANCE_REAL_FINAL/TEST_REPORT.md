# Static validation report

- Uploaded old `index.html`: preserved.
- Uploaded old `styles.css`: preserved.
- Dummy student/attendance/activity seed arrays: removed.
- Dashboard hardcoded attendance percentages: removed.
- Student registration uses multipart Form/File and real DeepFace/FaceNet embedding generation.
- RetinaFace is used for multi-face detection.
- Webcam, MP4 and RTSP source modes are implemented.
- Detection and recognition are separated.
- Recognition is serialized and frame sampled to reduce CPU load.
- Dynamic cosine-distance threshold input: 0.20–0.80, default 0.45.
- Duplicate attendance protected by `UNIQUE(session_id, student_db_id)`.
- SQLite schema is created automatically.
- No dummy records are inserted.
- Backend direct startup is `python backend\main.py`.
