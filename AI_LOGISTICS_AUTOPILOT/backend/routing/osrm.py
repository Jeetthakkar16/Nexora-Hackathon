import requests
from backend.config import settings

def route(points):
    if len(points) < 2:
        return {"distance_km": 0.0, "duration_min": 0.0, "geometry": []}
    coords = ";".join(f"{lon},{lat}" for lat,lon in points)
    try:
        r = requests.get(
            f"{settings.osrm_base_url}/route/v1/driving/{coords}",
            params={"overview":"full","geometries":"geojson","steps":"false"},
            timeout=settings.request_timeout_seconds,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("code") != "Ok":
            return None
        rt = data["routes"][0]
        return {
            "distance_km": round(rt["distance"]/1000,2),
            "duration_min": round(rt["duration"]/60,1),
            "geometry": [[c[1],c[0]] for c in rt["geometry"]["coordinates"]],
        }
    except (requests.RequestException, KeyError, IndexError):
        return None
