from fastapi import APIRouter
from pydantic import BaseModel
from backend.core.database import get_db, rows
from backend.routing.multimodal import police_response_estimates

router = APIRouter(prefix="/api/sos", tags=["Distress SOS"])

class SOSRequest(BaseModel):
    vehicle_id: int | None = None
    latitude: float
    longitude: float
    trigger: str = "AUTOMATIC_INCIDENT"
    severity: str = "HIGH"
    message: str = "Distress event detected"

@router.post("/trigger")
def trigger(req: SOSRequest):
    stations = police_response_estimates(req.latitude, req.longitude)
    with get_db() as con:
        cur = con.execute(
            'INSERT INTO sos_events '
            '(vehicle_id,latitude,longitude,trigger,severity,message,status,police_json) '
            'VALUES (?,?,?,?,?,?,?,?)',
            (req.vehicle_id, req.latitude, req.longitude, req.trigger,
             req.severity, req.message, "PREPARED", str(stations)),
        )
        event_id = cur.lastrowid
    return {
        "event_id": event_id, "status": "PREPARED",
        "incident": {"latitude": req.latitude, "longitude": req.longitude},
        "nearby_police": stations,
        "dispatch_note": "No external emergency service is contacted by this prototype. Dispatch requires an authorized police/emergency-services integration."
    }

@router.get("/events")
def events():
    with get_db() as con:
        return rows(con.execute("SELECT * FROM sos_events ORDER BY id DESC LIMIT 50"))
