# Backend MVP: FastAPI + SQLite + MILP Scheduler

This backend provides a preventive maintenance scheduling API with a MILP optimizer.

## Stack

- FastAPI for API layer
- SQLite + SQLAlchemy ORM for persistence
- PuLP (CBC solver) for MILP optimization

## Project Structure

```text
backend/
  app/
    core/            # Runtime settings
    db/              # Engine/session/base/init wiring
    models/          # SQLAlchemy ORM models
    schemas/         # Pydantic request/response contracts
    routes/          # API endpoints
    services/        # Domain/business orchestration
    milp/            # Optimization model and solver
    utils/           # Seed/demo data
    main.py          # FastAPI app entrypoint
  requirements.txt
```

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Run API from workspace root:

```bash
uvicorn backend.app.main:app --reload
```

4. Open docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Seeded Demo Data

The app auto-initializes SQLite schema and seeds:

- 6 machines: Rewinder, Accumulator, Distributor, Log Saw, Log Saw 2, Packaging
- 2 realistic mock maintenance records per machine (planned + corrective)

Seeding runs only when the machine table is empty.

## API Contract

### `POST /machines`
Create a machine.

Request body:

```json
{
  "name": "Conveyor A",
  "mttf_hours": 1000,
  "mttr_hours": 5,
  "downtime_cost_per_hour": 450,
  "last_maintenance_days_ago": 9
}
```

Response: machine object with `id` and `created_at`.

### `GET /machines`
List all machines.

### `POST /maintenance-data`
Create a maintenance execution record.

Request body:

```json
{
  "machine_id": 1,
  "performed_at": "2026-04-06T08:00:00Z",
  "duration_hours": 4,
  "notes": "Routine PM"
}
```

Response includes `machine_name` for convenience.

### `GET /maintenance-data`
List maintenance records, latest first.

### `POST /optimize`
Run MILP scheduling.

Request body supports a user-facing shape with `machineData` and optional `constraints`.
If `machineData` is omitted, the optimizer uses all seeded/database machines.

Request body:

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
    "maxDowntime": 150,
    "targetAvailability": 90,
    "maintenanceCapacityPerDay": 2,
    "peakDayIndices": [2, 3],
    "avoidPeakDays": true
  },
  "horizon_days": 7
}
```

Response:

```json
{
  "schedule": [
    {
      "machine": "Rewinder",
      "day": "Monday",
      "time": "08:00",
      "machine_id": 1,
      "day_index": 0,
      "maintenance_duration_days": 1,
      "expected_downtime_hours": 21.4,
      "estimated_cost_impact": 15408.0
    }
  ],
  "kpis": {
    "predicted_downtime": 120.0,
    "availability": 71.43,
    "baseline_downtime_days": 3.8421,
    "optimized_downtime_days": 5.0,
    "downtime_improvement_percent": -30.14,
    "baseline_downtime_per_machine_days": {
      "Rewinder": 0.8533,
      "Log Saw": 0.6444
    },
    "time_unit": "days",
    "predicted_downtime_hours": 120.0,
    "fleet_availability": 0.7143,
    "horizon_days": 7
  }
}
```

## Optimization Logic (MILP)

Implemented in `backend/app/milp/scheduler.py`.

Decision variable:

- `x[machine][day]` in `{0,1}`: machine starts preventive maintenance on day index `day`.

Objective:

- Minimize the weighted PM start day index to prioritize earlier feasible starts under due-date/capacity limits.

Constraints:

- Exactly one preventive maintenance start per machine in horizon.
- Hard concurrency cap of 2 active maintenance tasks at any exact day index.
- PM interval and duration are enforced in day units:
  - `pm_interval = floor(mttf_days * 0.85)`
  - `pm_duration = ceil(mttr_days * 0.70)`
- Due-date feasibility is enforced for each machine:
  - maintenance must start before machine age exceeds `pm_interval`.
- Optional request capacity is capped to 2 if a larger value is provided.
- Optional peak-day avoidance.
  - If enabled, maintenance starts are blocked on `peak_day_indices`.
- Optional user constraints:
  - `maxDowntime`
  - `targetAvailability` (percentage or ratio)

KPI outputs:

- Baseline downtime per machine (days):
  - `(horizon_days / mttf_days) * mttr_days`
- Optimized downtime (days):
  - `sum(pm_duration_days for all scheduled tasks)`
- Comparison fields:
  - `baseline_downtime_days`
  - `optimized_downtime_days`
  - `downtime_improvement_percent`
  - `baseline_downtime_per_machine_days`
- Compatibility fields retained:
  - `predicted_downtime`
  - `predicted_downtime_hours`
  - `availability`
  - `fleet_availability`

## Notes

- This MVP uses a linear, interpretable approximation to map reliability into MILP coefficients.
- If you later need multi-maintenance windows per machine or hourly time buckets, extend the model dimensionality and constraints in `scheduler.py`.
