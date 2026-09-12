from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,Field
from backend.core.database import get_db,rows
router=APIRouter(prefix="/api/vehicles",tags=["Fleet"])

class VehicleIn(BaseModel):
    vehicle_code:str=Field(min_length=2)
    vehicle_type:str="TRUCK"
    capacity_kg:float=Field(ge=0)
    available:bool=True
    latitude:float|None=None
    longitude:float|None=None
    fuel_level:float|None=Field(default=None,ge=0,le=100)

@router.get("")
def list_vehicles():
    with get_db() as db:return rows(db.execute("SELECT * FROM vehicles ORDER BY id DESC"))

@router.post("",status_code=201)
def add_vehicle(v:VehicleIn):
    try:
        with get_db() as db:
            cur=db.execute("INSERT INTO vehicles(vehicle_code,vehicle_type,capacity_kg,available,latitude,longitude,fuel_level) VALUES(?,?,?,?,?,?,?)",
                           (v.vehicle_code,v.vehicle_type,v.capacity_kg,int(v.available),v.latitude,v.longitude,v.fuel_level))
            return {"id":cur.lastrowid,**v.model_dump()}
    except Exception as e: raise HTTPException(409,str(e))

@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id:int):
    with get_db() as db:
        cur=db.execute("DELETE FROM vehicles WHERE id=?",(vehicle_id,))
        if cur.rowcount==0: raise HTTPException(404,"Vehicle not found")
    return {"deleted":vehicle_id}
