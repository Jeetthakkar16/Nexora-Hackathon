import math
import requests
from typing import Any

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM = "https://router.project-osrm.org"
OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "LogiShield-SIH/1.0 (open-source logistics research prototype)"

def _get(url, params=None, timeout=25):
    r = requests.get(url, params=params, headers={"User-Agent": UA}, timeout=timeout)
    r.raise_for_status()
    return r.json()

def geocode(query: str) -> dict[str, Any]:
    data = _get(
        f"{NOMINATIM}/search",
        {"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
    )
    if not data:
        raise ValueError(f"Location not found: {query}")
    x = data[0]
    return {"query": query, "lat": float(x["lat"]), "lon": float(x["lon"]),
            "display_name": x.get("display_name", query)}

def road_route(points: list[tuple[float, float]]) -> dict[str, Any]:
    if len(points) < 2:
        raise ValueError("At least two points are required")
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    data = _get(
        f"{OSRM}/route/v1/driving/{coords}",
        {"overview": "full", "geometries": "geojson", "steps": "true"},
    )
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError("OSRM could not route these points")
    r = data["routes"][0]
    return {"distance_km": r["distance"] / 1000, "duration_minutes": r["duration"] / 60,
            "geometry": r["geometry"], "legs": r.get("legs", [])}

def haversine_km(a, b):
    R = 6371.0088
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(h))

def nearby_police(lat: float, lon: float, radius_m: int = 25000):
    query = (
        '[out:json][timeout:20];'
        f'(node["amenity"="police"](around:{radius_m},{lat},{lon});'
        f'way["amenity"="police"](around:{radius_m},{lat},{lon});'
        f'relation["amenity"="police"](around:{radius_m},{lat},{lon}););'
        'out center tags;'
    )
    r = requests.post(OVERPASS, data=query, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    items = []
    for e in r.json().get("elements", []):
        tags = e.get("tags", {})
        if e["type"] == "node":
            plat, plon = e.get("lat"), e.get("lon")
        else:
            c = e.get("center", {})
            plat, plon = c.get("lat"), c.get("lon")
        if plat is None or plon is None:
            continue
        items.append({
            "osm_id": f'{e["type"]}/{e["id"]}',
            "name": tags.get("name", "Police station (OSM)"),
            "lat": plat, "lon": plon,
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "operator": tags.get("operator"),
        })
    return items

def police_response_estimates(lat: float, lon: float, max_stations: int = 6):
    stations = nearby_police(lat, lon)
    stations.sort(key=lambda s: haversine_km((lat, lon), (s["lat"], s["lon"])))
    out = []
    for s in stations[:max_stations]:
        try:
            rr = road_route([(s["lat"], s["lon"]), (lat, lon)])
            dist, mins = rr["distance_km"], rr["duration_minutes"]
        except Exception:
            dist = haversine_km((lat, lon), (s["lat"], s["lon"])) * 1.25
            mins = dist / 35 * 60
        s = dict(s)
        s.update({"road_distance_km": round(dist, 2), "eta_minutes": round(mins, 1)})
        out.append(s)
    return out

def ferry_candidates(origin: dict, destination: dict):
    lat1, lon1 = origin["lat"], origin["lon"]
    lat2, lon2 = destination["lat"], destination["lon"]
    south, north = min(lat1, lat2) - 0.35, max(lat1, lat2) + 0.35
    west, east = min(lon1, lon2) - 0.35, max(lon1, lon2) + 0.35

    query = (
        '[out:json][timeout:25];'
        f'(node["amenity"="ferry_terminal"]({south},{west},{north},{east});'
        f'node["public_transport"="station"]["ferry"="yes"]({south},{west},{north},{east});'
        f'way["route"="ferry"]({south},{west},{north},{east});'
        f'relation["route"="ferry"]({south},{west},{north},{east}););'
        'out center tags;'
    )
    try:
        r = requests.post(OVERPASS, data=query, headers={"User-Agent": UA}, timeout=35)
        r.raise_for_status()
        elems = r.json().get("elements", [])
    except Exception:
        return []

    terminals = []
    for e in elems:
        tags = e.get("tags", {})
        if tags.get("amenity") == "ferry_terminal" or tags.get("ferry") == "yes":
            if e["type"] == "node":
                lat, lon = e.get("lat"), e.get("lon")
            else:
                c = e.get("center", {})
                lat, lon = c.get("lat"), c.get("lon")
            if lat is not None:
                terminals.append({"name": tags.get("name", "Ferry terminal (OSM)"),
                                  "lat": lat, "lon": lon})

    pairs = []
    for i, a in enumerate(terminals):
        for b in terminals[i + 1:]:
            water = haversine_km((a["lat"], a["lon"]), (b["lat"], b["lon"]))
            if 0.2 <= water <= 150:
                pairs.append((water, a, b))
    pairs.sort(key=lambda x: x[0])

    candidates = []
    for water, a, b in pairs[:4]:
        try:
            pre = road_route([(lat1, lon1), (a["lat"], a["lon"])])
            post = road_route([(b["lat"], b["lon"]), (lat2, lon2)])
            candidates.append({
                "mode": "FERRY",
                "source": "OpenStreetMap ferry terminals",
                "from_terminal": a, "to_terminal": b,
                "road_to_terminal_km": round(pre["distance_km"], 2),
                "road_from_terminal_km": round(post["distance_km"], 2),
                "water_distance_km": round(water, 2),
                "road_to_terminal_minutes": round(pre["duration_minutes"], 1),
                "water_minutes": round(water / 22 * 60, 1),
                "road_from_terminal_minutes": round(post["duration_minutes"], 1),
                "pre_geometry": pre["geometry"], "post_geometry": post["geometry"],
            })
        except Exception:
            pass
    return candidates
