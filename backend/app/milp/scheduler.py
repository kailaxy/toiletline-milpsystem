import math
from dataclasses import dataclass

from pulp import LpBinary, LpMinimize, LpProblem, LpStatus, LpVariable, PULP_CBC_CMD, lpSum, value

from app.models.machine import Machine
from app.schemas.optimize import KPIResponse, OptimizeRequest, OptimizeResponse, ScheduleItem


DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
TIME_LABEL = "08:00"


@dataclass
class MachineProfile:
    machine_id: int
    machine_name: str
    mttf_days: float
    mttr_days: float
    pm_interval_days: int
    pm_duration_days: int
    baseline_downtime_days: float
    downtime_cost_per_hour: float
    current_age_days: float


def _build_machine_profile(machine: Machine, horizon_days: int) -> MachineProfile:
    """
    Convert raw machine reliability inputs to day-based MILP parameters.

    Time unit convention for this scheduler:
    - MTTF and MTTR are converted from hours to days
    - pm_interval and pm_duration are computed in days
    - all model constraints operate on integer day indices
    """
    mttf_days = max(machine.mttf_hours / 24.0, 1e-6)
    mttr_days = max(machine.mttr_hours / 24.0, 1e-6)

    # Capstone formulas (required):
    # pm_interval = floor(mttf * 0.85)
    # pm_duration = ceil(mttr * 0.70)
    pm_interval_days = math.floor(mttf_days * 0.85)
    pm_duration_days = max(1, math.ceil(mttr_days * 0.70))

    baseline_downtime_days = (horizon_days / mttf_days) * mttr_days

    return MachineProfile(
        machine_id=machine.id,
        machine_name=machine.name,
        mttf_days=mttf_days,
        mttr_days=mttr_days,
        pm_interval_days=pm_interval_days,
        pm_duration_days=pm_duration_days,
        baseline_downtime_days=baseline_downtime_days,
        downtime_cost_per_hour=machine.downtime_cost_per_hour,
        current_age_days=machine.last_maintenance_days_ago,
    )


def _day_label(day_index: int, horizon_days: int) -> str:
    if horizon_days == 7:
        return DAY_NAMES[day_index]
    return f"Day {day_index + 1}"


def _first_due_deadline(profile: MachineProfile) -> int:
    """
    First due deadline day index for recurring PM cycles.

    Required formula:
      D0 = ceil(pm_interval_days - current_age_days) - 1
    """
    return math.ceil(profile.pm_interval_days - profile.current_age_days) - 1


def _build_cycle_windows(profile: MachineProfile, horizon_days: int) -> list[tuple[int, int, int]]:
    """
    Build recurring cycle windows as (deadline_day, window_start, window_end).

    For each cycle q:
      Dq = D0 + q * pm_interval_days
      enforce exactly one start in [max(0, Dq - pm_interval_days + 1), Dq]
    """
    interval = profile.pm_interval_days
    first_deadline = _first_due_deadline(profile)
    windows: list[tuple[int, int, int]] = []

    if interval <= 0:
        return windows

    deadline = first_deadline
    while deadline < horizon_days:
        window_start = max(0, deadline - interval + 1)
        windows.append((deadline, window_start, deadline))
        deadline += interval

    return windows


