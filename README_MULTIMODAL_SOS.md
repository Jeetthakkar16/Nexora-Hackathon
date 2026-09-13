# LogiShield — Multimodal + Distress SOS Upgrade

### Map
- 🚚 vehicle
- ● start
- ◆ destination
- ⛴ boat/ferry handoff
- 🚔 police
- ⚠ incident/SOS

Geospatial sources: OpenStreetMap, Nominatim, OSRM and Overpass.

### Multimodal
The planner geocodes both locations, calculates the road route, searches OSM for ferry infrastructure, and shows a road → ferry → road option only when an OSM ferry connection is found. It never invents a boat leg.

The estimated bill uses actual routed distance/time plus transparent operator-configurable rates:
road distance × road ₹/km + driver hours × driver ₹/hour + handling + configured ferry charges.

Tolls, taxes and carrier/ferry tariffs are not fabricated. Connect an authoritative tariff source when available.

### SOS
The SOS API records an incident, queries nearby police stations from OSM/Overpass and estimates road response time to the incident with OSRM.

This prototype does NOT contact police or emergency services. A real dispatch connection requires an authorized government/police/emergency-service integration.

### Hardware
A custom device is optional for the software demo. For a strong physical prototype use:
ESP32-class MCU + GNSS + LTE/4G modem + IMU + panic button + buzzer + backup battery.

Flow:
GNSS/IMU → incident detection → signed event → cellular → LogiShield → incident map → police response ETA → authorized dispatch.

Use certified hardware, secure device identity and an official emergency-services interface for real deployment.
