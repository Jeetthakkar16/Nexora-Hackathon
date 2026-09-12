import sqlite3
from contextlib import contextmanager
from backend.config import absolute_db_path

SCHEMA = '''
CREATE TABLE IF NOT EXISTS vehicles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 vehicle_code TEXT UNIQUE NOT NULL,
 vehicle_type TEXT NOT NULL DEFAULT 'TRUCK',
 capacity_kg REAL NOT NULL DEFAULT 0,
 available INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'AVAILABLE',
 latitude REAL, longitude REAL, fuel_level REAL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shipments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 shipment_code TEXT UNIQUE NOT NULL,
 origin TEXT NOT NULL, destination TEXT NOT NULL,
 origin_lat REAL, origin_lon REAL, destination_lat REAL, destination_lon REAL,
 weight_kg REAL NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 3,
 deadline TEXT, status TEXT NOT NULL DEFAULT 'PLANNED',
 assigned_vehicle_id INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(assigned_vehicle_id) REFERENCES vehicles(id)
);
CREATE TABLE IF NOT EXISTS optimization_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 objective TEXT NOT NULL, status TEXT NOT NULL, result_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS scenarios (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 scenario_type TEXT NOT NULL, severity REAL NOT NULL,
 input_json TEXT NOT NULL, result_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS decisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 scenario_id INTEGER, recommendation TEXT NOT NULL, rationale TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING', expected_impact_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TEXT,
 FOREIGN KEY(scenario_id) REFERENCES scenarios(id)
);
CREATE TABLE IF NOT EXISTS telemetry (
 id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL,
 latitude REAL NOT NULL, longitude REAL NOT NULL, speed_kph REAL, heading REAL,
 recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
);
CREATE TABLE IF NOT EXISTS model_registry (
 id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL, version TEXT NOT NULL,
 artifact_path TEXT, metrics_json TEXT NOT NULL, promoted INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS training_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT NOT NULL, rows_used INTEGER NOT NULL,
 metrics_json TEXT NOT NULL, status TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
'''

def init_db():
    path = absolute_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path, timeout=30) as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA busy_timeout=30000")
        con.executescript(SCHEMA)
        con.commit()

@contextmanager
def get_db():
    path = absolute_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=30000")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()

def rows(cursor):
    return [dict(r) for r in cursor.fetchall()]
