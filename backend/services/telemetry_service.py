from backend.core.database import get_db

def ingest(vehicle_id, latitude, longitude, speed_kph=None, heading=None):
    with get_db() as db:
        cur=db.execute("SELECT id FROM vehicles WHERE id=?",(vehicle_id,))
        if cur.fetchone() is None: raise ValueError("Vehicle not found")
        db.execute("INSERT INTO telemetry(vehicle_id,latitude,longitude,speed_kph,heading) VALUES(?,?,?,?,?)",(vehicle_id,latitude,longitude,speed_kph,heading))
        db.execute("UPDATE vehicles SET latitude=?,longitude=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",(latitude,longitude,vehicle_id))
    return {"status":"INGESTED","vehicle_id":vehicle_id,"latitude":latitude,"longitude":longitude}
