# PM-OPT Maintenance Scheduling System

PM-OPT helps maintenance managers plan preventive maintenance before failures become expensive downtime events.

Instead of scheduling by guesswork, PM-OPT combines machine reliability data (MTTF, MTTR, maintenance age) with an optimization model (MILP) to produce a practical schedule that respects real shop-floor constraints:

- How many maintenance jobs your team can handle per day
- Which days are operationally risky (peak days)
- How close each machine is to its preventive maintenance due window

The result is a shared, visual workflow across five pages:

- Dashboard
- Optimization
- Schedule
- Machine Management
- Maintenance Logs

PM-OPT is designed for both:

- Non-technical users (operators, planners, supervisors)
- Technical staff (engineers, analysts, developers)

---

## Table Of Contents

1. [Who This Is For](#who-this-is-for)
2. [What PM-OPT Does](#what-pm-opt-does)
3. [Quick Start (5 Minutes)](#quick-start-5-minutes)
4. [Complete Installation Guide](#complete-installation-guide)
5. [How To Use PM-OPT (All 5 Pages)](#how-to-use-pm-opt-all-5-pages)
6. [Common Workflows (Step-By-Step)](#common-workflows-step-by-step)
7. [Data Flow: How Everything Connects](#data-flow-how-everything-connects)
8. [Key Concepts And Formulas](#key-concepts-and-formulas)
9. [Demo Data Included](#demo-data-included)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)
12. [Developer Technical Reference](#developer-technical-reference)
13. [API Reference](#api-reference)

---

## Who This Is For

### Maintenance Managers And Supervisors

Use PM-OPT to:

- Prioritize machines by maintenance urgency
- Build repeatable weekly plans
- Balance reliability goals against team capacity

### Operators And Planners

Use PM-OPT to:

- Track machine status and maintenance history
- Enter new machine details and completed maintenance records
- Follow the generated schedule clearly by machine and time slot

### Engineers And Developers

Use PM-OPT to:

- Integrate with APIs
- Extend optimization logic
- Validate reliability and downtime assumptions

---

## What PM-OPT Does

PM-OPT solves a practical question:

"Given our machine reliability data and daily maintenance limits, what maintenance schedule should we run now?"

It does this by combining:

1. Machine reliability and cost inputs
2. Maintenance history (last performed date, duration, notes)
3. Optimization constraints (horizon, daily capacity, peak-day avoidance)
4. A Mixed-Integer Linear Programming (MILP) solver

Outputs include:

- An hourly schedule by machine (with exact start hour metadata)
- Predicted downtime KPI
- Fleet availability KPI
- Color-coded machine views across Optimization and Schedule pages

---

## Quick Start (5 Minutes)

1. Start backend API.
2. Start frontend app.
3. Open PM-OPT in browser.
4. Go to Optimization page.
5. Click Run Optimizer.
6. Go to Schedule page to view ordered tasks.

Default URLs:

- Frontend: http://127.0.0.1:5173
- Backend API: http://127.0.0.1:8000
- API docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

---

## Complete Installation Guide

## Prerequisites

- Windows PowerShell
- Python 3.10+
- Node.js 18+
- npm

Optional:

- A Python virtual environment (recommended)

## 1) Clone And Enter Project

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem"
```

## 2) Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 3) Frontend Setup

Open a second PowerShell terminal:

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\frontend"
npm install
```

## 4) Run Backend

In terminal A:

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

## 5) Run Frontend

In terminal B:

```powershell
cd "C:\Users\Kyle Sermon\PROJECTS\MILPSystem\frontend"
npm run dev
```

## 6) First Startup Notes

- Backend auto-creates the SQLite schema.
- Backend auto-seeds 6 demo machines if machine table is empty.
- Frontend can fall back to demo display data if backend is unavailable.

---

## How To Use PM-OPT (All 5 Pages)

## 1) Dashboard Page

Purpose:

- Gives an operations snapshot of reliability and downtime.
- Contains quick data-entry forms for machine and maintenance records.

### What You See

- KPI cards:
  - Avg Reliability (%)
  - YTD Downtime (hrs)
  - Active Anomalies
- Charts:
  - Breakdown Frequency
  - Pareto (Downtime Causes)
- Machine Reliability Metrics table
- Data Entry panel with two tabs:
  - Machine
  - Maintenance

### Dashboard Controls (Detailed)

| Area | Control | What It Does | Notes |
|---|---|---|---|
| KPI Cards | Avg Reliability | Average of machine reliability scores | Read-only summary |
| KPI Cards | YTD Downtime | Sum of downtime hours from metrics | Read-only summary |
| KPI Cards | Active Anomalies | Count of machines with status = down | Read-only summary |
| Data Entry Tabs | Machine / Maintenance tab switch | Toggles form mode | Clears temporary message on switch |
| Machine Form | Name | Machine label (example: Rewinder 2) | Required |
| Machine Form | MTTF (minutes) | Mean Time To Failure input | Displayed in minutes |
| Machine Form | MTTR (minutes) | Mean Time To Repair input | Displayed in minutes |
| Machine Form | Downtime Cost (PHP/hr) | Cost estimate per downtime hour | Numeric |
| Machine Form | Days Since Last Maint. | Current maintenance age in days | Numeric |
| Machine Form | Add Machine | Creates a machine record | Sends to API |
| Maintenance Form | Machine | Select target machine | Required |
| Maintenance Form | Performed At (date) | Date maintenance happened | Required |
| Maintenance Form | Duration (hrs) | Maintenance duration in hours | Supports decimal |
| Maintenance Form | Notes / Anomaly Cause | Free-text cause/action notes | Optional |
| Maintenance Form | Log Record | Creates maintenance record | Sends to API |
| Table | Status badge | Running / Preventive / Down state | Derived from reliability heuristic |
| Table | Reliability bar | Visual reliability percent | Computed client-side |

### Dashboard Workflow Example

1. Open Dashboard.
2. Confirm Avg Reliability and anomalies.
3. If adding equipment, use Data Entry > Machine tab.
4. If logging work completed, use Data Entry > Maintenance tab.
5. Verify updates in Machine Reliability Metrics and charts.

---

## 2) Optimization Page

Purpose:

- Runs the MILP optimizer to generate a preventive maintenance plan on an **hourly grid**.
- Converts a planning horizon in days into `horizon_hours = horizon_days * 24` and schedules starts at exact hour indices.

### Optimization Controls

| Control | What It Means | Backend Behavior |
|---|---|---|
| Horizon Days | Planning window length | Converted to hours for solving (`days * 24`) |
| Daily Capacity (Crew Size) | Number of maintenance teams/crews available simultaneously | Enforced at **every hour** (e.g., 2 = max 2 machines under PM any given hour) |
| Avoid Peak Days | Avoid maintenance on selected high-risk days | Blocks all 24 hours of each peak day index |
| Run Optimizer | Starts solve for current parameters and machine data | Calls `POST /optimize`, caches response for Schedule page |

### Hourly Granularity (Important)

The solver no longer relies on coarse daily buckets for PM due windows.

- Maintenance starts are selected by `hour_index`.
- Capacity is checked hourly, not just by day.
- This avoids "rounding down" behavior for short-MTTF machines.

Example:

- Machine MTTF = 4 hours
- Previous day-based planning could force a 1-day approximation
- Hourly-grid planning keeps due cycles at exact 4-hour intervals

### Understanding Daily Capacity (Concurrent Crew Size)

`Daily Capacity` is the number of maintenance teams/crews you can run at the same time.

- Example: `Daily Capacity = 2` means at most 2 maintenance jobs can run in parallel.

How this maps to the solver:

- Frontend sends: `maintenance_capacity_per_day` (for example, `2`).
- Backend interpretation: this value is enforced as concurrent hourly capacity.
- For every single hour in the planning horizon, the solver ensures the number of machines currently under maintenance is less than or equal to this capacity.

Concrete example:

- Horizon: 7 days (168 hours)
- Daily Capacity: 2
- Machine 1: Maintenance starts at hour 10, duration 8 hours (active during hours 10-17)
- Machine 2: Maintenance starts at hour 15, duration 6 hours (active during hours 15-20)
- Hour 15: Both machines active (Machine 1 is still active from hour 10, Machine 2 just started)
  => Constraint checks: 2 active <= 2 capacity. Allowed.
- Hour 18: Only Machine 2 active (Machine 1 finished at hour 17)
  => Constraint checks: 1 active <= 2 capacity. Allowed.

Why this matters:

- Ensures realistic team workload across the entire planning window.
- No hour has more maintenance jobs running than your team can handle.
- Respects actual resource constraints, not just daily totals.

Practical tips:

- Start with `Daily Capacity` equal to your number of available maintenance crews.
- If the solver returns `Infeasible`, try increasing `Daily Capacity`.
- Capacity is absolute: it applies to every hour, including weekdays and weekends.

### What Happens When You Click Run Optimizer

1. UI validates and clamps input bounds.
2. Frontend sends optimization payload (`horizon_days`, `maintenance_capacity_per_day`, `peak_day_indices`, `avoid_peak_days`).
3. Backend resolves machine set (database by default, optional `machineData` override).
4. MILP solver computes hourly PM starts with due-window and capacity constraints.
5. Result is returned as:
   - `kpis` (predicted downtime, availability, horizon context)
   - `schedule[]` (machine tasks with hour-level metadata)
6. Frontend stores the latest response snapshot for the Schedule page.

### Optimization Results You See

- KPI cards:
  - Availability KPI
  - Predicted Downtime (hrs)
- Schedule chart:
  - Bucketed maintenance load across the solved horizon
  - Uses the optimized timeline and machine coloring

### Optimization Workflow Example

1. Open Optimization page.
2. Set `Horizon Days = 7`.
3. Set `Daily Capacity = 2`.
4. Keep `Avoid Peak Days` enabled.
5. Click `Run Optimizer`.
6. Review KPI cards and chart distribution.
7. Go to Schedule page for ordered task execution view.

---

## 3) Schedule Page

Purpose:

- Shows the optimized maintenance plan from the **last successful optimization run**.
- Uses cached optimization output so planners can inspect sequence without re-solving.

### What The Schedule Shows

| Field | Meaning |
|---|---|
| Machine | Asset name selected for preventive maintenance |
| Scheduled Time | Human-readable start label (`start_datetime_label`, example: `Day 1, 08:00`) |
| Duration | Planned PM duration (`maintenance_duration_minutes`/`maintenance_duration_hours`) |
| Downtime | Expected downtime hours for the task (`expected_downtime_hours`) |

### About `hour_index`

- `hour_index` is the exact solved hour in the planning horizon where PM begins.
- `hour_index = 0` means first hour of Day 1.
- `hour_index = 25` means Day 2, hour 2 of the 24-hour grid.

### Time Label Conventions

- Backend derives readable labels from `hour_index`.
- Example label: `Day 1, 08:00`.
- For a 7-day horizon, day labels may use weekday names (`Monday`, `Tuesday`, ...).

### Schedule Workflow Example

1. Run optimization from the Optimization page.
2. Open Schedule page.
3. Confirm rows are ordered chronologically by `hour_index`/day index.
4. Dispatch tasks to teams based on scheduled start labels and durations.
5. After field execution and log updates, re-run optimization to refresh sequence.

---

## 4) Machine Management Page

Purpose:

- Maintains the machine master list used by optimization.
- Supports full CRUD operations.

### CRUD Operations

| Operation | How It Works | Result |
|---|---|---|
| Create | Click `Add Machine`, fill form, save | New machine available for optimization |
| Read | Machine table loads current machine records | Current reliability/cost baseline visible |
| Update | Click edit icon on a row, modify fields, save | Machine reliability parameters updated |
| Delete | Click delete icon and confirm | Machine removed (and related records handled by backend rules) |

### Machine Form Fields

| Field | Description | Unit |
|---|---|---|
| Name | Unique machine label | Text |
| MTTF | Mean Time To Failure input | Minutes (UI) |
| MTTR | Mean Time To Repair input | Minutes (UI) |
| Downtime Cost | Estimated downtime loss rate | Cost per hour |
| Last Maintenance (Days Ago) | Current maintenance age snapshot | Days |

### Machine Management Workflow Example

1. Open Machine Management.
2. Add a new machine with realistic MTTF/MTTR and downtime cost.
3. Edit existing values when reliability assumptions change.
4. Remove decommissioned machines.
5. Re-run optimization so schedule reflects updated machine set.

---

## 5) Maintenance Logs Page

Purpose:

- Tracks maintenance records used to keep machine maintenance age current.
- Provides auditable history of performed work.

### Maintenance Log Operations

| Operation | How It Works | Result |
|---|---|---|
| Create | Click `Add Record`, complete form, save | New maintenance event added |
| Read | Table lists records by performed timestamp | Recent work is visible to planners |
| Update | Edit row, adjust values, save | Record corrected/refined |
| Delete | Delete row and confirm | Record removed from history |

### Maintenance Form Fields

| Field | Description | Unit/Format |
|---|---|---|
| Machine | Machine receiving maintenance | Dropdown |
| Performed At | Date/time maintenance happened | Datetime |
| Duration | Maintenance execution duration | Hours |
| Notes | Optional root cause, action, remarks | Text |

### Maintenance Logs Workflow Example

1. Open Maintenance Logs.
2. Add records immediately after maintenance completion.
3. Correct timestamps/durations if a log was entered inaccurately.
4. Verify records appear in the table.
5. Re-run optimization so recalculated machine age affects due windows.

---

## Data Flow: How Everything Connects

1. Machine records are created/edited in Machine Management and stored in the backend.
2. Optimization reads machine reliability and cost attributes as solver inputs.
3. Maintenance logs update `last_maintenance_days_ago` through backend recalculation logic.
4. Updated machine age changes PM due-window deadlines in the hourly MILP model.
5. Optimization response is cached in frontend local storage as the latest schedule snapshot.
6. Schedule page renders that cached response and orders tasks by solved time metadata.
7. Each schedule task includes `hour_index` and `start_datetime_label` for precise execution timing.

---

## Key Concepts And Formulas

### PM Interval (Hours)

$$
pm\_interval\_hours = \max(1, \lfloor mttf\_hours \times 0.85 \rfloor)
$$

- Defines how often PM is due in the hourly model.
- Uses floor to keep interval conservative and integer-aligned.

### PM Duration (Hours)

$$
pm\_duration\_hours = \max(1, \lceil mttr\_hours \times 0.70 \rceil)
$$

- Approximates PM active downtime from MTTR.
- Uses ceil to avoid understating required downtime.

### Why Hourly Granularity Matters

- Daily slots can hide short-cycle behavior by forcing coarse buckets.
- Hour-level scheduling preserves due-date precision and capacity realism.
- Critical for short-MTTF assets where a few hours materially changes failure risk.

Example:

- With MTTF = 4 hours, PM intervals are modeled at 4-hour scale.
- The optimizer can place starts at exact hour indices instead of rounding to a full day.

### Unit Conventions (Frontend vs Backend)

- Frontend displays and accepts MTTF/MTTR in **minutes**.
- Backend stores and computes MTTF/MTTR in **hours**.
- Maintenance log durations are in **hours**.
- Solver internals run on integer **hour indices**.

---

---

## Troubleshooting

## Backend Does Not Start

Symptoms:

- Uvicorn command fails
- Import errors

Checks:

1. Activate virtual environment.
2. Confirm dependencies installed from backend/requirements.txt.
3. Run from project root or backend directory as documented.

## Frontend Loads But API Calls Fail

Symptoms:

- Failed to fetch machine/maintenance/optimization

Checks:

1. Verify backend is running on port 8000.
2. Confirm frontend API base URL (default http://localhost:8000).
3. Open /health endpoint directly in browser.

## Schedule Page Is Empty

Possible causes:

- No optimization has been run yet.
- Local cache was cleared.
- Last optimization returned no required tasks in horizon.

Fix:

1. Go to Optimization page.
2. Run Optimizer.
3. Return to Schedule.

## Optimization Returns Error / Infeasible

Possible causes:

- Capacity too low for due windows.
- Peak-day restrictions too strict.
- Added constraints conflict.

Fix sequence:

1. Increase Daily Capacity.
2. Disable Avoid Peak Days temporarily.
3. Extend Horizon Days.
4. Retry with less strict downtime/availability targets.

## Unit Confusion (Minutes vs Hours)

Rules to remember:

- Enter MTTF/MTTR in minutes in frontend forms.
- Backend stores MTTF/MTTR in hours.
- Maintenance log duration is in hours.
- Machine tables display MTTF/MTTR in minutes.

---

## FAQ

## 1) Do I need to re-run optimization after logging maintenance?

Yes. Schedule page shows the last cached optimization snapshot. Re-run to reflect new data.

## 2) Why does one machine show preventive instead of running?

Status is based on reliability score and maintenance age thresholds, not only current machine state.

## 3) Is Export Schedule active?

The button is present in UI, but export is currently a placeholder and not wired to a backend export endpoint.

## 4) Can I optimize only selected machines?

Yes, API supports machineData in optimize payload. Current UI defaults to full DB set unless customized.

## 5) Can PM-OPT work without backend?

Some frontend views can show fallback demo data, but production use requires backend API for persistence and optimization.

## 6) Why are peak days represented as indices?

The optimizer accepts day indices for deterministic constraints in the planning horizon. UI currently sends a demo set by default.

---

## Developer Technical Reference

## Architecture Summary

- Frontend: React + TypeScript + Vite + Tailwind + Recharts + React Router
- Backend: FastAPI + SQLAlchemy + Pydantic + SQLite + PuLP (CBC)

## Key Backend Modules

| Area | Responsibility |
|---|---|
| app/main.py | FastAPI app creation, CORS, route registration, startup init/seed |
| app/routes | HTTP endpoint contracts |
| app/services | Business logic and DB orchestration |
| app/milp/scheduler.py | MILP model construction and solve |
| app/models | SQLAlchemy entities |
| app/schemas | Pydantic request/response validation |
| app/utils/seed.py | Demo machine seeding |

## Database Schema Basics

### machines table

- id (PK)
- name (unique)
- mttf_hours
- mttr_hours
- downtime_cost_per_hour
- last_maintenance_days_ago
- created_at

### maintenance_data table

- id (PK)
- machine_id (FK -> machines.id)
- performed_at
- duration_hours
- notes

## Startup Lifecycle

On backend startup:

1. Create tables if missing.
2. Seed default machines if machines table is empty.

## Reliability/Data Handling Notes

- Frontend computes status and reliability score from normalized inputs.
- Backend recalculates last_maintenance_days_ago from latest maintenance records when records change.

---

## API Reference

Base URL: http://localhost:8000

## Health

### GET /health

Response:

```json
{
  "status": "ok"
}
```

## Machines

### GET /machines

- Returns all machines.

### GET /machines/{machine_id}

- Returns one machine by ID.

### POST /machines

Request example:

```json
{
  "name": "Conveyor A",
  "mttf_hours": 1000,
  "mttr_hours": 5,
  "downtime_cost_per_hour": 450,
  "last_maintenance_days_ago": 9
}
```

### PUT /machines/{machine_id}

- Full update payload required by schema.

### DELETE /machines/{machine_id}

- Deletes machine and cascaded maintenance records.

## Maintenance Data

### GET /maintenance-data

- Returns maintenance records with machine_name.

### GET /maintenance-data/{record_id}

- Returns single maintenance record.

### POST /maintenance-data

Request example:

```json
{
  "machine_id": 1,
  "performed_at": "2026-04-07T08:00:00",
  "duration_hours": 4,
  "notes": "Routine PM"
}
```

### PUT /maintenance-data/{record_id}

- Updates a maintenance record.

### DELETE /maintenance-data/{record_id}

- Deletes a maintenance record.

## Optimization

### POST /optimize

Request example:

```json
{
  "horizon_days": 7,
  "slots_per_day": 2,
  "maintenance_capacity_per_day": 2,
  "peak_day_indices": [1, 2],
  "avoid_peak_days": true,
  "constraints": {
    "maxDowntime": 12,
    "targetAvailability": 85
  }
}
```

Request notes:

- `slots_per_day` is still accepted for backward compatibility.
- The hourly-grid solver ignores `slots_per_day` internally for decision granularity.
- Capacity is enforced per hour (`horizon_days * 24`), not per coarse day-slot bucket.

Response includes:

- `schedule[]` with machine/day/time metadata plus hourly fields (`hour_index`, `start_datetime_label`)
- `kpis` with predicted downtime, availability, `horizon_days`, and `horizon_hours`

Response example:

```json
{
  "schedule": [
    {
      "machine": "Log Saw",
      "day": "Monday",
      "time": "08:00",
      "machine_id": 4,
      "day_index": 0,
      "hour_index": 0,
      "slot_index": 0,
      "slot_in_day": 0,
      "slot_label": "First Half",
      "start_datetime_label": "Monday, 08:00",
      "maintenance_duration_days": 1,
      "maintenance_duration_hours": 8.0,
      "maintenance_duration_minutes": 480.0,
      "expected_downtime_hours": 8.0,
      "estimated_cost_impact": 24000.0
    }
  ],
  "kpis": {
    "predicted_downtime": 16.0,
    "availability": 96.2,
    "predicted_downtime_hours": 16.0,
    "fleet_availability": 0.962,
    "horizon_days": 7,
    "horizon_hours": 168,
    "slots_per_day": 2,
    "horizon_slots": 168
  }
}
```

### ScheduleItem Fields (Optimization Response)

| Field | Type | Meaning |
|---|---|---|
| `hour_index` | integer \| null | Exact hour offset in optimization horizon where PM starts |
| `start_datetime_label` | string \| null | Human-readable start label derived from hour index (example: `Day 1, 08:00`) |

### KPIResponse Fields (Optimization Response)

| Field | Type | Meaning |
|---|---|---|
| `horizon_hours` | integer \| null | Total solved hour buckets (`horizon_days * 24`) |

## Typical Error Codes

| Status | Meaning |
|---|---|
| 400 | Invalid optimization scenario (for example infeasible constraints) |
| 404 | Machine or maintenance record not found |
| 409 | Duplicate machine name conflict |
| 422 | Request validation error |

---

## Recommended Operating Pattern

1. Keep machine master data clean and updated.
2. Log all maintenance records promptly.
3. Run optimization at least once per planning cycle (daily/shift/weekly).
4. Review Schedule page as the operational source of truth.
5. Re-optimize whenever major inputs change.

PM-OPT gives you a repeatable, data-backed process to reduce downtime and improve maintenance planning quality.
