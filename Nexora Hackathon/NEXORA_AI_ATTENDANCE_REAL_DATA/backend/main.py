from __future__ import annotations
import json, os, sqlite3, threading
from contextlib import asynccontextmanager
from datetime import datetime, date
from pathlib import Path
from typing import Any
import cv2, numpy as np, uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from deepface import DeepFace
    DEEPFACE_IMPORT_ERROR = ""
except Exception as exc:
    DeepFace = None
    DEEPFACE_IMPORT_ERROR = str(exc)

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
DB_PATH = DATA_DIR / "attendance.db"
MODEL_NAME = "Facenet"
DETECTOR_BACKEND = "opencv"
DISTANCE_METRIC = "cosine"
MATCH_THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.40"))
DB_LOCK = threading.Lock()
MODEL_READY = False
MODEL_ERROR = ""

def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    c = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,
        timeout=30
    )

    c.row_factory = sqlite3.Row

    c.executescript("""
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL DEFAULT 'BSc AI',
            division TEXT NOT NULL DEFAULT 'A',
            email TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            embedding TEXT,
            photo_data TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_db_id INTEGER NOT NULL,
            attendance_date TEXT NOT NULL,
            subject TEXT NOT NULL DEFAULT 'Artificial Intelligence',
            room TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Present',
            marked_at TEXT NOT NULL,
            confidence REAL,
            distance REAL,
            method TEXT NOT NULL DEFAULT 'face',

            FOREIGN KEY(student_db_id)
                REFERENCES students(id)
                ON DELETE CASCADE,

            UNIQUE(
                student_db_id,
                attendance_date,
                subject
            )
        );

        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_date
        ON attendance(attendance_date);
    """)

    c.commit()

    return c

def init_db():
    with DB_LOCK:
        c=db()
        c.executescript("""
        PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS students(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          class_name TEXT NOT NULL DEFAULT 'BSc AI',
          division TEXT NOT NULL DEFAULT 'A',
          email TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          embedding TEXT,
          photo_data TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS attendance(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_db_id INTEGER NOT NULL,
          attendance_date TEXT NOT NULL,
          subject TEXT NOT NULL DEFAULT 'Artificial Intelligence',
          room TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'Present',
          marked_at TEXT NOT NULL,
          confidence REAL,
          distance REAL,
          method TEXT NOT NULL DEFAULT 'face',
          FOREIGN KEY(student_db_id) REFERENCES students(id) ON DELETE CASCADE,
          UNIQUE(student_db_id,attendance_date,subject)
        );
        CREATE TABLE IF NOT EXISTS activities(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_type TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
        """)
        c.commit(); c.close()

def warmup_model():
    global MODEL_READY, MODEL_ERROR
    if DeepFace is None:
        MODEL_READY=False
        MODEL_ERROR=f"DeepFace import failed: {DEEPFACE_IMPORT_ERROR}"
        return
    try:
        DeepFace.build_model(MODEL_NAME)
        MODEL_READY=True; MODEL_ERROR=""
    except Exception as exc:
        MODEL_READY=False; MODEL_ERROR=f"FaceNet model startup failed: {exc}"

def decode_image(raw: bytes):
    image=cv2.imdecode(np.frombuffer(raw,dtype=np.uint8),cv2.IMREAD_COLOR)
    if image is None: raise ValueError("Invalid image file.")
    return image

def represent_face(image):
    if DeepFace is None: raise RuntimeError(MODEL_ERROR or "DeepFace is unavailable.")
    if not MODEL_READY: raise RuntimeError(MODEL_ERROR or "FaceNet model is not ready.")
    result=DeepFace.represent(img_path=image,model_name=MODEL_NAME,
        detector_backend=DETECTOR_BACKEND,enforce_detection=True,align=True,normalization="base")
    if not result: raise ValueError("No face detected. Keep exactly one clear face in frame.")
    if len(result)!=1: raise ValueError("Multiple faces detected. Keep exactly one face in frame.")
    v=np.asarray(result[0]["embedding"],dtype=np.float32)
    if v.size==0: raise ValueError("Face embedding could not be generated.")
    return v

def enc(v): return json.dumps(v.astype(float).tolist(),separators=(",",":"))
def dec(s): return np.asarray(json.loads(s),dtype=np.float32)
def cosine_distance(a,b):
    d=float(np.linalg.norm(a)*np.linalg.norm(b))
    return 1.0 if d==0 else float(1.0-np.dot(a,b)/d)

def best_match(query):
    c=db(); rows=c.execute("SELECT * FROM students WHERE embedding IS NOT NULL AND embedding!=''").fetchall(); c.close()
    best=None; best_d=999.0
    for r in rows:
        try:
            stored=dec(r["embedding"])
            if stored.shape!=query.shape: continue
            d=cosine_distance(query,stored)
            if d<best_d: best_d=d; best=r
        except Exception: pass
    return best,best_d

