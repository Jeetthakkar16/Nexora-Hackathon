from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.core.database import get_db, rows
from backend.routing.geocoding import geocode

router = APIRouter(prefix="/api/vehicles", tags=["Fleet"])

class VehicleIn(BaseModel):
    vehicle_code: str = Field(min_length=2, max_length=40)
    vehicle_type: str = "TRUCK"
    capacity_kg: float = Field(ge=0)
    available: bool = True
    location: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    fuel_level: float | None = Field(default=None, ge=0, le=100)

@router.get("")
def list_vehicles():
    with get_db() as db:
        return rows(db.execute("SELECT * FROM vehicles ORDER BY id DESC"))

@router.post("", status_code=201)
def add_vehicle(v: VehicleIn):
    data = v.model_dump()
    if (data["latitude"] is None) != (data["longitude"] is None):
        raise HTTPException(400, "Latitude and longitude must be supplied together")
    if data["latitude"] is None and data["location"]:
        g = geocode(data["location"])
        if not g:
            raise HTTPException(400, f"Could not geocode vehicle location: {data['location']}")
        data["latitude"], data["longitude"] = g["lat"], g["lon"]
    try:
        with get_db() as db:
            cur = db.execute(
                "INSERT INTO vehicles(vehicle_code,vehicle_type,capacity_kg,available,status,latitude,longitude,fuel_level) VALUES(?,?,?,?,?,?,?,?)",
                (data["vehicle_code"].strip(), data["vehicle_type"].upper(), data["capacity_kg"],
                 int(data["available"]), "AVAILABLE" if data["available"] else "UNAVAILABLE",
                 data["latitude"], data["longitude"], data["fuel_level"]),
            )
            return {"id": cur.lastrowid, **data, "vehicle_code": data["vehicle_code"].strip(),
                    "vehicle_type": data["vehicle_type"].upper(),
                    "status": "AVAILABLE" if data["available"] else "UNAVAILABLE"}
    except Exception as e:
        raise HTTPException(409, f"Could not add vehicle: {e}")

@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int):
    with get_db() as db:
        cur = db.execute("DELETE FROM vehicles WHERE id=?", (vehicle_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Vehicle not found")
    return {"deleted": vehicle_id}
