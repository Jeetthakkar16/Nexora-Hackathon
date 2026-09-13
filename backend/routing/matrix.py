from math import radians, sin, cos, asin, sqrt

def haversine_km(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    dlat, dlon = radians(lat2-lat1), radians(lon2-lon1)
    x = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 6371.0088 * 2 * asin(sqrt(x))

def distance_matrix(points):
    return [[0 if i == j else haversine_km(a,b) for j,b in enumerate(points)]
            for i,a in enumerate(points)]
