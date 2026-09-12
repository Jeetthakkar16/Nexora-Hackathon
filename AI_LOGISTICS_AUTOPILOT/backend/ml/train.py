from pathlib import Path
import json, joblib, pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split
from backend.config import ROOT_DIR
from backend.core.database import get_db

FEATURES=["distance_km","hour","day_of_week","weather_index","traffic_index"]

def _save(task,model,metrics,rows):
    out=ROOT_DIR/"models"/task.lower()/"candidate.joblib"
    out.parent.mkdir(parents=True,exist_ok=True)
    joblib.dump({"model":model,"features":FEATURES},out)
    with get_db() as db:
        db.execute("INSERT INTO model_registry(task,version,artifact_path,metrics_json,promoted) VALUES(?,?,?,?,0)",
                   (task,"candidate",str(out),json.dumps(metrics)))
        db.execute("INSERT INTO training_runs(task,rows_used,metrics_json,status) VALUES(?,?,?,?)",
                   (task,rows,json.dumps(metrics),"COMPLETED"))

def train_eta(csv_path):
    df=pd.read_csv(csv_path)
    required=FEATURES+["eta_minutes"]
    missing=[c for c in required if c not in df.columns]
    if missing: raise ValueError(f"Missing columns: {missing}")
    df=df.dropna(subset=required)
    if len(df)<100: raise ValueError("At least 100 labeled rows are required.")
    Xtr,Xte,ytr,yte=train_test_split(df[FEATURES],df["eta_minutes"],test_size=.2,random_state=42)
    model=HistGradientBoostingRegressor(random_state=42).fit(Xtr,ytr)
    pred=model.predict(Xte)
    metrics={"mae_minutes":float(mean_absolute_error(yte,pred)),
             "rmse_minutes":float(mean_squared_error(yte,pred)**.5),
             "r2":float(r2_score(yte,pred)),"rows":int(len(df))}
    _save("ETA",model,metrics,len(df)); return metrics

def train_delay(csv_path):
    df=pd.read_csv(csv_path)
    required=FEATURES+["delay"]
    missing=[c for c in required if c not in df.columns]
    if missing: raise ValueError(f"Missing columns: {missing}")
    df=df.dropna(subset=required)
    if len(df)<100: raise ValueError("At least 100 labeled rows are required.")
    y=df["delay"].astype(int)
    Xtr,Xte,ytr,yte=train_test_split(df[FEATURES],y,test_size=.2,random_state=42,stratify=y)
    model=HistGradientBoostingClassifier(random_state=42).fit(Xtr,ytr)
    pred=model.predict(Xte)
    metrics={"accuracy":float(accuracy_score(yte,pred)),
             "precision":float(precision_score(yte,pred,zero_division=0)),
             "recall":float(recall_score(yte,pred,zero_division=0)),
             "f1":float(f1_score(yte,pred,zero_division=0)),"rows":int(len(df))}
    _save("DELAY",model,metrics,len(df)); return metrics
