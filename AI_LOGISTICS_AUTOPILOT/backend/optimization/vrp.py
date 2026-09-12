from backend.routing.matrix import distance_matrix, haversine_km

def optimize(vehicles, shipments, objective="BALANCED"):
    valid = [v for v in vehicles if v.get("available") and v.get("latitude") is not None and v.get("longitude") is not None]
    jobs = [s for s in shipments if s.get("destination_lat") is not None and s.get("destination_lon") is not None]
    if not valid:
        return {"status":"INFEASIBLE","reason":"No available vehicles with GPS coordinates.","routes":[]}
    if not jobs:
        return {"status":"NO_WORK","routes":[],"unassigned":[]}
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
        return _ortools(valid,jobs,objective,pywrapcp,routing_enums_pb2)
    except Exception:
        return _greedy(valid,jobs,objective)

def _greedy(vehicles,jobs,objective):
    state={v["id"]:{"v":v,"remaining":float(v["capacity_kg"]),"jobs":[]} for v in vehicles}
    unassigned=[]
    for job in sorted(jobs,key=lambda x:(x.get("priority",3),-float(x.get("weight_kg",0)))):
        candidates=[x for x in state.values() if x["remaining"]>=float(job["weight_kg"])]
        if not candidates:
            unassigned.append(job["shipment_code"]); continue
        chosen=min(candidates,key=lambda x:len(x["jobs"]))
        chosen["jobs"].append(job)
        chosen["remaining"]-=float(job["weight_kg"])
    routes=[]
    for x in state.values():
        if not x["jobs"]: continue
        pts=[(x["v"]["latitude"],x["v"]["longitude"])]
        pts += [(j["destination_lat"],j["destination_lon"]) for j in x["jobs"]]
        dist=sum(haversine_km(pts[i],pts[i+1]) for i in range(len(pts)-1))
        routes.append({
            "vehicle_id":x["v"]["id"],"vehicle_code":x["v"]["vehicle_code"],
            "shipment_codes":[j["shipment_code"] for j in x["jobs"]],
            "distance_km":round(dist,2),
            "load_kg":round(float(x["v"]["capacity_kg"])-x["remaining"],2)
        })
    return {"status":"OPTIMAL_FALLBACK","objective":objective,"routes":routes,"unassigned":unassigned}

def _ortools(vehicles,jobs,objective,pywrapcp,routing_enums_pb2):
    points=[(v["latitude"],v["longitude"]) for v in vehicles]
    points += [(s["destination_lat"],s["destination_lon"]) for s in jobs]
    matrix=distance_matrix(points)
    nveh=len(vehicles)
    manager=pywrapcp.RoutingIndexManager(len(points),nveh,list(range(nveh)),list(range(nveh)))
    routing=pywrapcp.RoutingModel(manager)
    def dist_cb(fi,ti):
        return int(matrix[manager.IndexToNode(fi)][manager.IndexToNode(ti)]*1000)
    transit=routing.RegisterTransitCallback(dist_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)
    demands=[0]*nveh+[int(max(0,float(s["weight_kg"]))) for s in jobs]
    def demand_cb(i): return demands[manager.IndexToNode(i)]
    didx=routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(
        didx,0,[int(max(0,float(v["capacity_kg"]))) for v in vehicles],True,"Capacity"
    )
    params=pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy=routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic=routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.seconds=5
    sol=routing.SolveWithParameters(params)
    if not sol:
        return {"status":"INFEASIBLE","reason":"No feasible capacity route found.","routes":[]}
    routes=[]
    for vi,v in enumerate(vehicles):
        idx=routing.Start(vi); codes=[]; dist=0; load=0
        while not routing.IsEnd(idx):
            node=manager.IndexToNode(idx)
            if node>=nveh:
                j=jobs[node-nveh]; codes.append(j["shipment_code"]); load+=float(j["weight_kg"])
            nxt=sol.Value(routing.NextVar(idx))
            dist+=routing.GetArcCostForVehicle(idx,nxt,vi); idx=nxt
        if codes:
            routes.append({"vehicle_id":v["id"],"vehicle_code":v["vehicle_code"],
                           "shipment_codes":codes,"distance_km":round(dist/1000,2),"load_kg":round(load,2)})
    return {"status":"OPTIMAL_OR_TOOLS","objective":objective,"routes":routes,"unassigned":[]}
