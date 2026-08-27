
import importlib.util
import sqlite3
from pathlib import Path

checks = [
    ("fastapi", "FastAPI"),
    ("uvicorn", "Uvicorn"),
    ("cv2", "OpenCV"),
    ("numpy", "NumPy"),
    ("deepface", "DeepFace"),
    ("tensorflow", "TensorFlow"),
    ("tf_keras", "TF-Keras"),
    ("pydantic", "Pydantic"),
]
failed = False
for module, label in checks:
    ok = importlib.util.find_spec(module) is not None
    print(f"{label:<12} {'PASS' if ok else 'FAIL'}")
    failed |= not ok

try:
    from deepface import DeepFace
    DeepFace.build_model("Facenet")
    print(f"{'FaceNet':<12} PASS")
except Exception as exc:
    print(f"{'FaceNet':<12} FAIL: {exc}")
    failed = True

db_path = Path(__file__).resolve().parent / "data" / "attendance.db"
conn = sqlite3.connect(db_path)
tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required = {"students", "attendance_sessions", "attendance", "activities"}
print(f"{'SQLite schema':<12} {'PASS' if required <= tables else 'FAIL'}")
conn.close()

raise SystemExit(1 if failed else 0)
