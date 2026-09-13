from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.services.telemetry_service import ingest
router=APIRouter(prefix="/api/telemetry",tags=["Telemetry"])
class TelemetryIn(BaseModel):
    vehicle_id:int
    latitude:float=Field(ge=-90,le=90)
    longitude:float=Field(ge=-180,le=180)
    speed_kph:float|None=Field(default=None,ge=0)
    heading:float|None=Field(default=None,ge=0,le=360)
@router.post("")
def post(x:TelemetryIn):
    try:return ingest(**x.model_dump())
    except ValueError as e:raise HTTPException(404,str(e))
