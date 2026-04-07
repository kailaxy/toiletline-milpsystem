import math
from dataclasses import dataclass

from pulp import LpBinary, LpMinimize, LpProblem, LpStatus, LpVariable, PULP_CBC_CMD, lpSum, value

from app.models.machine import Machine
from app.schemas.optimize import KPIResponse, OptimizeRequest, OptimizeResponse, ScheduleItem


DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
BASE_START_HOUR = 8.0


@dataclass
class MachineProfile:
    machine_id: int
    machine_name: str
    mttf_hours: float
    mttr_hours: float
    pm_interval_hours: int
    pm_duration_hours: float
    pm_duration_active_hours: int
    pm_duration_days: int
    baseline_downtime_days: float
    downtime_cost_per_hour: float
    current_age_hours: float


def _build_machine_profile(machine: Machine, horizon_days: int) -> MachineProfile:
    """
    Convert raw machine reliability inputs to hour-based MILP parameters.

    Time unit convention for this scheduler:
    - MTTF and MTTR are in hours
    - PM interval and PM active duration are integer hours
    - model constraints operate on integer hour indices
    """
    mttf_hours = max(machine.mttf_hours, 1e-6)
    mttr_hours = max(machine.mttr_hours, 1e-6)

    pm_interval_hours = max(1, math.floor(mttf_hours * 0.85))
    pm_duration_hours = max(1.0, math.ceil(mttr_hours * 0.70))
    pm_duration_active_hours = max(1, math.ceil(pm_duration_hours))
    pm_duration_days = max(1, math.ceil(pm_duration_hours / 24.0))

    baseline_downtime_days = (horizon_days * 24.0 / mttf_hours) * (mttr_hours / 24.0)

    return MachineProfile(
        machine_id=machine.id,
        machine_name=machine.name,
        mttf_hours=mttf_hours,
        mttr_hours=mttr_hours,
        pm_interval_hours=pm_interval_hours,
        pm_duration_hours=pm_duration_hours,
        pm_duration_active_hours=pm_duration_active_hours,
        pm_duration_days=pm_duration_days,
        baseline_downtime_days=baseline_downtime_days,
        downtime_cost_per_hour=machine.downtime_cost_per_hour,
        current_age_hours=machine.last_maintenance_days_ago * 24.0,
    )


def _day_label(day_index: int, horizon_days: int) -> str:
    if horizon_days == 7:
        return DAY_NAMES[day_index]
    return f"Day {day_index + 1}"


def _hour_to_time_label(hour_in_day: int) -> str:
    hour_value = (BASE_START_HOUR + hour_in_day) % 24.0
    hours = int(hour_value)
    minutes = int(round((hour_value - hours) * 60.0))
    if minutes == 60:
        minutes = 0
        hours = (hours + 1) % 24
    return f"{hours:02d}:{minutes:02d}"


def _slot_label(slot_in_day: int, slots_per_day: int) -> str:
    if slots_per_day <= 0:
        return f"Hour {slot_in_day + 1}/24"
    if slots_per_day == 2:
        return "First Half" if slot_in_day == 0 else "Second Half"
    return f"Slot {slot_in_day + 1}/{slots_per_day}"


def _first_due_deadline_hour(profile: MachineProfile) -> int:
    """
    First due deadline slot index for recurring PM cycles.

    Required formula:
            D0 = ceil(pm_interval_hours - current_age_hours) - 1
    """
    return math.ceil(profile.pm_interval_hours - profile.current_age_hours) - 1


def _build_cycle_windows(profile: MachineProfile, horizon_hours: int) -> list[tuple[int, int, int]]:
    """
    Build recurring cycle windows as (deadline_hour, window_start, window_end).

    For each cycle q:
            Dq = D0 + q * pm_interval_hours
            enforce exactly one start in [max(0, Dq - pm_interval_hours + 1), Dq]
    """
    interval = profile.pm_interval_hours
    first_deadline = _first_due_deadline_hour(profile)
    windows: list[tuple[int, int, int]] = []

    if interval <= 0:
        return windows

    deadline = first_deadline
    while deadline < 0:
        deadline += interval

    while deadline < horizon_hours:
        window_start = max(0, deadline - interval + 1)
        windows.append((deadline, window_start, deadline))
        deadline += interval

    return windows


