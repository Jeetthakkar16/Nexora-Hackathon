import json
from backend.core.database import get_db, rows
from backend.optimization.vrp import optimize

def run_optimization(objective="BALANCED"):
    objective=objective.upper()
    with get_db() as db:
        vehicles=rows(db.execute("SELECT * FROM vehicles WHERE available=1"))
        shipments=rows(db.execute("SELECT * FROM shipments WHERE status IN ('PLANNED','READY')"))
    result=optimize(vehicles,shipments,objective)
    with get_db() as db:
        cur=db.execute("INSERT INTO optimization_runs(objective,status,result_json) VALUES(?,?,?)",(objective,result.get("status","UNKNOWN"),json.dumps(result)))
        # Persist the optimizer's assignment so the rest of the platform sees the plan.
        for route in result.get("routes",[]):
            for code in route.get("shipment_codes",[]):
                db.execute("UPDATE shipments SET assigned_vehicle_id=?,status='READY',updated_at=CURRENT_TIMESTAMP WHERE shipment_code=? AND status IN ('PLANNED','READY')",(route["vehicle_id"],code))
    result["run_id"]=cur.lastrowid
    return result
