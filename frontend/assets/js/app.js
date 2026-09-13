const $ = s => document.querySelector(s);
const esc = x => String(x ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let maps = {};

function makeMap(id, center=[19.076,72.878], zoom=10){
  if(!window.L || !document.getElementById(id)) return null;
  if(maps[id]) return maps[id];
  const map=L.map(id).setView(center,zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
  maps[id]=map;
  setTimeout(()=>map.invalidateSize(),80);
  return map;
}
function markerIcon(type){
  const c={vehicle:["🚚","vehicle-marker"],start:["●","start-marker"],destination:["◆","destination-marker"],boat:["⛴","boat-marker"],police:["🚔","police-marker"],sos:["⚠","sos-marker"]}[type]||["●","start-marker"];
  return L.divIcon({className:"custom-marker",html:`<div class="${c[1]}">${c[0]}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
}
function addMarker(map,lat,lon,type,title){return L.marker([lat,lon],{icon:markerIcon(type)}).addTo(map).bindPopup(title||type);}
function clearMap(map){if(!map)return;map.eachLayer(l=>{if(l instanceof L.Marker||l instanceof L.Polyline||l instanceof L.GeoJSON)map.removeLayer(l);});}
function toast(message, kind="info"){
  let el=$("#toast");
  if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el);}
  el.className=`toast ${kind}`;el.textContent=message;el.classList.add("show");
  clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
}
function setBusy(btn,busy,text){if(!btn)return;if(busy){btn.dataset.oldText=btn.textContent;btn.disabled=true;btn.textContent=text||"Working…";}else{btn.disabled=false;btn.textContent=btn.dataset.oldText||btn.textContent;}}

function modal(title, body, onSubmit){
  let root=$("#modalRoot");
  if(!root){root=document.createElement("div");root.id="modalRoot";root.className="modal";document.body.appendChild(root);}
  root.innerHTML=`<div class="modal-box"><div class="modal-head"><div><h2>${esc(title)}</h2><div class="muted">Enter operational data. Values are stored in the local database.</div></div><button type="button" class="icon-btn" id="modalClose">×</button></div>${body}</div>`;
  root.classList.add("open");
  const close=()=>root.classList.remove("open");
  $("#modalClose").onclick=close;
  root.onclick=e=>{if(e.target===root)close();};
  const form=root.querySelector("form");
  form?.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector("button[type=submit]");setBusy(btn,true,"Saving…");try{await onSubmit(new FormData(form));close();}catch(err){toast(err.message,"error");}finally{setBusy(btn,false);}});
}

function openVehicle(){
  modal("Add Vehicle",`<form id="vehicleForm">
    <div class="form-grid">
      <div class="field"><label>VEHICLE CODE *</label><input name="vehicle_code" class="input" required placeholder="MH01AB1234"></div>
      <div class="field"><label>VEHICLE TYPE</label><select name="vehicle_type" class="input"><option>TRUCK</option><option>VAN</option><option>MINI_TRUCK</option><option>CONTAINER</option><option>REFRIGERATED</option></select></div>
      <div class="field"><label>CAPACITY (KG) *</label><input name="capacity_kg" class="input" type="number" min="0" step="0.1" required placeholder="1000"></div>
      <div class="field"><label>FUEL LEVEL (%)</label><input name="fuel_level" class="input" type="number" min="0" max="100" step="1" placeholder="80"></div>
      <div class="field" style="grid-column:1/-1"><label>CURRENT LOCATION / DEPOT</label><input name="location" class="input" placeholder="Mumbai, Maharashtra"><small class="field-help">If coordinates are not supplied, LogiShield will geocode this address using Nominatim.</small></div>
      <div class="field"><label>LATITUDE</label><input name="latitude" class="input" type="number" step="any" placeholder="Optional"></div>
      <div class="field"><label>LONGITUDE</label><input name="longitude" class="input" type="number" step="any" placeholder="Optional"></div>
      <label class="check"><input name="available" type="checkbox" checked> Vehicle available for planning</label>
    </div>
    <div class="modal-actions"><button type="button" class="btn" id="cancelVehicle">Cancel</button><button type="submit" class="btn primary">Save Vehicle</button></div>
  </form>` , async fd=>{
    const payload={vehicle_code:fd.get("vehicle_code"),vehicle_type:fd.get("vehicle_type"),capacity_kg:+fd.get("capacity_kg"),available:fd.get("available")==="on",location:fd.get("location")||null,latitude:fd.get("latitude")?+fd.get("latitude"):null,longitude:fd.get("longitude")?+fd.get("longitude"):null,fuel_level:fd.get("fuel_level")?+fd.get("fuel_level"):null};
    await API.addVehicle(payload);await loadFleet();toast("Vehicle added successfully","success");
  });
  $("#cancelVehicle").onclick=()=>$("#modalRoot").classList.remove("open");
}

function openShipment(){
  modal("Add Shipment",`<form id="shipmentForm">
    <div class="form-grid">
      <div class="field"><label>SHIPMENT CODE *</label><input name="shipment_code" class="input" required placeholder="SH001"></div>
      <div class="field"><label>WEIGHT (KG) *</label><input name="weight_kg" class="input" type="number" min="0" step="0.1" required placeholder="600"></div>
      <div class="field"><label>ORIGIN *</label><input name="origin" class="input" required placeholder="Mumbai, Maharashtra"></div>
      <div class="field"><label>DESTINATION *</label><input name="destination" class="input" required placeholder="Pune, Maharashtra"></div>
      <div class="field"><label>PRIORITY</label><select name="priority" class="input"><option value="5">P5 — Critical</option><option value="4">P4 — High</option><option value="3" selected>P3 — Normal</option><option value="2">P2 — Low</option><option value="1">P1 — Lowest</option></select></div>
      <div class="field"><label>DEADLINE</label><input name="deadline" class="input" type="datetime-local"></div>
      <div class="field"><label>ORIGIN LATITUDE</label><input name="origin_lat" class="input" type="number" step="any" placeholder="Optional"></div>
      <div class="field"><label>ORIGIN LONGITUDE</label><input name="origin_lon" class="input" type="number" step="any" placeholder="Optional"></div>
      <div class="field"><label>DESTINATION LATITUDE</label><input name="destination_lat" class="input" type="number" step="any" placeholder="Optional"></div>
      <div class="field"><label>DESTINATION LONGITUDE</label><input name="destination_lon" class="input" type="number" step="any" placeholder="Optional"></div>
    </div>
    <div class="notice" style="margin-top:14px">Origin and destination are geocoded automatically when coordinates are omitted.</div>
    <div class="modal-actions"><button type="button" class="btn" id="cancelShipment">Cancel</button><button type="submit" class="btn primary">Save Shipment</button></div>
  </form>`, async fd=>{
    const payload={shipment_code:fd.get("shipment_code"),origin:fd.get("origin"),destination:fd.get("destination"),weight_kg:+fd.get("weight_kg"),priority:+fd.get("priority"),deadline:fd.get("deadline")||null,origin_lat:fd.get("origin_lat")?+fd.get("origin_lat"):null,origin_lon:fd.get("origin_lon")?+fd.get("origin_lon"):null,destination_lat:fd.get("destination_lat")?+fd.get("destination_lat"):null,destination_lon:fd.get("destination_lon")?+fd.get("destination_lon"):null};
    await API.addShipment(payload);await loadShips();toast("Shipment added successfully","success");
  });
  $("#cancelShipment").onclick=()=>$("#modalRoot").classList.remove("open");
}

async function loadConnection(){
  const status=$(".status");if(!status)return;
  try{await API.health();status.innerHTML='<span class="dot"></span> Backend connected';status.classList.remove("offline");}
  catch{status.innerHTML='<span class="dot offline-dot"></span> Backend unavailable';status.classList.add("offline");}
}
async function loadDashboard(){
 try{
  const d=await API.dashboard();
  $("#kpis").innerHTML=[["Fleet",d.fleet.total,"Total vehicles",d.fleet.active+" active"],["Shipments",d.shipments.total,"All shipments",d.shipments.in_transit+" in transit"],["Planned",d.shipments.planned,"Awaiting dispatch","Current database"],["Decisions",d.pending_decisions,"Awaiting human review","Approval required"]].map(x=>`<div class="kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="meta">${x[2]} · ${x[3]}</div></div>`).join("");
  $("#signals").innerHTML='<div class="notice">Live database-backed operational counts. Use Fleet and Shipments to create planning inputs.</div><br><div class="route-line">OBSERVE → PREDICT → OPTIMIZE → STRESS TEST → DECIDE → ACT</div>';
  $("#chart").innerHTML='<div class="notice">Historical charts appear after telemetry history is ingested.</div>';
  const m=makeMap("dashboardMap");if(m){clearMap(m);const v=await API.vehicles(),pts=[];v.forEach(x=>{if(x.latitude!=null&&x.longitude!=null){pts.push([x.latitude,x.longitude]);addMarker(m,x.latitude,x.longitude,"vehicle",`${esc(x.vehicle_code)} · ${esc(x.status|| (x.available?"AVAILABLE":"UNAVAILABLE"))}`)}});if(pts.length)m.fitBounds(pts,{padding:[20,20]});}
 }catch(e){if($("#kpis"))$("#kpis").innerHTML=`<div class="notice">API error: ${esc(e.message)}</div>`}
}
async function loadFleet(){
 try{const v=await API.vehicles();$("#fleetTable").innerHTML=v.length?`<table class="table"><thead><tr><th>Vehicle</th><th>Type</th><th>Capacity</th><th>Status</th><th>GPS</th><th>Action</th></tr></thead><tbody>${v.map(x=>`<tr><td><b>${esc(x.vehicle_code)}</b></td><td>${esc(x.vehicle_type)}</td><td>${x.capacity_kg} kg</td><td><span class="badge ${x.available?"green":"red"}">${esc(x.status|| (x.available?"AVAILABLE":"UNAVAILABLE"))}</span></td><td>${x.latitude!=null?Number(x.latitude).toFixed(4)+", "+Number(x.longitude).toFixed(4):"Not available"}</td><td><button class="btn danger small" onclick="removeVehicle(${x.id})">Delete</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">No vehicles yet. Click <b>+ Add Vehicle</b> to create your first planning resource.</div>'}catch(e){$("#fleetTable").innerHTML=`<div class="notice">Could not load fleet: ${esc(e.message)}</div>`}}
async function removeVehicle(id){if(!confirm("Delete this vehicle?"))return;try{await API.deleteVehicle(id);await loadFleet();toast("Vehicle deleted","success")}catch(e){toast(e.message,"error")}}
async function loadShips(){
 try{const s=await API.shipments();$("#shipTable").innerHTML=s.length?`<table class="table"><thead><tr><th>Shipment</th><th>Origin</th><th>Destination</th><th>Weight</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>${s.map(x=>`<tr><td><b>${esc(x.shipment_code)}</b></td><td>${esc(x.origin)}</td><td>${esc(x.destination)}</td><td>${x.weight_kg} kg</td><td>P${x.priority}</td><td><span class="badge ${x.status==="DELIVERED"?"green":x.status==="IN_TRANSIT"?"amber":""}">${esc(x.status)}</span></td><td><button class="btn danger small" onclick="removeShipment(${x.id})">Delete</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">No shipments yet. Click <b>+ Add Shipment</b> to create a planning job.</div>'}catch(e){$("#shipTable").innerHTML=`<div class="notice">Could not load shipments: ${esc(e.message)}</div>`}}
async function removeShipment(id){if(!confirm("Delete this shipment?"))return;try{await API.deleteShipment(id);await loadShips();toast("Shipment deleted","success")}catch(e){toast(e.message,"error")}}
async function loadOps(){try{const[v,s]=await Promise.all([API.vehicles(),API.shipments()]);$("#opsVehicles").innerHTML=v.map(x=>`<div class="notice" style="margin-bottom:8px">${esc(x.vehicle_code)} · ${x.capacity_kg} kg · ${x.available?"AVAILABLE":"UNAVAILABLE"}</div>`).join("")||"No vehicles";$("#opsShipments").innerHTML=s.map(x=>`<div class="notice" style="margin-bottom:8px">${esc(x.shipment_code)} · ${esc(x.destination)} · P${x.priority}</div>`).join("")||"No shipments"}catch(e){toast(e.message,"error")}}
async function loadModels(){try{const[m,t]=await Promise.all([API.models(),API.training()]);$("#modelsList").innerHTML=m.length?m.map(x=>`<div class="notice" style="margin-bottom:8px"><b>${esc(x.task)}</b> · ${esc(x.version)} · ${x.promoted?"PROMOTED":"CANDIDATE"}<br><small>${esc(JSON.stringify(x.metrics))}</small></div>`).join(""):"No trained models yet";$("#trainingList").innerHTML=t.length?t.map(x=>`<div class="notice" style="margin-bottom:8px"><b>${esc(x.task)}</b> · ${esc(x.status)} · ${x.rows_used} rows</div>`).join(""):"No training runs yet"}catch(e){toast(e.message,"error")}}
async function loadDecisions(){try{const d=await API.decisions();$("#decisionTable").innerHTML=d.length?`<table class="table"><thead><tr><th>ID</th><th>Recommendation</th><th>Rationale</th><th>Status</th><th>Action</th></tr></thead><tbody>${d.map(x=>`<tr><td>${x.id}</td><td><b>${esc(x.recommendation)}</b></td><td>${esc(x.rationale)}</td><td>${esc(x.status)}</td><td>${x.status==="PENDING"?`<button class="btn success small" onclick="decision(${x.id},'APPROVED')">Approve</button> <button class="btn danger small" onclick="decision(${x.id},'REJECTED')">Reject</button>`:"—"}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">No decisions waiting for review.</div>'}catch(e){toast(e.message,"error")}}

async function runOptimization(){
 const btn=event?.currentTarget;setBusy(btn,true,"Optimizing…");
 try{
  const objective=$("#objective")?.value||"BALANCED";const r=await API.optimize(objective);
  if(r.status==="INFEASIBLE"||r.status==="NO_WORK"){$("#optResult").innerHTML=`<div class="notice"><b>${esc(r.status)}</b><br>${esc(r.reason||"Add valid vehicles and shipments before optimization.")}</div>`;return;}
  $("#optResult").innerHTML=`<div class="notice"><b>${esc(r.status)}</b> · Run #${r.run_id??"—"} · Objective: ${esc(r.objective||objective)}</div><br>${(r.routes||[]).map(x=>`<div class="strategy-item"><b>${esc(x.vehicle_code)}</b><div class="metric"><span>Shipments</span><strong>${esc((x.shipment_codes||[]).join(", "))}</strong></div><div class="metric"><span>Distance</span><strong>${x.distance_km} km</strong></div><div class="metric"><span>Load</span><strong>${x.load_kg} kg</strong></div>${x.unserved?.length?`<div class="metric"><span>Unserved</span><strong>${esc(x.unserved.join(", "))}</strong></div>`:""}</div>`).join("")||'<div class="notice">No assigned routes returned.</div>'}${r.unassigned?.length?`<br><div class="notice">Unassigned: ${esc(r.unassigned.join(", "))}</div>`:""}`;
  const m=makeMap("optimizationMap");if(m){clearMap(m);const pts=[];(r.routes||[]).forEach(route=>{if(route.start){addMarker(m,route.start.lat,route.start.lon,"vehicle",`🚚 ${esc(route.vehicle_code)}`);pts.push([route.start.lat,route.start.lon]);}if(route.geometry){L.geoJSON(route.geometry,{style:{weight:5}}).addTo(m);route.geometry.coordinates?.forEach(c=>pts.push([c[1],c[0]]));}else if(route.stops){route.stops.forEach((s,i)=>{addMarker(m,s.lat,s.lon,i===0?"start":"destination",`${i+1}. ${esc(s.shipment_code||"STOP")}`);pts.push([s.lat,s.lon]);});}});if(pts.length)m.fitBounds(pts,{padding:[20,20]});}
 }catch(e){$("#optResult").innerHTML=`<div class="notice">Optimization error: ${esc(e.message)}</div>`}finally{setBusy(btn,false)}
}
async function simulate(){const btn=event?.currentTarget;setBusy(btn,true,"Simulating…");try{const r=await API.simulate($("#scenarioType").value,+$("#severity").value/100);$("#scenarioResult").innerHTML=`<div class="notice"><b>Resilience score: ${r.resilience_score}/100</b> · Recommended: <b>${esc(r.recommendation||"No feasible strategy")}</b></div><br><div class="strategy">${r.strategies.map(s=>`<div class="strategy-item ${s.strategy===r.recommendation?"recommended":""}"><b>${esc(s.strategy)}</b><div class="metric"><span>Feasible</span><strong>${s.feasible?"YES":"NO"}</strong></div><div class="metric"><span>Risk</span><strong>${s.risk_pct}%</strong></div><div class="metric"><span>Recovery</span><strong>${s.recovery_minutes} min</strong></div></div>`).join("")}</div>`;await loadDecisions()}catch(e){$("#scenarioResult").innerHTML=`<div class="notice">Simulation error: ${esc(e.message)}</div>`}finally{setBusy(btn,false)}}
async function planMultimodal(){const btn=event?.currentTarget;setBusy(btn,true,"Building…");try{const r=await API.multimodal({origin:$("#mmOrigin").value,destination:$("#mmDestination").value,road_rate_per_km:+$("#roadRate").value,driver_rate_per_hour:+$("#driverRate").value,fixed_handling:+$("#handlingRate").value,ferry_rate_per_km:+$("#ferryRate").value,ferry_fixed_fee:+$("#ferryFixed").value});let h=`<div class="notice"><b>Road:</b> ${r.road_option.distance_km} km · ${r.road_option.duration_minutes} min · <b>₹${r.road_option.estimated_bill}</b></div>`;if(r.ferry_option){const f=r.ferry_option;h+=`<br><div class="notice"><b>OSM ferry:</b> ${esc(f.from_terminal.name)} → ${esc(f.to_terminal.name)} · boat ${f.water_distance_km} km · ${f.duration_minutes} min · <b>₹${f.estimated_bill}</b><br><small>${esc(JSON.stringify(f.bill_breakdown))}</small></div>`}else h+='<br><div class="notice">No OSM ferry connection discovered for these locations.</div>';$("#mmResult").innerHTML=h;const m=makeMap("mmMap");clearMap(m);addMarker(m,r.origin.lat,r.origin.lon,"start","START · "+esc(r.origin.display_name));addMarker(m,r.destination.lat,r.destination.lon,"destination","DESTINATION · "+esc(r.destination.display_name));L.geoJSON(r.road_option.geometry,{style:{weight:5}}).addTo(m);if(r.ferry_option){const f=r.ferry_option;addMarker(m,f.from_terminal.lat,f.from_terminal.lon,"boat","BOAT HANDOFF");addMarker(m,f.to_terminal.lat,f.to_terminal.lon,"boat","BOAT ARRIVAL");L.geoJSON(f.pre_geometry,{style:{weight:4,dashArray:"6 5"}}).addTo(m);L.polyline([[f.from_terminal.lat,f.from_terminal.lon],[f.to_terminal.lat,f.to_terminal.lon]],{weight:5,dashArray:"12 8"}).addTo(m).bindPopup("⛴ Ferry/boat leg");L.geoJSON(f.post_geometry,{style:{weight:4,dashArray:"6 5"}}).addTo(m)}}catch(e){$("#mmResult").innerHTML=`<div class="notice">Routing error: ${esc(e.message)}</div>`}finally{setBusy(btn,false)}}
async function triggerSOS(){const btn=event?.currentTarget;setBusy(btn,true,"Preparing…");try{const lat=+$("#sosLat").value,lon=+$("#sosLon").value;if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new Error("Enter valid coordinates");const vehicleRaw=$("#sosVehicle").value.trim();const r=await API.triggerSOS({vehicle_id:vehicleRaw?+vehicleRaw:null,latitude:lat,longitude:lon,trigger:$("#sosTrigger").value,severity:"HIGH",message:"Distress event prepared by LogiShield"});$("#policeResult").innerHTML=r.nearby_police.length?r.nearby_police.map((p,i)=>`<div class="strategy-item"><b>${i+1}. ${esc(p.name)}</b><div class="metric"><span>Road distance</span><strong>${p.road_distance_km} km</strong></div><div class="metric"><span>Estimated response</span><strong>${p.eta_minutes} min</strong></div></div>`).join(""):'<div class="notice">No police station returned by Overpass.</div>';const m=makeMap("sosMap");clearMap(m);addMarker(m,lat,lon,"sos","⚠ INCIDENT SITE");const pts=[[lat,lon]];r.nearby_police.forEach(p=>{addMarker(m,p.lat,p.lon,"police",`🚔 ${esc(p.name)} · ${p.eta_minutes} min`);pts.push([p.lat,p.lon])});if(pts.length>1)m.fitBounds(pts,{padding:[25,25]})}catch(e){toast(e.message,"error")}finally{setBusy(btn,false)}}
async function decision(id,status){try{await API.decide(id,status);await loadDecisions();toast(`Decision ${status.toLowerCase()}`,"success")}catch(e){toast(e.message,"error")}}
function pageInit(){
 loadConnection();
 const p=location.pathname.split("/").pop()||"dashboard.html";
 if(p==="index.html")return;
 if(p==="dashboard.html")loadDashboard();
 if(p==="operations.html")loadOps();
 if(p==="fleet.html")loadFleet();
 if(p==="shipments.html")loadShips();
 if(p==="optimization.html"){makeMap("optimizationMap");}
 if(p==="multimodal.html")makeMap("mmMap");
 if(p==="resilience.html"){$("#severity")?.addEventListener("input",e=>$("#sevVal").textContent=e.target.value+"%");}
 if(p==="models.html")loadModels();
 if(p==="sos.html")makeMap("sosMap");
 if(p==="decisions.html")loadDecisions();
}
window.addEventListener("load",()=>setTimeout(pageInit,120));
window.openVehicle=openVehicle;window.openShipment=openShipment;window.removeVehicle=removeVehicle;window.removeShipment=removeShipment;window.runOptimization=runOptimization;window.simulate=simulate;window.planMultimodal=planMultimodal;window.triggerSOS=triggerSOS;window.decision=decision;
