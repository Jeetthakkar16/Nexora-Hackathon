from fastapi import APIRouter,UploadFile,File,HTTPException
from backend.ml.registry import models,training_runs
from backend.ml.train import train_eta,train_delay
router=APIRouter(prefix="/api/models",tags=["AI Models"])

@router.get("")
def get_models():return models()

@router.get("/training")
def get_training():return training_runs()

@router.post("/train/{task}")
async def train(task:str,file:UploadFile=File(...)):
    task=task.upper()
    if task not in ("ETA","DELAY"):raise HTTPException(400,"Supported tasks: ETA, DELAY")
    import tempfile,os
    with tempfile.NamedTemporaryFile(delete=False,suffix=".csv") as f:
        f.write(await file.read()); path=f.name
    try:return train_eta(path) if task=="ETA" else train_delay(path)
    except ValueError as e:raise HTTPException(400,str(e))
    finally:
        try:os.unlink(path)
        except OSError:pass
