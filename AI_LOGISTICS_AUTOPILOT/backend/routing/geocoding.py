import requests
from backend.config import settings

def geocode(address: str):
    if not address:
        return None
    try:
        r = requests.get(
            settings.nominatim_url,
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": settings.geocode_user_agent},
            timeout=settings.request_timeout_seconds,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return None
        return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])}
    except requests.RequestException:
        return None