def confidence(distance):
    return round(max(0.0,min(99.9,(1.0-distance/max(MATCH_THRESHOLD,1e-9))*100.0)),1)

def student_dict(row):
    c=db()
    present=c.execute("SELECT COUNT(*) n FROM attendance WHERE student_db_id=? AND status='Present'",(row["id"],)).fetchone()["n"]
    total=c.execute("SELECT COUNT(*) n FROM attendance WHERE student_db_id=?",(row["id"],)).fetchone()["n"]
    c.close()
    return {"id":row["student_id"],"name":row["name"],"cls":row["class_name"],"division":row["division"],
            "email":row["email"] or "","phone":row["phone"] or "","face":bool(row["embedding"]),
            "photo":row["photo_data"] or "","attendance":round(present/total*100) if total else 0,
            "present":present,"absent":0,"db_id":row["id"],"created_at":row["created_at"]}

def add_activity(kind,msg):
    with DB_LOCK:
        c=db(); c.execute("INSERT INTO activities(activity_type,message,created_at) VALUES(?,?,?)",
            (kind,msg,datetime.now().strftime("%Y-%m-%d %H:%M:%S"))); c.commit(); c.close()

def attendance_rows():
    c=db(); rows=c.execute("""
      SELECT a.attendance_date,s.student_id,s.name,s.class_name,s.division,a.subject,a.status,
             substr(a.marked_at,12,5) tm
      FROM attendance a JOIN students s ON s.id=a.student_db_id
      ORDER BY a.attendance_date DESC,a.id DESC
    """).fetchall(); c.close()
    return [[r["attendance_date"],r["student_id"],r["name"],r["class_name"],r["division"],
             r["subject"],r["status"],r["tm"] or "—"] for r in rows]

class StudentUpdate(BaseModel):
    name:str; cls:str; division:str; email:str=""; phone:str=""

@asynccontextmanager
async def lifespan(_):
    init_db()
    warmup_model()
    yield

app=FastAPI(title="Nexora AI Face Recognition Attendance",version="2.0-real")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])
FRONTEND_DIR=APP_DIR/"frontend"
app.mount("/assets",StaticFiles(directory=FRONTEND_DIR/"assets"),name="assets")

@app.get("/")
def index(): return FileResponse(FRONTEND_DIR/"index.html")

@app.get("/api/health")
def health():
    return {"ok":True,"ai_available":DeepFace is not None,"model_ready":MODEL_READY,"model":MODEL_NAME,
            "detector":DETECTOR_BACKEND,"metric":DISTANCE_METRIC,"threshold":MATCH_THRESHOLD,
            "database":str(DB_PATH),"error":MODEL_ERROR}

@app.get("/api/students")
def get_students():
    c=db(); rows=c.execute("SELECT * FROM students ORDER BY id DESC").fetchall(); c.close()
    return [student_dict(r) for r in rows]

@app.get("/api/activities")
def get_activities():
    c=db(); rows=c.execute("SELECT activity_type,message,created_at FROM activities ORDER BY id DESC LIMIT 20").fetchall(); c.close()
    return [[r["activity_type"],r["message"],r["created_at"]] for r in rows]

@app.get("/api/attendance")
def get_attendance(): return attendance_rows()

@app.get("/api/stats")
def stats():
    c=db(); total=c.execute("SELECT COUNT(*) n FROM students").fetchone()["n"]
    t=date.today().isoformat()
    present=c.execute("SELECT COUNT(*) n FROM attendance WHERE attendance_date=? AND status='Present'",(t,)).fetchone()["n"]
    events=c.execute("SELECT COUNT(*) n FROM attendance").fetchone()["n"]
    recent=c.execute("""SELECT s.student_id,s.name,a.marked_at,a.confidence,a.status
                        FROM attendance a JOIN students s ON s.id=a.student_db_id
                        ORDER BY a.id DESC LIMIT 10""").fetchall()
    c.close()
    return {"total_students":total,"present_today":present,"total_attendance":events,"recent":[dict(r) for r in recent]}

@app.post("/api/students")
async def create_student(student_id:str=Form(...),name:str=Form(...),cls:str=Form("BSc AI"),
                         division:str=Form("A"),email:str=Form(""),phone:str=Form(""),
                         image:UploadFile=File(...)):
    raw=await image.read()
    try: embedding=represent_face(decode_image(raw))
    except Exception as exc: raise HTTPException(422,str(exc)) from exc
    existing,d=best_match(embedding)
    if existing is not None and d<=MATCH_THRESHOLD:
        raise HTTPException(409,f"This face already belongs to {existing['name']} ({existing['student_id']}).")
    now=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with DB_LOCK:
        c=db()
        try:
            c.execute("""INSERT INTO students(student_id,name,class_name,division,email,phone,embedding,photo_data,created_at,updated_at)
                         VALUES(?,?,?,?,?,?,?,?,?,?)""",
                      (student_id.strip(),name.strip(),cls.strip(),division.strip(),email.strip(),phone.strip(),enc(embedding),"",now,now))
            c.commit()
        except sqlite3.IntegrityError as exc:
            c.close(); raise HTTPException(409,"Student ID already exists.") from exc
        c.close()
    add_activity("Student added",f"{name.strip()} was added to {cls.strip()} — {division.strip()}")
    return {"ok":True,"message":f"{name.strip()} registered successfully."}

