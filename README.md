# MILPSystem

Practical preventive-maintenance MVP for a tissue production line.

This project combines a FastAPI + SQLite + PuLP backend with a React + Vite + Tailwind frontend to:

1. track machine reliability inputs,
2. log maintenance events,
3. run a strict MILP-based maintenance schedule optimization,
4. visualize KPIs and the generated schedule.

## 1) Project Overview And Features

Core capabilities:

- Dashboard with reliability KPI cards, charts, machine table, and data-entry forms.
- Machine management (`POST /machines`, `GET /machines`).
- Maintenance log management (`POST /maintenance-data`, `GET /maintenance-data`).
- MILP schedule optimization (`POST /optimize`) with strict due-date and capacity rules.
- Auto-seeded demo dataset on first backend startup.
- Frontend fallback demo data if backend is unavailable.

Default seeded machines:

1. Rewinder
2. Accumulator
3. Distributor
4. Log Saw
5. Log Saw 2
6. Packaging

## 2) Tech Stack

Backend:

- Python 3.x
- FastAPI 0.115.13
- SQLAlchemy 2.0.36
- Pydantic 2.10.3
- PuLP 2.9.0 (CBC solver)
- SQLite

Frontend:

- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- Recharts
- React Router
- Lucide icons

## 3) Folder Structure

```text
MILPSystem/
	README.md
	package.json
	backend/
		requirements.txt
		app/
			main.py
			core/
			db/
			models/
			schemas/
			routes/
			services/
			milp/
			utils/
	frontend/
		package.json
		vite.config.ts
		src/
			App.tsx
			layouts/
			pages/
			components/
			services/
```

## 4) Prerequisites

Windows prerequisites:

- Python 3.10+ (recommended)
- Node.js 18+ and npm
- PowerShell

Optional but recommended:

- A dedicated Python virtual environment

## 5) Step-By-Step Setup On Windows

From a PowerShell terminal, start in the repo root (`MILPSystem`):

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem"
```

### Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Frontend setup

Open a second terminal:

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\frontend"
npm install
```

## 6) How To Run Backend And Frontend

Use two terminals.

Terminal A (backend):

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Terminal B (frontend):

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\frontend"
npm run dev
```

Default URLs:

- Frontend: http://127.0.0.1:5173
- Backend API: http://127.0.0.1:8000
- Swagger docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

## 7) How To Use The System (Dashboard -> Optimization -> Schedule)

1. Open the frontend URL.
2. Dashboard:
	 - Review reliability and downtime KPI cards.
	 - Use Data Entry to add a machine or log maintenance.
	 - Confirm machine metrics table updates.
3. Optimization page:
	 - Set `Horizon (Days)`, `Daily Capacity`, and optional `Avoid Peak Days`.
	 - Click `Run Optimizer`.
	 - Review output KPIs and maintenance load chart.
4. Schedule page:
	 - View sorted schedule rows with day/time, duration, expected downtime, and cost impact.

## 8) API Endpoints (Compact Examples)

Base URL: `http://localhost:8000`

### GET /health

Response:

```json
{ "status": "ok" }
```

### GET /machines

Response (example):

```json
[
	{
		"id": 1,
		"name": "Rewinder",
		"mttf_hours": 900,
		"mttr_hours": 6,
		"downtime_cost_per_hour": 720,
		"last_maintenance_days_ago": 14,
		"created_at": "2026-04-06T10:00:00"
	}
]
```

### POST /machines

Request:

```json
{
	"name": "Conveyor A",
	"mttf_hours": 1000,
	"mttr_hours": 5,
	"downtime_cost_per_hour": 450,
	"last_maintenance_days_ago": 9
}
```

Response: created machine object (`201`).

### GET /maintenance-data

Response (example):

```json
[
	{
		"id": 1,
		"machine_id": 1,
		"machine_name": "Rewinder",
		"performed_at": "2026-04-01T08:00:00",
		"duration_hours": 4,
		"notes": "Routine PM"
	}
]
```

### POST /maintenance-data

Request:

```json
{
	"machine_id": 1,
	"performed_at": "2026-04-06T08:00:00",
	"duration_hours": 4,
	"notes": "Replaced belt"
}
```

Response: created record with `machine_name` (`201`).

### POST /optimize

Request (supported payload shape):