def run_maintenance_optimization(machines: list[Machine], request: OptimizeRequest) -> OptimizeResponse:
    if not machines:
        raise ValueError("No machines available for optimization")

    horizon = request.horizon_days
    profiles = [_build_machine_profile(machine, horizon_days=horizon) for machine in machines]

    # Hard cap per requirements: no more than 2 concurrent maintenance tasks.
    requested_capacity = request.maintenance_capacity_per_day
    hard_capacity = max(1, min(requested_capacity, 2))

    # Validate immediate due-date feasibility before solving.
    cycle_windows_by_machine: dict[int, list[tuple[int, int, int]]] = {}
    for profile in profiles:
        first_deadline = _first_due_deadline(profile)
        if first_deadline < 0:
            raise ValueError(
                "Infeasible due-date constraints: "
                f"machine '{profile.machine_name}' already exceeds pm_interval "
                f"(current_age_days={profile.current_age_days}, pm_interval_days={profile.pm_interval_days})."
            )
        cycle_windows_by_machine[profile.machine_id] = _build_cycle_windows(profile, horizon_days=horizon)

    model = LpProblem("preventive_maintenance_scheduler", LpMinimize)

    # Decision variable:
    # x[m][d] = 1 if machine m starts preventive maintenance on day index d.
    x: dict[int, dict[int, LpVariable]] = {
        profile.machine_id: {
            day: LpVariable(f"x_{profile.machine_id}_{day}", lowBound=0, upBound=1, cat=LpBinary)
            for day in range(horizon)
        }
        for profile in profiles
    }

    # Objective: minimize earliness-to-deadline over recurring cycle windows.
    model += lpSum(
        (deadline_day - day) * x[profile.machine_id][day]
        for profile in profiles
        for deadline_day, window_start, window_end in cycle_windows_by_machine[profile.machine_id]
        for day in range(window_start, window_end + 1)
    )

    # Each machine gets one PM start per due-cycle window, and no extra starts.
    for profile in profiles:
        cycle_windows = cycle_windows_by_machine[profile.machine_id]
        model += lpSum(x[profile.machine_id][day] for day in range(horizon)) == len(cycle_windows)

        for deadline_day, window_start, window_end in cycle_windows:
            model += lpSum(x[profile.machine_id][day] for day in range(window_start, window_end + 1)) == 1

    # Capacity constraint: active concurrent maintenances at each exact day index <= hard_capacity (<=2).
    for day in range(horizon):
        active_jobs = []
        for profile in profiles:
            for start_day in range(horizon):
                if start_day <= day < start_day + profile.pm_duration_days:
                    active_jobs.append(x[profile.machine_id][start_day])
        model += lpSum(active_jobs) <= hard_capacity

    if request.avoid_peak_days and request.peak_day_indices:
        forbidden_days = {day for day in request.peak_day_indices if 0 <= day < horizon}
        for profile in profiles:
            for day in forbidden_days:
                model += x[profile.machine_id][day] == 0

    if request.constraints and request.constraints.max_downtime is not None:
        # In strict mode, downtime KPI uses day units.
        model += lpSum(
            profile.pm_duration_days * x[profile.machine_id][day]
            for profile in profiles
            for day in range(horizon)
        ) <= request.constraints.max_downtime

    if request.constraints and request.constraints.target_availability is not None:
        target_availability = request.constraints.target_availability
        target_ratio = target_availability / 100.0 if target_availability > 1 else target_availability
        total_possible_uptime_days = horizon * len(profiles)
        allowed_downtime = max(0.0, (1.0 - target_ratio) * total_possible_uptime_days)
        model += lpSum(
            profile.pm_duration_days * x[profile.machine_id][day]
            for profile in profiles
            for day in range(horizon)
        ) <= allowed_downtime

    model.solve(PULP_CBC_CMD(msg=False))

    solver_status = LpStatus[model.status]
    if solver_status not in {"Optimal", "Feasible"}:
        raise ValueError(
            "Infeasible optimization under strict PM due-date and capacity<=2 constraints. "
            f"Solver status: {solver_status}."
        )

    schedule: list[ScheduleItem] = []
    optimized_downtime_days = 0.0
    baseline_downtime_days = 0.0
    baseline_per_machine_days: dict[str, float] = {}

    for profile in profiles:
        selected_days: list[int] = []
        for day in range(horizon):
            if value(x[profile.machine_id][day]) and value(x[profile.machine_id][day]) > 0.5:
                selected_days.append(day)

        machine_optimized_days = float(profile.pm_duration_days * len(selected_days))
        machine_baseline_days = profile.baseline_downtime_days

        optimized_downtime_days += machine_optimized_days
        baseline_downtime_days += machine_baseline_days
        baseline_per_machine_days[profile.machine_name] = round(machine_baseline_days, 4)

        for selected_day in selected_days:
            task_downtime_days = float(profile.pm_duration_days)
            task_cost = task_downtime_days * 24.0 * profile.downtime_cost_per_hour
            schedule.append(
                ScheduleItem(
                    machine=profile.machine_name,
                    day=_day_label(selected_day, horizon),
                    time=TIME_LABEL,
                    machine_id=profile.machine_id,
                    day_index=selected_day,
                    maintenance_duration_days=profile.pm_duration_days,
                    expected_downtime_hours=round(task_downtime_days * 24.0, 2),
                    estimated_cost_impact=round(task_cost, 2),
                )
            )

    schedule.sort(key=lambda item: ((item.day_index or 0), item.machine_id or 0))

    improvement_percent = 0.0
    if baseline_downtime_days > 0:
        improvement_percent = ((baseline_downtime_days - optimized_downtime_days) / baseline_downtime_days) * 100.0

    total_possible_uptime_days = horizon * len(profiles)
    availability_ratio = max(0.0, 1.0 - (optimized_downtime_days / total_possible_uptime_days))
    availability_percent = availability_ratio * 100.0
    optimized_downtime_hours = optimized_downtime_days * 24.0

    return OptimizeResponse(
        schedule=schedule,
        kpis=KPIResponse(
            predicted_downtime=round(optimized_downtime_hours, 2),
            availability=round(availability_percent, 2),
            baseline_downtime_days=round(baseline_downtime_days, 4),
            optimized_downtime_days=round(optimized_downtime_days, 4),
            downtime_improvement_percent=round(improvement_percent, 2),
            baseline_downtime_per_machine_days=baseline_per_machine_days,
            time_unit="days",
            predicted_downtime_hours=round(optimized_downtime_hours, 2),
            fleet_availability=round(availability_ratio, 4),
            horizon_days=horizon,
        ),
    )
