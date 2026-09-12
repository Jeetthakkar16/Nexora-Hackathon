const API={
async req(path,options={}){const r=await fetch(path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});const d=await r.json().catch(()=>({detail:r.statusText}));if(!r.ok)throw new Error(d.detail||"Request failed");return d},
dashboard(){return this.req("/api/dashboard")},vehicles(){return this.req("/api/vehicles")},shipments(){return this.req("/api/shipments")},
decisions(){return this.req("/api/decisions")},models(){return this.req("/api/models")},training(){return this.req("/api/models/training")},
addVehicle(x){return this.req("/api/vehicles",{method:"POST",body:JSON.stringify(x)})},
addShipment(x){return this.req("/api/shipments",{method:"POST",body:JSON.stringify(x)})},
optimize(objective="BALANCED"){return this.req("/api/optimization/run",{method:"POST",body:JSON.stringify({objective}))},
simulate(type,severity){return this.req("/api/resilience/simulate",{method:"POST",body:JSON.stringify({scenario_type:type,severity}))},
decide(id,status){return this.req("/api/decisions/"+id,{method:"POST",body:JSON.stringify({status})})}
};