def _hour_to_datetime_label(hour_index: int, horizon_days: int) -> str:
    day_index = hour_index // 24
    hour_in_day = hour_index % 24
    return f"{_day_label(day_index, horizon_days)}, {_hour_to_time_label(hour_in_day)}"


def run_maintenance_optimization(machines: list[Machine], request: OptimizeRequest) -> OptimizeResponse:
    if not machines:
        raise ValueError("No machines available for optimization")

    horizon_days = request.horizon_days
    slots_per_day = request.slots_per_day  # kept for backward compatibility; ignored internally
    horizon_hours = horizon_days * 24
    profiles = [_build_machine_profile(machine, horizon_days=horizon_days) for machine in machines]

    effective_capacity = max(1, request.maintenance_capacity_per_day)

    cycle_windows_by_machine: dict[int, list[tuple[int, int, int]]] = {}
    for profile in profiles:
        cycle_windows_by_machine[profile.machine_id] = _build_cycle_windows(profile, horizon_hours=horizon_hours)

    model = LpProblem("preventive_maintenance_scheduler", LpMinimize)

    # Decision variable:
    # x[m][h] = 1 if machine m starts preventive maintenance at hour index h.
    x: dict[int, dict[int, LpVariable]] = {
        profile.machine_id: {
            hour: LpVariable(f"x_{profile.machine_id}_{hour}", lowBound=0, upBound=1, cat=LpBinary)
            for hour in range(horizon_hours)
        }
        for profile in profiles
    }

    # Objective: minimize earliness-to-deadline over recurring cycle windows.
    model += lpSum(
        (deadline_hour - hour) * x[profile.machine_id][hour]
        for profile in profiles
        for deadline_hour, window_start, window_end in cycle_windows_by_machine[profile.machine_id]
        for hour in range(window_start, window_end + 1)
    )

    # Each machine gets one PM start per due-cycle window, and no extra starts.
    for profile in profiles:
        cycle_windows = cycle_windows_by_machine[profile.machine_id]
        model += lpSum(x[profile.machine_id][hour] for hour in range(horizon_hours)) == len(cycle_windows)

        for _deadline_hour, window_start, window_end in cycle_windows:
            model += lpSum(x[profile.machine_id][hour] for hour in range(window_start, window_end + 1)) == 1

    # Capacity constraint semantics:
    # - request.maintenance_capacity_per_day is interpreted as concurrent hourly capacity
    #   (crew size), i.e., how many PM tasks can be in-progress at the same hour.
    # - We enforce this limit for EVERY hour t in the optimization horizon.
    # - A PM task that starts at hour s is considered active at hour t iff:
    #       s <= t < s + pm_duration_active_hours
    #   This is a half-open active window [s, s + duration).
    # - Example: if a task starts at hour 10 and duration is 8 hours, then it is active
    #   at hours 10, 11, 12, 13, 14, 15, 16, and 17.
    #
    # Mathematical form (for each hour t):
    #   sum_{m in machines} sum_{s: s <= t < s + dur_m} x[m, s] <= effective_capacity
    # where x[m, s] = 1 means machine m starts PM at hour s.
    for hour in range(horizon_hours):
        active_jobs = []
        for profile in profiles:
            for start_hour in range(horizon_hours):
                # Include x[m][s] in hour t only when start s is still active at t.
                if start_hour <= hour < start_hour + profile.pm_duration_active_hours:
                    active_jobs.append(x[profile.machine_id][start_hour])
        model += lpSum(active_jobs) <= effective_capacity

    if request.avoid_peak_days and request.peak_day_indices:
        forbidden_hours: set[int] = set()
        for day in request.peak_day_indices:
            if 0 <= day < horizon_days:
                start_hour = day * 24
                forbidden_hours.update(range(start_hour, start_hour + 24))
        for profile in profiles:
            for hour in forbidden_hours:
                model += x[profile.machine_id][hour] == 0

    if request.constraints and request.constraints.max_downtime is not None:
        # In strict mode, downtime KPI uses day units.
        model += lpSum(
            (profile.pm_duration_hours / 24.0) * x[profile.machine_id][hour]
            for profile in profiles
            for hour in range(horizon_hours)
        ) <= request.constraints.max_downtime

    if request.constraints and request.constraints.target_availability is not None:
        target_availability = request.constraints.target_availability
        target_ratio = target_availability / 100.0 if target_availability > 1 else target_availability
        total_possible_uptime_days = horizon_days * len(profiles)
        allowed_downtime = max(0.0, (1.0 - target_ratio) * total_possible_uptime_days)
        model += lpSum(
            (profile.pm_duration_hours / 24.0) * x[profile.machine_id][hour]
            for profile in profiles
            for hour in range(horizon_hours)
        ) <= allowed_downtime

    model.solve(PULP_CBC_CMD(msg=False))

    solver_status = LpStatus[model.status]
    if solver_status not in {"Optimal", "Feasible"}:
        raise ValueError(
            "Infeasible optimization under strict PM due-date and requested capacity constraints. "
            f"Solver status: {solver_status}."
        )

    schedule: list[ScheduleItem] = []
    optimized_downtime_days = 0.0
    baseline_downtime_days = 0.0
    baseline_per_machine_days: dict[str, float] = {}

    for profile in profiles:
        selected_hours: list[int] = []
        for hour in range(horizon_hours):
            if value(x[profile.machine_id][hour]) and value(x[profile.machine_id][hour]) > 0.5:
                selected_hours.append(hour)

        machine_optimized_days = (profile.pm_duration_hours * len(selected_hours)) / 24.0
        machine_baseline_days = profile.baseline_downtime_days

        optimized_downtime_days += machine_optimized_days
        baseline_downtime_days += machine_baseline_days
        baseline_per_machine_days[profile.machine_name] = round(machine_baseline_days, 4)

        for selected_hour in selected_hours:
            day_index = selected_hour // 24
            hour_in_day = selected_hour % 24
            time_label = _hour_to_time_label(hour_in_day)
            slot_in_day = None
            slot_label = None
            if slots_per_day > 0:
                slot_size_hours = 24.0 / slots_per_day
                slot_in_day = min(slots_per_day - 1, int(hour_in_day / slot_size_hours))
                slot_label = _slot_label(slot_in_day, slots_per_day)
            task_downtime_hours = float(profile.pm_duration_hours)
            task_cost = task_downtime_hours * profile.downtime_cost_per_hour
            schedule.append(
                ScheduleItem(
                    machine=profile.machine_name,
                    day=_day_label(day_index, horizon_days),
                    time=time_label,
                    machine_id=profile.machine_id,
                    day_index=day_index,
                    hour_index=selected_hour,
                    slot_index=selected_hour,
                    slot_in_day=slot_in_day,
                    slot_label=slot_label,
                    start_datetime_label=_hour_to_datetime_label(selected_hour, horizon_days),
                    maintenance_duration_days=profile.pm_duration_days,
                    maintenance_duration_hours=round(task_downtime_hours, 2),
                    maintenance_duration_minutes=round(task_downtime_hours * 60.0, 1),
                    expected_downtime_hours=round(task_downtime_hours, 2),
                    estimated_cost_impact=round(task_cost, 2),
                )
            )

    schedule.sort(
        key=lambda item: ((getattr(item, "hour_index", None) or item.slot_index or 0), item.machine_id or 0)
    )

    improvement_percent = 0.0
    if baseline_downtime_days > 0:
        improvement_percent = ((baseline_downtime_days - optimized_downtime_days) / baseline_downtime_days) * 100.0

    total_possible_uptime_days = horizon_days * len(profiles)
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
            horizon_days=horizon_days,
            slots_per_day=slots_per_day,
            horizon_slots=horizon_hours,
            horizon_hours=horizon_hours,
        ),
    )
