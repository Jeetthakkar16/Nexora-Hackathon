from backend.resilience.simulator import simulate

def test_simulation_returns_four_strategies():
    result=simulate([],[],"VEHICLE_BREAKDOWN",.5)
    assert len(result["strategies"])==4
    assert 0 <= result["resilience_score"] <= 100