```json
{
	"machineData": [
		{
			"machine": "Rewinder",
			"mttfHours": 900,
			"mttrHours": 6,
			"downtimeCostPerHour": 720,
			"lastMaintenanceDaysAgo": 14
		},
		"Log Saw"
	],
	"constraints": {
		"maxDowntime": 12,
		"targetAvailability": 85,
		"maintenanceCapacityPerDay": 2,
		"peakDayIndices": [1, 2],
		"avoidPeakDays": true
	},
	"horizon_days": 7,
	"maintenance_capacity_per_day": 2,
	"peak_day_indices": [1, 2],
	"avoid_peak_days": true
}
```

Response (example):

```json
{
	"schedule": [
		{
			"machine": "Rewinder",
			"day": "Wednesday",
			"time": "08:00",
			"machine_id": 1,
			"day_index": 2,
			"maintenance_duration_days": 1,
			"expected_downtime_hours": 24,
			"estimated_cost_impact": 17280
		}
	],
	"kpis": {
		"predicted_downtime": 24,
		"availability": 95.24,
		"baseline_downtime_days": 1.2,
		"optimized_downtime_days": 1,
		"downtime_improvement_percent": 16.67,
		"baseline_downtime_per_machine_days": { "Rewinder": 1.2 },
		"time_unit": "days",
		"predicted_downtime_hours": 24,
		"fleet_availability": 0.9524,
		"horizon_days": 7
	}
}
```

Notes:

- If `machineData` is omitted/empty, all DB machines are optimized.
- `machineData` accepts either objects or machine identifiers (name or numeric ID string).
- Bad optimization inputs or infeasible constraints return `400`.

## 9) Seeded Data And Optimization Logic Notes

### Seed behavior

- Database schema is created at startup.
- Seeding runs only if the machine table is empty.
- Seed includes 6 machines and 2 maintenance records per machine.

### Strict optimization rules (important)

In `backend/app/milp/scheduler.py`, the model uses day-level strict rules:

1. Convert reliability to days:
	 - `mttf_days = mttf_hours / 24`
	 - `mttr_days = mttr_hours / 24`
2. PM formulas:
	 - `pm_interval_days = floor(mttf_days * 0.85)`
	 - `pm_duration_days = max(1, ceil(mttr_days * 0.70))`
3. Due-date feasibility:
	 - PM must start before age exceeds interval.
	 - If a machine already exceeds interval at solve-time, optimizer returns infeasible.
4. Capacity is hard-capped:
	 - Effective capacity is `min(requested_capacity, 2)` with lower bound 1.
	 - At any day index, active concurrent maintenances must be `<= 2`.
5. Exactly one PM start per machine in horizon.
6. Optional constraints: `maxDowntime`, `targetAvailability`, peak-day avoidance.

KPI note:

- `predicted_downtime` is reported in hours for compatibility.
- Additional fields provide day-based baseline vs optimized comparisons.

## 10) Troubleshooting

### Backend import errors (`No module named 'app'`)

Cause: running Uvicorn from the wrong folder.

Fix:

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\backend"
uvicorn app.main:app --reload
```

### `npm run dev` fails

Checks:

1. Ensure you are in `frontend` folder.
2. Run `npm install` first.
3. Confirm Node version is supported (`node -v`).

### Port already in use

Symptoms: bind errors on `8000` or `5173`.

Fix: stop the existing process or run a different port.

### Optimizer returns infeasible

Common reasons:

- machine age already exceeds strict `pm_interval_days`,
- peak-day blocks remove all feasible start days,
- downtime/availability constraints are too strict for selected horizon.

Action: relax constraints, expand horizon, or update machine reliability/age inputs.

### Frontend loads but API data missing

The UI will fall back to demo data if backend calls fail. Verify backend is running at `http://localhost:8000`.

## 11) Quick Demo Workflow

1. Start backend and frontend in separate terminals.
2. Open Dashboard and confirm seeded machines appear.
3. Add a new machine in Data Entry.
4. Log a maintenance record for any machine.
5. Go to Optimization, keep horizon `7`, capacity `2`, click `Run Optimizer`.
6. Confirm KPI cards and daily load chart update.
7. Open Schedule and verify task rows (day, duration, downtime, cost).

You now have an end-to-end run from data entry through optimized scheduling.
