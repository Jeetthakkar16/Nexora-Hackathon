from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.optimization_service import run_optimization
router=APIRouter(prefix="/api/optimization",tags=["Optimization"])
class OptIn(BaseModel): objective:str="BALANCED"
@router.post("/run")
def run(x:OptIn): return run_optimization(x.objective)
