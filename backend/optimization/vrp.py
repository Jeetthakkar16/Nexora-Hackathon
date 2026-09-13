from backend.routing.matrix import distance_matrix, haversine_km


def optimize(vehicles, shipments, objective="BALANCED"):
    valid=[v for v in vehicles if v.get("available") and v.get("latitude") is not None and v.get("longitude") is not None]
    jobs=[s for s in shipments if s.get("origin_lat") is not None and s.get("origin_lon") is not None and s.get("destination_lat") is not None and s.get("destination_lon") is not None]
    if not valid:
        return {"status":"INFEASIBLE","reason":"No available vehicles with current GPS/depot coordinates. Add a vehicle location in Fleet.","routes":[]}
    if not jobs:
        return {"status":"NO_WORK","reason":"No PLANNED/READY shipments with geocoded origin and destination.","routes":[],"unassigned":[]}
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
        return _ortools(valid,jobs,objective,pywrapcp,routing_enums_pb2)
    except Exception:
        return _greedy(valid,jobs,objective)


def _greedy(vehicles,jobs,objective):
    state={v["id"]:{"v":v,"remaining":float(v["capacity_kg"]),"jobs":[]} for v in vehicles}
    unassigned=[]
    for job in sorted(jobs,key=lambda x:(-int(x.get("priority",3)),float(x.get("weight_kg",0)))):
        candidates=[x for x in state.values() if x["remaining"]>=float(job["weight_kg"])]
        if not candidates:
            unassigned.append(job["shipment_code"]);continue
        chosen=min(candidates,key=lambda x:(len(x["jobs"]),x["remaining"]))
        chosen["jobs"].append(job);chosen["remaining"]-=float(job["weight_kg"])
    return {"status":"GREEDY_FALLBACK","objective":objective,"routes":[_route_summary(x["v"],x["jobs"]) for x in state.values() if x["jobs"]],"unassigned":unassigned}


def _route_summary(vehicle,jobs):
    points=[(vehicle["latitude"],vehicle["longitude"])]
    stops=[]
    for j in jobs:
        stops.append({"type":"PICKUP","shipment_code":j["shipment_code"],"lat":j["origin_lat"],"lon":j["origin_lon"],"label":j["origin"]})
        stops.append({"type":"DELIVERY","shipment_code":j["shipment_code"],"lat":j["destination_lat"],"lon":j["destination_lon"],"label":j["destination"]})
        points += [(j["origin_lat"],j["origin_lon"]),(j["destination_lat"],j["destination_lon"])]
    dist=sum(haversine_km(points[i],points[i+1]) for i in range(len(points)-1))
    out={"vehicle_id":vehicle["id"],"vehicle_code":vehicle["vehicle_code"],"start":{"lat":vehicle["latitude"],"lon":vehicle["longitude"]},"shipment_codes":[j["shipment_code"] for j in jobs],"stops":stops,"distance_km":round(dist,2),"load_kg":round(sum(float(j["weight_kg"]) for j in jobs),2)}
    return out


def _ortools(vehicles,jobs,objective,pywrapcp,routing_enums_pb2):
    # Nodes: vehicle starts, then pickup/delivery nodes for every shipment.
    starts=list(range(len(vehicles)))
    points=[(v["latitude"],v["longitude"]) for v in vehicles]
    pickup_idx={};delivery_idx={}
    for j in jobs:
        pickup_idx[j["id"]]=len(points);points.append((j["origin_lat"],j["origin_lon"]))
        delivery_idx[j["id"]]=len(points);points.append((j["destination_lat"],j["destination_lon"]))
    matrix=distance_matrix(points)
    manager=pywrapcp.RoutingIndexManager(len(points),len(vehicles),starts,starts)
    routing=pywrapcp.RoutingModel(manager)
    priority_by_node={}
    for j in jobs:
        priority_by_node[pickup_idx[j["id"]]]=int(j.get("priority",3))
        priority_by_node[delivery_idx[j["id"]]]=int(j.get("priority",3))
    def cost_cb(fi,ti):
        a=manager.IndexToNode(fi);b=manager.IndexToNode(ti);d=matrix[a][b]
        if objective.upper()=="ON_TIME": return int(d*1000*max(1,6-priority_by_node.get(b,3)))
        return int(d*1000)
    transit=routing.RegisterTransitCallback(cost_cb);routing.SetArcCostEvaluatorOfAllVehicles(transit)
    demands=[0]*len(points)
    for j in jobs:
        w=int(max(0,float(j["weight_kg"])))
        demands[pickup_idx[j["id"]]]=w;demands[delivery_idx[j["id"]]]=-w
    def demand_cb(i): return demands[manager.IndexToNode(i)]
    didx=routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(didx,0,[int(max(0,float(v["capacity_kg"]))) for v in vehicles],False,"Capacity")
    cap=routing.GetDimensionOrDie("Capacity")
    for j in jobs:
        p=manager.NodeToIndex(pickup_idx[j["id"]]);d=manager.NodeToIndex(delivery_idx[j["id"]])
        routing.AddPickupAndDelivery(p,d);routing.solver().Add(routing.VehicleVar(p)==routing.VehicleVar(d));routing.solver().Add(cap.CumulVar(p)<=cap.CumulVar(d)+int(max(0,float(j["weight_kg"]))))
    params=pywrapcp.DefaultRoutingSearchParameters();params.first_solution_strategy=routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION;params.local_search_metaheuristic=routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH;params.time_limit.seconds=8
    sol=routing.SolveWithParameters(params)
    if not sol:return {"status":"INFEASIBLE","reason":"No feasible pickup/delivery plan satisfies vehicle capacities.","routes":[],"unassigned":[]}
    routes=[];assigned=set()
    for vi,v in enumerate(vehicles):
        idx=routing.Start(vi);dist=0;load=0;stops=[];codes=[]
        while not routing.IsEnd(idx):
            node=manager.IndexToNode(idx)
            if node>=len(vehicles):
                for j in jobs:
                    if pickup_idx[j["id"]]==node:
                        stops.append({"type":"PICKUP","shipment_code":j["shipment_code"],"lat":j["origin_lat"],"lon":j["origin_lon"],"label":j["origin"]});codes.append(j["shipment_code"]);load+=float(j["weight_kg"]);assigned.add(j["id"]);break
                    if delivery_idx[j["id"]]==node:
                        stops.append({"type":"DELIVERY","shipment_code":j["shipment_code"],"lat":j["destination_lat"],"lon":j["destination_lon"],"label":j["destination"]});break
            nxt=sol.Value(routing.NextVar(idx));dist+=routing.GetArcCostForVehicle(idx,nxt,vi);idx=nxt
        if codes:
            route={"vehicle_id":v["id"],"vehicle_code":v["vehicle_code"],"start":{"lat":v["latitude"],"lon":v["longitude"]},"shipment_codes":list(dict.fromkeys(codes)),"stops":stops,"distance_km":round(dist/1000,2),"load_kg":round(load,2)}
            route["geometry"]=_road_geometry(route)
            routes.append(route)
    unassigned=[j["shipment_code"] for j in jobs if j["id"] not in assigned]
    return {"status":"OPTIMAL_OR_TOOLS","objective":objective,"routes":routes,"unassigned":unassigned}


def _road_geometry(route):
    try:
        from backend.routing.osrm import route_geometry
        pts=[(route["start"]["lat"],route["start"]["lon"])] + [(s["lat"],s["lon"]) for s in route["stops"]]
        return route_geometry(pts)
    except Exception:
        return None
