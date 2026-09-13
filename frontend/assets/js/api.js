window.API = {
  async req(path, options={}) {
    const r = await fetch(path, {headers: {"Content-Type":"application/json", ...(options.headers||{})}, ...options});
    const text = await r.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`API returned non-JSON (${r.status})`); }
    if (!r.ok) throw new Error(data.detail || `Request failed (${r.status})`);
    return data;
  },
  health(){ return this.req("/api/health"); },
  dashboard(){ return this.req("/api/dashboard"); },
  vehicles(){ return this.req("/api/vehicles"); },
  shipments(){ return this.req("/api/shipments"); },
  decisions(){ return this.req("/api/decisions"); },
  models(){ return this.req("/api/models"); },
  training(){ return this.req("/api/models/training"); },
  addVehicle(x){ return this.req("/api/vehicles", {method:"POST", body:JSON.stringify(x)}); },
  deleteVehicle(id){ return this.req(`/api/vehicles/${id}`, {method:"DELETE"}); },
  addShipment(x){ return this.req("/api/shipments", {method:"POST", body:JSON.stringify(x)}); },
  deleteShipment(id){ return this.req(`/api/shipments/${id}`, {method:"DELETE"}); },
  optimize(objective="BALANCED"){ return this.req("/api/optimization/run", {method:"POST", body:JSON.stringify({objective})}); },
  simulate(type,severity){ return this.req("/api/resilience/simulate", {method:"POST", body:JSON.stringify({scenario_type:type,severity})}); },
  decide(id,status){ return this.req(`/api/decisions/${id}`, {method:"POST", body:JSON.stringify({status})}); },
  multimodal(x){ return this.req("/api/multimodal/plan", {method:"POST", body:JSON.stringify(x)}); },
  triggerSOS(x){ return this.req("/api/sos/trigger", {method:"POST", body:JSON.stringify(x)}); }
};
