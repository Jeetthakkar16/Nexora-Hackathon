# LogiShield Architecture

Presentation: modular vanilla HTML/CSS/JS command center.

API: FastAPI validation and routing.

Services: routing, optimization, resilience, telemetry and decisions.

Intelligence:
- ML predicts ETA/delay/demand.
- OR-Tools makes routing decisions.
- Future LLM integration should explain verified facts, not replace optimization.

Data: SQLite WAL initially; PostgreSQL/PostGIS is the scale-out target.

Resilience:
1. Read current network state.
2. Clone it in memory.
3. Apply disruption.
4. Evaluate recovery strategies.
5. Compare feasibility, risk, cost and recovery time.
6. Recommend a feasible strategy.
7. Record proposal.
8. Require human approval.

Production upgrades:
PostgreSQL/PostGIS, Redis/WebSockets, real traffic/weather/telemetry feeds,
pickup-delivery VRP with time windows, ETA uncertainty, model promotion gates,
drift monitoring, RBAC, Docker/cloud deployment.
