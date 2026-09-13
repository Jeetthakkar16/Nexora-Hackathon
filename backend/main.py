from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from backend.config import settings
from backend.core.database import init_db
from backend.api import dashboard,vehicles,shipments,optimization,resilience,telemetry,decisions,models,multimodal,sos

BASE=Path(__file__).resolve().parents[1]
app=FastAPI(title=settings.app_name,version="1.1.0",description="AI logistics decision twin and resilience platform")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])
for r in [dashboard.router,vehicles.router,shipments.router,optimization.router,resilience.router,telemetry.router,decisions.router,models.router,multimodal.router,sos.router]: app.include_router(r)
@app.on_event("startup")
def startup(): init_db()
@app.get("/api/health")
def health(): return {"status":"ok","service":settings.app_name,"environment":settings.app_env,"version":app.version}
@app.get("/",include_in_schema=False)
def index(): return RedirectResponse("/dashboard.html")
@app.get("/{path:path}",include_in_schema=False)
def static_files(path:str):
    target=BASE/"frontend"/path
    if target.is_file(): return FileResponse(target)
    if path.startswith("api/"): return JSONResponse({"detail":"API endpoint not found"},status_code=404)
    return FileResponse(BASE/"frontend"/"dashboard.html")
