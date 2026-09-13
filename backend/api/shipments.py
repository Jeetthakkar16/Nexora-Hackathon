from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.core.database import get_db, rows
from backend.routing.geocoding import geocode

router = APIRouter(prefix="/api/shipments", tags=["Shipments"])

class ShipmentIn(BaseModel):
    shipment_code: str = Field(min_length=2, max_length=40)
    origin: str = Field(min_length=2)
    destination: str = Field(min_length=2)
    weight_kg: float = Field(ge=0)
    priority: int = Field(default=3, ge=1, le=5)
    deadline: str | None = None
    origin_lat: float | None = Field(default=None, ge=-90, le=90)
    origin_lon: float | None = Field(default=None, ge=-180, le=180)
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lon: float | None = Field(default=None, ge=-180, le=180)
    status: str = "PLANNED"

@router.get("")
def list_shipments():
    with get_db() as db:
        return rows(db.execute("SELECT * FROM shipments ORDER BY id DESC"))

@router.post("", status_code=201)
def add_shipment(s: ShipmentIn):
    data = s.model_dump()
    if (data["origin_lat"] is None) != (data["origin_lon"] is None):
        raise HTTPException(400, "Origin latitude and longitude must be supplied together")
    if (data["destination_lat"] is None) != (data["destination_lon"] is None):
        raise HTTPException(400, "Destination latitude and longitude must be supplied together")
    if data["destination_lat"] is None:
        g = geocode(data["destination"])
        if not g:
            raise HTTPException(400, f"Could not geocode destination: {data['destination']}")
        data["destination_lat"], data["destination_lon"] = g["lat"], g["lon"]
    if data["origin_lat"] is None:
        g = geocode(data["origin"])
        if not g:
            raise HTTPException(400, f"Could not geocode origin: {data['origin']}")
        data["origin_lat"], data["origin_lon"] = g["lat"], g["lon"]
    data["shipment_code"] = data["shipment_code"].strip()
    data["status"] = data["status"].upper()
    try:
        with get_db() as db:
            cur = db.execute(
                "INSERT INTO shipments(shipment_code,origin,destination,origin_lat,origin_lon,destination_lat,destination_lon,weight_kg,priority,deadline,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (data["shipment_code"], data["origin"], data["destination"], data["origin_lat"], data["origin_lon"],
                 data["destination_lat"], data["destination_lon"], data["weight_kg"], data["priority"], data["deadline"], data["status"]),
            )
            return {"id": cur.lastrowid, **data}
    except Exception as e:
        raise HTTPException(409, f"Could not add shipment: {e}")

@router.delete("/{shipment_id}")
def delete_shipment(shipment_id: int):
    with get_db() as db:
        cur = db.execute("DELETE FROM shipments WHERE id=?", (shipment_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Shipment not found")
    return {"deleted": shipment_id}
