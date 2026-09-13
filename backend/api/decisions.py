from fastapi import APIRouter,HTTPException
from pydantic import BaseModel
from backend.services.decision_service import list_decisions,decide
router=APIRouter(prefix="/api/decisions",tags=["Decisions"])
class DecisionIn(BaseModel): status:str
@router.get("")
def get_all(): return list_decisions()
@router.post("/{decision_id}")
def set_decision(decision_id:int,x:DecisionIn):
    try:return decide(decision_id,x.status)
    except ValueError as e:raise HTTPException(404,str(e))
