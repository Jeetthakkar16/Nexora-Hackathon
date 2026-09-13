from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.routing.multimodal import geocode, road_route, ferry_candidates

router = APIRouter(prefix="/api/multimodal", tags=["Multimodal Routing"])

class RouteRequest(BaseModel):
    origin: str
    destination: str
    vehicle_type: str = "TRUCK"
    road_rate_per_km: float = Field(18.0, ge=0)
    driver_rate_per_hour: float = Field(180.0, ge=0)
    fixed_handling: float = Field(250.0, ge=0)
    ferry_rate_per_km: float = Field(0.0, ge=0)
    ferry_fixed_fee: float = Field(0.0, ge=0)

@router.post("/plan")
def plan(req: RouteRequest):
    try:
        origin = geocode(req.origin)
        destination = geocode(req.destination)
        road = road_route([(origin["lat"], origin["lon"]),
                           (destination["lat"], destination["lon"])])

        road_bill = (
            road["distance_km"] * req.road_rate_per_km
            + road["duration_minutes"] / 60 * req.driver_rate_per_hour
            + req.fixed_handling
        )

        ferries = ferry_candidates(origin, destination)
        for f in ferries:
            total_road = f["road_to_terminal_km"] + f["road_from_terminal_km"]
            total_time = (f["road_to_terminal_minutes"] + f["water_minutes"]
                          + f["road_from_terminal_minutes"])
            total_cost = (
                total_road * req.road_rate_per_km
                + total_time / 60 * req.driver_rate_per_hour
                + req.fixed_handling
                + f["water_distance_km"] * req.ferry_rate_per_km
                + req.ferry_fixed_fee
            )
            f["total_distance_km"] = round(total_road + f["water_distance_km"], 2)
            f["duration_minutes"] = round(total_time, 1)
            f["estimated_bill"] = round(total_cost, 2)
            f["bill_breakdown"] = {
                "road_transport": round(total_road * req.road_rate_per_km, 2),
                "driver_time": round(total_time / 60 * req.driver_rate_per_hour, 2),
                "handling": round(req.fixed_handling, 2),
                "ferry_variable": round(f["water_distance_km"] * req.ferry_rate_per_km, 2),
                "ferry_fixed": round(req.ferry_fixed_fee, 2),
            }

        best_ferry = min(ferries, key=lambda x: x["estimated_bill"]) if ferries else None
        return {
            "source_policy": {
                "map": "OpenStreetMap", "geocoder": "Nominatim",
                "road_router": "OSRM", "ferry_discovery": "OpenStreetMap/Overpass"
            },
            "origin": origin, "destination": destination,
            "road_option": {
                "mode": "ROAD", "distance_km": round(road["distance_km"], 2),
                "duration_minutes": round(road["duration_minutes"], 1),
                "estimated_bill": round(road_bill, 2),
                "bill_breakdown": {
                    "road_transport": round(road["distance_km"] * req.road_rate_per_km, 2),
                    "driver_time": round(road["duration_minutes"] / 60 * req.driver_rate_per_hour, 2),
                    "handling": round(req.fixed_handling, 2)
                },
                "geometry": road["geometry"]
            },
            "ferry_option": best_ferry, "ferry_candidates": ferries,
            "note": "A ferry/boat leg is shown only when an OSM ferry connection is discovered. Monetary rates are transparent operator-configurable inputs, not invented market prices."
        }
    except Exception as e:
        raise HTTPException(502, str(e))
