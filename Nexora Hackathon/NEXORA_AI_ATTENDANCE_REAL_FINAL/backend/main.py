
from __future__ import annotations

import base64
import io
import json
import math
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

APP_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = APP_ROOT / "data"
RECORDINGS_INCOMING = APP_ROOT / "recordings" / "incoming"
RECORDINGS_SAVED = APP_ROOT / "recordings" / "saved"
DB_PATH = DATA_DIR / "attendance.db"

DATA_DIR.mkdir(exist_ok=True)
RECORDINGS_INCOMING.mkdir(parents=True, exist_ok=True)
RECORDINGS_SAVED.mkdir(parents=True, exist_ok=True)

MODEL_NAME = "Facenet"
DETECTOR_BACKEND = "retinaface"
DEFAULT_THRESHOLD = 0.45
MIN_THRESHOLD = 0.20
MAX_THRESHOLD = 0.80
DETECTION_INTERVAL = 1.0
RECOGNITION_INTERVAL = 0.80
CONFIRM_OBSERVATIONS = 2
MAX_FRAME_WIDTH = 960

DB_LOCK = threading.RLock()
INFERENCE_LOCK = threading.Lock()
RTSP_LOCK = threading.RLock()
RTSP_STREAMS: dict[str, dict] = {}

try:
    from deepface import DeepFace
except Exception as exc:
    DeepFace = None
    DEEPFACE_IMPORT_ERROR = str(exc)
