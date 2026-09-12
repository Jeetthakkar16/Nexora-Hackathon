from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.telemetry_service import ingest
router=APIRouter(prefix="/api/telemetry",tags=["Telemetry"])
class TelemetryIn(BaseModel):
    vehicle_id:int
    latitude:float
    longitude:float
    speed_kph:float|None=None
    heading:float|None=None
@router.post("")
def post(x:TelemetryIn): return ingest(**x.model_dump())
