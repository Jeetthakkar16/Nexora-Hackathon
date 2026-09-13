# LogiShield — AI Logistics Autopilot & Resilience Twin

Structured SIH-ready logistics decision platform:

**Observe → Predict → Optimize → Stress Test → Decide → Act → Monitor → Learn**

## Included
- Professional command-center UI
- Fleet and shipment management
- OpenStreetMap + OSRM routing, no paid map API
- OR-Tools optimization with deterministic fallback
- ETA/delay ML training endpoints
- Digital-twin style disruption simulation
- Strategy comparison and resilience scoring
- Human approval/rejection decision ledger
- Telemetry ingestion
- SQLite WAL database
- Modular backend architecture
- Windows setup/start/health scripts
- Automated tests

## Run on Windows
```bat
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
copy .env.example .env
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000`.

## Important
No fake operational dataset, GPS feed, traffic feed, weather feed, model score, or customer claim is bundled.
Actual production ML accuracy requires representative labeled operational data.
Public OSM/Nominatim/OSRM services have usage policies and should be self-hosted or replaced with an SLA-backed provider for high-volume production.
