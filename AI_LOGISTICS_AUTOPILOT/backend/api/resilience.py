from fastapi import APIRouter
from pydantic import BaseModel,Field
from backend.resilience.engine import run_scenario
router=APIRouter(prefix="/api/resilience",tags=["Resilience"])
class ScenarioIn(BaseModel):
    scenario_type:str
    severity:float=Field(ge=0,le=1)
@router.post("/simulate")
def simulate(x:ScenarioIn): return run_scenario(x.scenario_type,x.severity)
