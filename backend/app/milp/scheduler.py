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


def _latest_allowed_start_day(profile: MachineProfile) -> int:
    """
    Latest day index when PM can start before machine age exceeds pm_interval.

    Condition enforced:
      current_age_days + start_day < pm_interval_days

    Rearranged bound for integer day indices:
      start_day <= ceil(pm_interval_days - current_age_days) - 1
    """
    return math.ceil(profile.pm_interval_days - profile.current_age_days) - 1


def run_maintenance_optimization(machines: list[Machine], request: OptimizeRequest) -> OptimizeResponse:
    if not machines:
        raise ValueError("No machines available for optimization")

    horizon = request.horizon_days
    profiles = [_build_machine_profile(machine, horizon_days=horizon) for machine in machines]

    # Hard cap per requirements: no more than 2 concurrent maintenance tasks.
    requested_capacity = request.maintenance_capacity_per_day
    hard_capacity = max(1, min(requested_capacity, 2))

    # Validate immediate due-date feasibility before solving.
    latest_start_by_machine: dict[int, int] = {}
    for profile in profiles:
        latest_start_day = _latest_allowed_start_day(profile)
        latest_start_by_machine[profile.machine_id] = latest_start_day
        if latest_start_day < 0:
            raise ValueError(
                "Infeasible due-date constraints: "
                f"machine '{profile.machine_name}' already exceeds pm_interval "
                f"(current_age_days={profile.current_age_days}, pm_interval_days={profile.pm_interval_days})."
            )

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

    # Objective: earlier feasible PM starts are preferred to minimize lateness risk.
    model += lpSum(
        (day + 1) * x[profile.machine_id][day]
        for profile in profiles
        for day in range(horizon)
    )

    # Every machine must have exactly one PM task scheduled in the optimization horizon.
    for profile in profiles:
        model += lpSum(x[profile.machine_id][day] for day in range(horizon)) == 1

    # Due-date constraint: PM must start before machine age exceeds pm_interval.
    for profile in profiles:
        latest_start_day = latest_start_by_machine[profile.machine_id]
        if latest_start_day < horizon - 1:
            allowed_window_end = max(0, latest_start_day)
            model += lpSum(x[profile.machine_id][day] for day in range(0, allowed_window_end + 1)) == 1

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
        selected_day = 0
        for day in range(horizon):
            if value(x[profile.machine_id][day]) and value(x[profile.machine_id][day]) > 0.5:
                selected_day = day
                break

        machine_optimized_days = float(profile.pm_duration_days)
        machine_baseline_days = profile.baseline_downtime_days
        machine_cost = machine_optimized_days * 24.0 * profile.downtime_cost_per_hour

        optimized_downtime_days += machine_optimized_days
        baseline_downtime_days += machine_baseline_days
        baseline_per_machine_days[profile.machine_name] = round(machine_baseline_days, 4)

        schedule.append(
            ScheduleItem(
                machine=profile.machine_name,
                day=_day_label(selected_day, horizon),
                time=TIME_LABEL,
                machine_id=profile.machine_id,
                day_index=selected_day,
                maintenance_duration_days=profile.pm_duration_days,
                expected_downtime_hours=round(machine_optimized_days * 24.0, 2),
                estimated_cost_impact=round(machine_cost, 2),
            )
        )

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
