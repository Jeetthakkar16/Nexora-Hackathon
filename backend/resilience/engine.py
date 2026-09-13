import json
from backend.core.database import get_db, rows
from backend.resilience.simulator import simulate

def run_scenario(scenario_type,severity):
    with get_db() as db:
        vehicles=rows(db.execute("SELECT * FROM vehicles"))
        shipments=rows(db.execute("SELECT * FROM shipments WHERE status != 'DELIVERED'"))
    result=simulate(vehicles,shipments,scenario_type,severity)
    with get_db() as db:
        cur=db.execute("INSERT INTO scenarios(scenario_type,severity,input_json,result_json) VALUES(?,?,?,?)",
                       (scenario_type,severity,json.dumps({"scenario_type":scenario_type,"severity":severity}),json.dumps(result)))
        scenario_id=cur.lastrowid
        if result.get("recommendation"):
            impact=next(x for x in result["strategies"] if x["strategy"]==result["recommendation"])
            db.execute("INSERT INTO decisions(scenario_id,recommendation,rationale,expected_impact_json) VALUES(?,?,?,?)",
                       (scenario_id,result["recommendation"],
                        "Lowest modeled risk among feasible strategies, then cost.",json.dumps(impact)))
    result["scenario_id"]=scenario_id
    return result
