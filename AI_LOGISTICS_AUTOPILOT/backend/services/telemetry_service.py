from backend.core.database import get_db

def ingest(vehicle_id,latitude,longitude,speed_kph=None,heading=None):
    with get_db() as db:
        db.execute("INSERT INTO telemetry(vehicle_id,latitude,longitude,speed_kph,heading) VALUES(?,?,?,?,?)",
                   (vehicle_id,latitude,longitude,speed_kph,heading))
        db.execute("UPDATE vehicles SET latitude=?,longitude=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
                   (latitude,longitude,vehicle_id))
    return {"status":"accepted","vehicle_id":vehicle_id}
