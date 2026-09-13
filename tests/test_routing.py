from backend.routing.matrix import haversine_km

def test_haversine_zero():
    assert haversine_km((19.0,72.0),(19.0,72.0))==0
