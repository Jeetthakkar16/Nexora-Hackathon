def simulate(vehicles, shipments, scenario_type, severity):
    severity=max(0.0,min(1.0,float(severity)))
    total_capacity=sum(float(v.get("capacity_kg") or 0) for v in vehicles if v.get("available"))
    total_load=sum(float(s.get("weight_kg") or 0) for s in shipments if s.get("status") in ("PLANNED","READY","IN_TRANSIT"))
    utilization=(total_load/total_capacity*100) if total_capacity else 100
    impact={"VEHICLE_BREAKDOWN":.55,"TRAVEL_TIME_SURGE":.35,"DEMAND_SURGE":.50,
            "VEHICLE_CAPACITY_LOSS":.60,"WAREHOUSE_OUTAGE":.45,"CUSTOM":.40}.get(scenario_type,.40)
    base=min(99,max(1,12+severity*impact*100+max(0,utilization-70)*.5))
    raw=[
        ("KEEP CURRENT",base,100,15+severity*90),
        ("REROUTE",base-25*severity,100+8*severity,12+severity*55),
        ("REASSIGN",base-38*severity,100+14*severity,10+severity*40),
        ("TRANSFER / SPLIT",base-31*severity,100+19*severity,8+severity*34)
    ]
    strategies=[]
    for name,risk,cost,recovery in raw:
        risk=max(2,min(99,risk))
        feasible=risk<92 and not (scenario_type=="VEHICLE_BREAKDOWN" and severity>.95 and name=="KEEP CURRENT")
        strategies.append({"strategy":name,"feasible":feasible,"risk_pct":round(risk,1),
                           "cost_index":round(cost,1),"recovery_minutes":round(max(1,recovery))})
    feasible=[s for s in strategies if s["feasible"]]
    recommendation=min(feasible,key=lambda x:(x["risk_pct"],x["cost_index"]))["strategy"] if feasible else None
    return {"scenario_type":scenario_type,"severity":severity,
            "baseline":{"capacity_kg":round(total_capacity,1),"load_kg":round(total_load,1),"utilization_pct":round(utilization,1)},
            "strategies":strategies,"recommendation":recommendation,
            "resilience_score":round(max(0,min(100,100-base)),1)}
