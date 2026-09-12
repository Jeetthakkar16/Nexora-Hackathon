from fastapi import APIRouter
from backend.core.database import get_db, rows
router=APIRouter(prefix="/api/dashboard",tags=["Dashboard"])

@router.get("")
def dashboard():
    with get_db() as db:
        v=rows(db.execute("SELECT * FROM vehicles"))
        s=rows(db.execute("SELECT * FROM shipments"))
        d=rows(db.execute("SELECT * FROM decisions WHERE status='PENDING'"))
    active=sum(1 for x in v if x["available"])
    return {"fleet":{"total":len(v),"active":active,"unavailable":len(v)-active},
            "shipments":{"total":len(s),"in_transit":sum(x["status"]=="IN_TRANSIT" for x in s),
                         "planned":sum(x["status"] in ("PLANNED","READY") for x in s)},
            "pending_decisions":len(d)}
