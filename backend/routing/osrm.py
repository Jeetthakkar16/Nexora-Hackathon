import requests
from backend.config import settings

def route_geometry(points):
    if len(points)<2:return None
    coords=";".join(f"{lon},{lat}" for lat,lon in points)
    url=f"{settings.osrm_url.rstrip('/')}/route/v1/driving/{coords}"
    r=requests.get(url,params={"overview":"full","geometries":"geojson"},headers={"User-Agent":settings.geocode_user_agent},timeout=settings.request_timeout_seconds)
    r.raise_for_status();data=r.json()
    if data.get("code")!="Ok" or not data.get("routes"):return None
    return data["routes"][0]["geometry"]