@app.put("/api/students/{student_id}")
def update_student(student_id:str,payload:StudentUpdate):
    with DB_LOCK:
        c=db()
        cur=c.execute("""UPDATE students SET name=?,class_name=?,division=?,email=?,phone=?,updated_at=? WHERE student_id=?""",
                     (payload.name.strip(),payload.cls.strip(),payload.division.strip(),payload.email.strip(),payload.phone.strip(),
                      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),student_id))
        c.commit(); c.close()
    if cur.rowcount==0: raise HTTPException(404,"Student not found.")
    add_activity("Student updated",f"{payload.name.strip()} details were updated")
    return {"ok":True}

@app.post("/api/students/{student_id}/face")
async def update_face(student_id:str,image:UploadFile=File(...)):
    try: embedding=represent_face(decode_image(await image.read()))
    except Exception as exc: raise HTTPException(422,str(exc)) from exc
    existing,d=best_match(embedding)
    if existing is not None and existing["student_id"]!=student_id and d<=MATCH_THRESHOLD:
        raise HTTPException(409,f"This face already matches {existing['name']} ({existing['student_id']}).")
    with DB_LOCK:
        c=db(); cur=c.execute("UPDATE students SET embedding=?,updated_at=? WHERE student_id=?",
                              (enc(embedding),datetime.now().strftime("%Y-%m-%d %H:%M:%S"),student_id))
        c.commit(); c.close()
    if cur.rowcount==0: raise HTTPException(404,"Student not found.")
    add_activity("Face updated",f"{student_id} face registration updated")
    return {"ok":True,"message":"Face embedding updated successfully."}

@app.delete("/api/students/{student_id}")
def delete_student(student_id:str):
    with DB_LOCK:
        c=db(); row=c.execute("SELECT name FROM students WHERE student_id=?",(student_id,)).fetchone()
        if not row: c.close(); raise HTTPException(404,"Student not found.")
        c.execute("DELETE FROM students WHERE student_id=?",(student_id,)); c.commit(); c.close()
    add_activity("Student deleted",f"{row['name']} was removed")
    return {"ok":True}

@app.post("/api/recognize")
async def recognize(image:UploadFile=File(...),subject:str=Form("Artificial Intelligence"),room:str=Form("")):
    try: query=represent_face(decode_image(await image.read()))
    except Exception as exc: raise HTTPException(422,str(exc)) from exc
    student,d=best_match(query)
    if student is None or d>MATCH_THRESHOLD:
        return {"ok":True,"recognized":False,"message":"Unknown Face — Not Registered",
                "distance":None if student is None else round(d,4)}
    conf=confidence(d); today=date.today().isoformat(); now=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject=subject.strip() or "Artificial Intelligence"
    with DB_LOCK:
        c=db(); existing=c.execute("""SELECT * FROM attendance WHERE student_db_id=? AND attendance_date=? AND subject=?""",
                                   (student["id"],today,subject)).fetchone()
        if existing:
            c.close()
            return {"ok":True,"recognized":True,"already_present":True,"student":student_dict(student),
                    "confidence":conf,"distance":round(d,4),"message":"Already Present","marked_at":existing["marked_at"]}
        c.execute("""INSERT INTO attendance(student_db_id,attendance_date,subject,room,status,marked_at,confidence,distance,method)
                     VALUES(?,?,?,?,?,?,?,?,?)""",
                  (student["id"],today,subject,room.strip(),"Present",now,conf,d,"face"))
        c.commit(); c.close()
    add_activity("Attendance completed",f"{student['name']} recognized and marked Present")
    return {"ok":True,"recognized":True,"already_present":False,"student":student_dict(student),
            "confidence":conf,"distance":round(d,4),"message":"Present","marked_at":now}

if __name__=="__main__":
    print("="*70); print("NEXORA AI FACE RECOGNITION ATTENDANCE — REAL DATA MODE"); print("="*70)
    print(f"Database : {DB_PATH}"); print(f"Model    : {MODEL_NAME}"); print(f"Threshold: {MATCH_THRESHOLD} cosine distance")
    print("Recognition: ON-DEMAND; no continuous polling"); print("URL      : http://127.0.0.1:8000"); print("="*70)
    uvicorn.run(app,host="127.0.0.1",port=8000,reload=False,workers=1)
