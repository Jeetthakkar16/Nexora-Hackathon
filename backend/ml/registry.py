import json
from backend.core.database import get_db, rows

def models():
    with get_db() as db: data=rows(db.execute("SELECT * FROM model_registry ORDER BY id DESC LIMIT 100"))
    for x in data:
        try: x["metrics"]=json.loads(x.pop("metrics_json"))
        except Exception: x["metrics"]={}
    return data

def training_runs():
    with get_db() as db: data=rows(db.execute("SELECT * FROM training_runs ORDER BY id DESC LIMIT 100"))
    for x in data:
        try: x["metrics"]=json.loads(x.pop("metrics_json"))
        except Exception: x["metrics"]={}
    return data