else:
    DEEPFACE_IMPORT_ERROR = ""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with DB_LOCK, db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL,
            division TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            embedding TEXT NOT NULL,
            photo_data TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_key TEXT UNIQUE NOT NULL,
            class_name TEXT NOT NULL,
            division TEXT NOT NULL,
            subject TEXT NOT NULL,
            room TEXT NOT NULL,
            source_type TEXT NOT NULL,
            threshold REAL NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            student_db_id INTEGER NOT NULL,
            marked_at TEXT NOT NULL,
            distance REAL NOT NULL,
            confidence REAL NOT NULL,
            method TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(student_db_id) REFERENCES students(id) ON DELETE CASCADE,
            UNIQUE(session_id, student_db_id)
        );

        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON attendance(marked_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON attendance_sessions(started_at);
        """)
        c.commit()


def add_activity(kind: str, message: str) -> None:
    with DB_LOCK, db() as c:
        c.execute(
            "INSERT INTO activities(activity_type,message,created_at) VALUES(?,?,?)",
            (kind, message, now_iso()),
        )
        c.commit()


def clamp_threshold(v: float) -> float:
    if not math.isfinite(v):
        return DEFAULT_THRESHOLD
    return max(MIN_THRESHOLD, min(MAX_THRESHOLD, float(v)))


def require_ai() -> None:
    if DeepFace is None:
        raise HTTPException(503, f"DeepFace is unavailable: {DEEPFACE_IMPORT_ERROR}")


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "The uploaded file is not a readable image.")
    return image


def resize_for_ai(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= MAX_FRAME_WIDTH:
        return frame
    scale = MAX_FRAME_WIDTH / float(w)
    return cv2.resize(frame, (MAX_FRAME_WIDTH, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)


def detect_faces(frame: np.ndarray) -> list[dict]:
    require_ai()
    frame = resize_for_ai(frame)
    with INFERENCE_LOCK:
        try:
            faces = DeepFace.extract_faces(
                img_path=frame,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                align=True,
            )
        except Exception as exc:
            # For detection, a bad/empty frame should not crash the application.
            raise HTTPException(422, f"Face detection failed: {exc}") from exc

    result = []
    for item in faces:
        area = item.get("facial_area") or {}
        x = max(0, int(area.get("x", 0)))
        y = max(0, int(area.get("y", 0)))
        w = max(0, int(area.get("w", 0)))
        h = max(0, int(area.get("h", 0)))
        if w < 20 or h < 20:
            continue
        confidence = float(area.get("confidence", item.get("confidence", 0.0)) or 0.0)
        # DeepFace with enforce_detection=False may return a whole-frame fallback
        # when no face is found. Do not treat that fallback as a face.
        if confidence < 0.35:
            continue
        result.append({"x": x, "y": y, "w": w, "h": h, "confidence": confidence, "face": item.get("face")})
    return result


def embedding_from_crop(crop: np.ndarray) -> list[float]:
    require_ai()
    with INFERENCE_LOCK:
        reps = DeepFace.represent(
            img_path=crop,
            model_name=MODEL_NAME,
            detector_backend="skip",
            enforce_detection=False,
            normalization="base",
        )
    if not reps:
        raise ValueError("FaceNet did not return an embedding.")
    return [float(x) for x in reps[0]["embedding"]]


def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0 or nb == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / (na * nb))


def load_students(class_name: str, division: str) -> list[sqlite3.Row]:
    with DB_LOCK, db() as c:
        return c.execute(
            "SELECT * FROM students WHERE class_name=? AND division=? AND embedding<>''",
            (class_name, division),
        ).fetchall()


def match_embedding(embedding: list[float], students: list[sqlite3.Row], threshold: float):
    if not students:
        return None
    probe = np.asarray(embedding, dtype=np.float32)
    ranked = []
    for s in students:
        try:
            candidate = np.asarray(json.loads(s["embedding"]), dtype=np.float32)
            d = cosine_distance(probe, candidate)
            ranked.append((d, s))
        except Exception:
            continue
    if not ranked:
        return None
    ranked.sort(key=lambda x: x[0])
    best_d, best = ranked[0]
    second_d = ranked[1][0] if len(ranked) > 1 else 1.0
    # Do not accept two nearly indistinguishable candidates at the same threshold.
    margin = max(0.015, threshold * 0.05)
    if best_d <= threshold and (len(ranked) == 1 or (second_d - best_d) >= margin):
        return best, best_d
    return None


def mark_attendance(session_id: int, student: sqlite3.Row, distance: float) -> bool:
    with DB_LOCK, db() as c:
        session = c.execute("SELECT * FROM attendance_sessions WHERE id=?", (session_id,)).fetchone()
        if not session or session["ended_at"]:
            return False
        confidence = max(0.0, min(100.0, (1.0 - distance) * 100.0))
        cur = c.execute(
            """INSERT OR IGNORE INTO attendance
               (session_id,student_db_id,marked_at,distance,confidence,method)
               VALUES(?,?,?,?,?,?)""",
            (session_id, student["id"], now_iso(), distance, confidence, "FaceNet/cosine"),
        )
        inserted = cur.rowcount == 1
        c.commit()
    if inserted:
        add_activity(
            "Attendance completed",
            f"{student['name']} marked Present in {session['subject']} · {session['class_name']} — {session['division']}",
        )
    return inserted


def process_frame_for_session(frame: np.ndarray, session: sqlite3.Row, recognize: bool):
    frame = resize_for_ai(frame)
    faces = detect_faces(frame)
    output = []
    students = load_students(session["class_name"], session["division"]) if recognize else []
    threshold = clamp_threshold(session["threshold"])

    # The observation counter lives per stream/session in process_state.
    state = SESSION_OBSERVATIONS.setdefault(int(session["id"]), {})

    for i, face in enumerate(faces):
        x, y, w, h = face["x"], face["y"], face["w"], face["h"]
        x2 = min(frame.shape[1], x + w)
        y2 = min(frame.shape[0], y + h)
        crop = frame[y:y2, x:x2]
        item = {"x": x, "y": y, "w": w, "h": h, "detector_confidence": face["confidence"]}

        if recognize and crop.size and students:
            try:
                emb = embedding_from_crop(crop)
                match = match_embedding(emb, students, threshold)
            except Exception as exc:
                match = None
                item["recognition_error"] = str(exc)

            if match:
                student, distance = match
                sid = int(student["id"])
                state[sid] = state.get(sid, 0) + 1
                confirmed = state[sid] >= CONFIRM_OBSERVATIONS
                inserted = mark_attendance(session["id"], student, distance) if confirmed else False
                item.update({
                    "matched": True,
                    "student_id": student["student_id"],
                    "name": student["name"],
                    "distance": round(distance, 5),
                    "confidence": round(max(0.0, (1-distance)*100.0), 2),
                    "confirmed": confirmed,
                    "attendance_marked": inserted,
                })
            else:
                item["matched"] = False
                item["label"] = "Unknown"
        elif recognize:
            item["matched"] = False
            item["label"] = "No registered face"
        else:
            item["matched"] = False
            item["label"] = "Detected"

        output.append(item)

    return frame, output


SESSION_OBSERVATIONS: dict[int, dict[int, int]] = {}


class SessionBody(BaseModel):
    class_name: str = Field(min_length=1, max_length=120)
    division: str = Field(min_length=1, max_length=20)
    subject: str = Field(min_length=1, max_length=160)
    room: str = Field(min_length=1, max_length=120)
    source_type: str = Field(min_length=1, max_length=40)
    threshold: float = DEFAULT_THRESHOLD


class EndSessionBody(BaseModel):
    session_id: int


class RTSPBody(BaseModel):
    url: str = Field(min_length=8, max_length=1000)
    session_id: Optional[int] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield
    # RTSP workers are daemon threads and are stopped by their events on normal shutdown.


app = FastAPI(title="Nexora AI Attendance API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return FileResponse(APP_ROOT / "frontend" / "index.html")


@app.get("/assets/{path:path}")
def assets(path: str):
    file = APP_ROOT / "frontend" / "assets" / path
    if not file.is_file():
        raise HTTPException(404, "Asset not found.")
    return FileResponse(file)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "deepface_imported": DeepFace is not None,
        "model": MODEL_NAME,
        "detector": DETECTOR_BACKEND,
        "default_threshold": DEFAULT_THRESHOLD,
    }


@app.get("/api/students")
def students_api():
    with DB_LOCK, db() as c:
        rows = c.execute("""
            SELECT s.*,
                   COUNT(a.id) AS present_count
            FROM students s
            LEFT JOIN attendance a ON a.student_db_id=s.id
            GROUP BY s.id
            ORDER BY s.id DESC
        """).fetchall()
    out = []
    for r in rows:
        present = int(r["present_count"] or 0)
        out.append({
            "id": r["student_id"], "db_id": r["id"], "name": r["name"],
            "cls": r["class_name"], "division": r["division"],
            "email": r["email"], "phone": r["phone"],
            "face": bool(r["embedding"]), "photo": r["photo_data"] or "",
            "present": present,
        })
    return out


@app.post("/api/students")
async def create_student(
    student_id: str = Form(...),
    name: str = Form(...),
    class_name: str = Form(...),
    division: str = Form(...),
    email: str = Form(""),
    phone: str = Form(""),
    image: UploadFile = File(...),
):
    require_ai()
    image_bytes = await image.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "The face image is empty.")
    frame = decode_image(image_bytes)

    faces = detect_faces(frame)
    if len(faces) != 1:
        raise HTTPException(422, f"Registration requires exactly one face; detected {len(faces)}.")

    face = faces[0]
    crop = frame[face["y"]:face["y"]+face["h"], face["x"]:face["x"]+face["w"]]
    if crop.size == 0:
        raise HTTPException(422, "The detected face crop is empty.")

    try:
        embedding = embedding_from_crop(crop)
    except Exception as exc:
        raise HTTPException(422, f"FaceNet embedding generation failed: {exc}") from exc

    # Keep the actual captured image in the DB so the old frontend can display it.
    photo = "data:image/jpeg;base64," + base64.b64encode(
        cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tobytes()
    ).decode("ascii")

    stamp = now_iso()
    try:
        with DB_LOCK, db() as c:
            c.execute("""
                INSERT INTO students
                (student_id,name,class_name,division,email,phone,embedding,photo_data,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?)
            """, (
                student_id.strip(), name.strip(), class_name.strip(), division.strip(),
                email.strip(), phone.strip(), json.dumps(embedding), photo, stamp, stamp
            ))
            c.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Student ID / roll number already exists.")

    add_activity("Student added", f"{name.strip()} was added to {class_name} — {division}")
    return {"ok": True, "student_id": student_id.strip()}


@app.put("/api/students/{student_id}")
async def update_student(
    student_id: str,
    name: str = Form(...),
    class_name: str = Form(...),
    division: str = Form(...),
    email: str = Form(""),
    phone: str = Form(""),
    image: Optional[UploadFile] = File(None),
):
    with DB_LOCK, db() as c:
        existing = c.execute("SELECT * FROM students WHERE student_id=?", (student_id,)).fetchone()
    if not existing:
        raise HTTPException(404, "Student not found.")

    embedding = existing["embedding"]
    photo = existing["photo_data"]
    if image and image.filename:
        require_ai()
        frame = decode_image(await image.read())
        faces = detect_faces(frame)
        if len(faces) != 1:
            raise HTTPException(422, f"Face update requires exactly one face; detected {len(faces)}.")
        f = faces[0]
        crop = frame[f["y"]:f["y"]+f["h"], f["x"]:f["x"]+f["w"]]
        embedding = json.dumps(embedding_from_crop(crop))
        photo = "data:image/jpeg;base64," + base64.b64encode(
            cv2.imencode(".jpg", frame)[1].tobytes()
        ).decode("ascii")

    with DB_LOCK, db() as c:
        c.execute("""
            UPDATE students
            SET name=?,class_name=?,division=?,email=?,phone=?,embedding=?,photo_data=?,updated_at=?
            WHERE student_id=?
        """, (name.strip(), class_name.strip(), division.strip(), email.strip(), phone.strip(),
              embedding, photo, now_iso(), student_id))
        c.commit()
    add_activity("Student updated", f"{name.strip()} details were updated")
    return {"ok": True}


@app.delete("/api/students/{student_id}")
def delete_student(student_id: str):
    with DB_LOCK, db() as c:
        row = c.execute("SELECT name FROM students WHERE student_id=?", (student_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Student not found.")
        c.execute("DELETE FROM students WHERE student_id=?", (student_id,))
        c.commit()
    add_activity("Student deleted", f"{row['name']} was removed")
    return {"ok": True}


@app.post("/api/sessions")
def create_session(body: SessionBody):
    threshold = clamp_threshold(body.threshold)
    key = uuid.uuid4().hex
    with DB_LOCK, db() as c:
        cur = c.execute("""
            INSERT INTO attendance_sessions
            (session_key,class_name,division,subject,room,source_type,threshold,started_at)
            VALUES(?,?,?,?,?,?,?,?)
        """, (key, body.class_name, body.division, body.subject, body.room,
              body.source_type, threshold, now_iso()))
        sid = cur.lastrowid
        c.commit()
    SESSION_OBSERVATIONS[int(sid)] = {}
    add_activity("Attendance session", f"{body.subject} session started in {body.room}")
    return {"ok": True, "session_id": sid, "threshold": threshold}


@app.post("/api/sessions/end")
def end_session(body: EndSessionBody):
    with DB_LOCK, db() as c:
        c.execute(
            "UPDATE attendance_sessions SET ended_at=? WHERE id=? AND ended_at IS NULL",
            (now_iso(), body.session_id),
        )
        c.commit()
    SESSION_OBSERVATIONS.pop(body.session_id, None)
    return {"ok": True}


@app.post("/api/recognition/frame")
async def recognition_frame(
    session_id: int = Form(...),
    frame: UploadFile = File(...),
):
    with DB_LOCK, db() as c:
        session = c.execute("SELECT * FROM attendance_sessions WHERE id=?", (session_id,)).fetchone()
    if not session or session["ended_at"]:
        raise HTTPException(409, "Attendance session is not active.")

    image = decode_image(await frame.read())
    annotated_base, faces = process_frame_for_session(image, session, recognize=True)

    # Draw the same boxes the frontend uses for the display.
    for f in faces:
        x,y,w,h = f["x"],f["y"],f["w"],f["h"]
        if f.get("matched"):
            label = f"{f['name']} · {f['distance']:.3f}"
        else:
            label = "Unknown"
        cv2.rectangle(annotated_base, (x,y), (x+w,y+h), (255,255,255), 2)
        cv2.putText(annotated_base, label, (x, max(20,y-8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255,255,255), 2, cv2.LINE_AA)

    return {
        "ok": True,
        "width": int(annotated_base.shape[1]),
        "height": int(annotated_base.shape[0]),
        "faces": [
            {k:v for k,v in f.items() if k != "recognition_error"}
            for f in faces
        ],
    }


@app.post("/api/detection/frame")
async def detection_frame(frame: UploadFile = File(...)):
    image = decode_image(await frame.read())
    resized = resize_for_ai(image)
    faces = detect_faces(resized)
    return {
        "ok": True,
        "width": int(resized.shape[1]),
        "height": int(resized.shape[0]),
        "faces": [{k:v for k,v in f.items() if k != "face"} for f in faces],
    }


@app.get("/api/attendance")
def attendance_api(
    from_date: str = "",
    to_date: str = "",
    class_name: str = "",
    division: str = "",
    subject: str = "",
    student: str = "",
    room: str = "",
    status: str = "",
):
    clauses = ["1=1"]
    params = []
    if from_date:
        clauses.append("date(a.marked_at)=?")
        params.append(from_date)
    if to_date:
        clauses.append("date(a.marked_at)<=?")
        params.append(to_date)
    if class_name:
        clauses.append("s.class_name=?")
        params.append(class_name)
    if division:
        clauses.append("s.division=?")
        params.append(division)
    if subject:
        clauses.append("se.subject=?")
        params.append(subject)
    if student:
        clauses.append("(s.name LIKE ? OR s.student_id LIKE ?)")
        params.extend([f"%{student}%", f"%{student}%"])
    if room:
        clauses.append("se.room LIKE ?")
        params.append(f"%{room}%")
    if status:
        # Current attendance rows are Present only.
        if status.lower() != "present":
            return []
    sql = f"""
        SELECT a.id,date(a.marked_at) AS attendance_date,s.student_id,s.name,
               s.class_name,s.division,se.subject,'Present' AS status,
               time(a.marked_at) AS marked_time,se.room,a.distance,a.confidence
        FROM attendance a
        JOIN students s ON s.id=a.student_db_id
        JOIN attendance_sessions se ON se.id=a.session_id
        WHERE {' AND '.join(clauses)}
        ORDER BY a.marked_at DESC
    """
    with DB_LOCK, db() as c:
        rows = c.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/activities")
def activities_api():
    with DB_LOCK, db() as c:
        rows = c.execute(
            "SELECT activity_type,message,created_at FROM activities ORDER BY id DESC LIMIT 20"
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/dashboard")
def dashboard_api():
    today = datetime.now(timezone.utc).date().isoformat()
    with DB_LOCK, db() as c:
        total = c.execute("SELECT COUNT(*) FROM students").fetchone()[0]
        present = c.execute("""
            SELECT COUNT(DISTINCT a.student_db_id)
            FROM attendance a
            WHERE date(a.marked_at)=?
        """, (today,)).fetchone()[0]

        class_rows = c.execute("""
            SELECT s.class_name,s.division,
                   COUNT(DISTINCT s.id) AS total,
                   COUNT(DISTINCT CASE WHEN date(a.marked_at)=? THEN a.student_db_id END) AS present
            FROM students s
            LEFT JOIN attendance a ON a.student_db_id=s.id
            GROUP BY s.class_name,s.division
            ORDER BY s.class_name,s.division
        """, (today,)).fetchall()

        # Average attendance is computed from real sessions and real students.
        student_rows = c.execute("""
            SELECT s.id,
                   COUNT(DISTINCT CASE
                       WHEN se.id IS NOT NULL AND a.id IS NOT NULL THEN se.id END) AS attended,
                   COUNT(DISTINCT se.id) AS sessions
            FROM students s
            LEFT JOIN attendance_sessions se
              ON se.class_name=s.class_name AND se.division=s.division
            LEFT JOIN attendance a
              ON a.session_id=se.id AND a.student_db_id=s.id
            GROUP BY s.id
        """).fetchall()

        trend_rows = c.execute("""
            SELECT date(se.started_at) AS d,
                   COUNT(DISTINCT se.id) AS sessions,
                   COUNT(DISTINCT a.student_db_id) AS present
            FROM attendance_sessions se
            LEFT JOIN attendance a ON a.session_id=se.id
            WHERE date(se.started_at)>=date(?, '-6 day')
            GROUP BY date(se.started_at)
            ORDER BY d
        """, (today,)).fetchall()

    class_data = []
    for r in class_rows:
        t = int(r["total"])
        p = int(r["present"])
        class_data.append({
            "class_name": r["class_name"], "division": r["division"],
            "total": t, "present": p,
            "percentage": round(p/t*100) if t else 0
        })

    student_rates = []
    for r in student_rows:
        sessions = int(r["sessions"] or 0)
        attended = int(r["attended"] or 0)
        if sessions:
            student_rates.append(attended / sessions * 100)
    average = round(sum(student_rates) / len(student_rates)) if student_rates else 0

    trend_map = {}
    for r in trend_rows:
        # Sessions have a real denominator: average percentage of attendance
        # for that day's recorded sessions, based on enrolled students in the
        # matching class/division.
        trend_map[r["d"]] = int(r["present"])

    points = []
    today_date = datetime.now(timezone.utc).date()
    for offset in range(6, -1, -1):
        d = today_date.fromordinal(today_date.toordinal() - offset).isoformat()
        points.append(trend_map.get(d, 0))

    return {
        "total_students": int(total),
        "present_today": int(present),
        "attendance_today": round(present/total*100) if total else 0,
        "average_attendance": average,
        "classes": class_data,
        "trend": points,
    }


@app.post("/api/recordings")
async def upload_recording(video: UploadFile = File(...)):
    suffix = Path(video.filename or "").suffix.lower()
    if suffix not in {".mp4",".mov",".avi",".mkv",".webm"}:
        raise HTTPException(400, "Unsupported video format.")
    name = f"{uuid.uuid4().hex}{suffix}"
    target = RECORDINGS_SAVED / name
    with target.open("wb") as out:
        while True:
            chunk = await video.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    return {"ok": True, "filename": name}


@app.get("/api/recordings")
def recordings():
    return [{"filename":p.name, "size":p.stat().st_size} for p in RECORDINGS_SAVED.iterdir() if p.is_file()]


def rtsp_worker(stream_id: str):
    state = RTSP_STREAMS[stream_id]
    cap = cv2.VideoCapture(state["url"], cv2.CAP_FFMPEG)
    state["cap"] = cap
    state["started"] = time.time()
    next_ai = 0.0
    try:
        while not state["stop"].is_set():
            ok, frame = cap.read()
            if not ok:
                state["error"] = "RTSP frame read failed; retrying."
                time.sleep(0.5)
                continue
            frame = resize_for_ai(frame)
            now = time.time()
            if now >= next_ai:
                next_ai = now + (RECOGNITION_INTERVAL if state.get("session_id") else DETECTION_INTERVAL)
                try:
                    if state.get("session_id"):
                        with DB_LOCK, db() as c:
                            session = c.execute(
                                "SELECT * FROM attendance_sessions WHERE id=?",
                                (state["session_id"],)
                            ).fetchone()
                        if session and not session["ended_at"]:
                            _, faces = process_frame_for_session(frame, session, True)
                        else:
                            state["session_id"] = None
                            _, faces = process_frame_for_session(frame, session, False) if session else (frame, [])
                    else:
                        faces = detect_faces(frame)
                        faces = [{k:v for k,v in f.items() if k != "face"} for f in faces]
                    state["faces"] = faces
                    state["frame"] = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])[1].tobytes()
                    state["frame_width"] = int(frame.shape[1])
                    state["frame_height"] = int(frame.shape[0])
                    state["last"] = time.time()
                    state["error"] = ""
                except Exception as exc:
                    state["error"] = str(exc)
    finally:
        cap.release()


@app.post("/api/rtsp/start")
def rtsp_start(body: RTSPBody):
    stream_id = uuid.uuid4().hex
    state = {
        "url": body.url,
        "session_id": body.session_id,
        "stop": threading.Event(),
        "frame": None,
        "faces": [],
        "error": "",
        "last": 0.0,
    }
    with RTSP_LOCK:
        RTSP_STREAMS[stream_id] = state
    threading.Thread(target=rtsp_worker, args=(stream_id,), daemon=True).start()
    return {"ok": True, "stream_id": stream_id}


@app.get("/api/rtsp/{stream_id}/frame")
def rtsp_frame(stream_id: str):
    with RTSP_LOCK:
        state = RTSP_STREAMS.get(stream_id)
    if not state:
        raise HTTPException(404, "RTSP stream not found.")
    raw = state.get("frame")
    if raw is None:
        return JSONResponse({"ok": False, "error": state.get("error") or "Waiting for RTSP frame..."}, status_code=202)
    return {
        "ok": True,
        "image": "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii"),
        "faces": state.get("faces", []),
        "width": state.get("frame_width", 960),
        "height": state.get("frame_height", 540),
        "error": state.get("error", ""),
        "age": max(0.0, time.time()-state.get("last", time.time())),
    }


@app.post("/api/rtsp/{stream_id}/stop")
def rtsp_stop(stream_id: str):
    with RTSP_LOCK:
        state = RTSP_STREAMS.pop(stream_id, None)
    if state:
        state["stop"].set()
    return {"ok": True}


if __name__ == "__main__":
    # Direct execution: `python backend\main.py`
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False, workers=1)
