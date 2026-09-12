import json
from backend.core.database import get_db, rows
from backend.optimization.vrp import optimize

def run_optimization(objective="BALANCED"):
    with get_db() as db:
        vehicles=rows(db.execute("SELECT * FROM vehicles"))
        shipments=rows(db.execute("SELECT * FROM shipments WHERE status IN ('PLANNED','READY')"))
    result=optimize(vehicles,shipments,objective)
    with get_db() as db:
        cur=db.execute("INSERT INTO optimization_runs(objective,status,result_json) VALUES(?,?,?)",
                       (objective,result.get("status","UNKNOWN"),json.dumps(result)))
    result["run_id"]=cur.lastrowid
    return result
