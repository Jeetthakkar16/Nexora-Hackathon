from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,Field
from backend.core.database import get_db,rows
from backend.routing.geocoding import geocode
router=APIRouter(prefix="/api/shipments",tags=["Shipments"])

class ShipmentIn(BaseModel):
    shipment_code:str=Field(min_length=2)
    origin:str=Field(min_length=2)
    destination:str=Field(min_length=2)
    weight_kg:float=Field(ge=0)
    priority:int=Field(default=3,ge=1,le=5)
    deadline:str|None=None
    origin_lat:float|None=None
    origin_lon:float|None=None
    destination_lat:float|None=None
    destination_lon:float|None=None
    status:str="PLANNED"

@router.get("")
def list_shipments():
    with get_db() as db:return rows(db.execute("SELECT * FROM shipments ORDER BY id DESC"))

@router.post("",status_code=201)
def add_shipment(s:ShipmentIn):
    data=s.model_dump()
    if data["destination_lat"] is None or data["destination_lon"] is None:
        g=geocode(data["destination"])
        if g:data["destination_lat"],data["destination_lon"]=g["lat"],g["lon"]
    if data["origin_lat"] is None or data["origin_lon"] is None:
        g=geocode(data["origin"])
        if g:data["origin_lat"],data["origin_lon"]=g["lat"],g["lon"]
    try:
        with get_db() as db:
            cur=db.execute("INSERT INTO shipments(shipment_code,origin,destination,origin_lat,origin_lon,destination_lat,destination_lon,weight_kg,priority,deadline,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                           (data["shipment_code"],data["origin"],data["destination"],data["origin_lat"],data["origin_lon"],data["destination_lat"],data["destination_lon"],data["weight_kg"],data["priority"],data["deadline"],data["status"]))
            return {"id":cur.lastrowid,**data}
    except Exception as e: raise HTTPException(409,str(e))
