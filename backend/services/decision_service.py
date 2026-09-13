import json
from backend.core.database import get_db, rows

def list_decisions():
    with get_db() as db:
        data=rows(db.execute("SELECT * FROM decisions ORDER BY id DESC LIMIT 100"))
    for x in data:
        try: x["expected_impact"]=json.loads(x["expected_impact_json"])
        except Exception: x["expected_impact"]={}
    return data

def decide(decision_id,status):
    status=status.upper()
    if status not in ("APPROVED","REJECTED"):
        raise ValueError("Decision status must be APPROVED or REJECTED")
    with get_db() as db:
        cur=db.execute("UPDATE decisions SET status=?,decided_at=CURRENT_TIMESTAMP WHERE id=?",(status,decision_id))
        if cur.rowcount==0: raise ValueError("Decision not found")
    return {"id":decision_id,"status":status}
