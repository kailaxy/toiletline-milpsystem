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
    mttf_days: float
    mttr_days: float
    pm_interval_days: int
    pm_interval_slots: int
    pm_duration_hours: float
    pm_duration_slots: int
    pm_duration_days: int
    baseline_downtime_days: float
    downtime_cost_per_hour: float
    current_age_days: float
    current_age_slots: float


def _build_machine_profile(machine: Machine, horizon_days: int, slots_per_day: int) -> MachineProfile:
    """
    Convert raw machine reliability inputs to slot-based MILP parameters.

    Time unit convention for this scheduler:
    - MTTF and MTTR are converted from hours to days
    - pm_interval is computed in days then expanded to slots
    - pm_duration occupancy is computed in slots from duration hours
    - model constraints operate on integer slot indices
    """
    mttf_days = max(machine.mttf_hours / 24.0, 1e-6)
    mttr_days = max(machine.mttr_hours / 24.0, 1e-6)

    # Capstone formulas (required):
    # pm_interval = floor(mttf * 0.85)
    # pm_duration_hours = mttr_hours * 0.70
    pm_interval_days = max(1, math.floor(mttf_days * 0.85))
    pm_duration_hours = max(machine.mttr_hours * 0.70, 0.05)
    pm_duration_days = max(1, math.ceil(pm_duration_hours / 24.0))
    pm_interval_slots = pm_interval_days * slots_per_day
    slot_duration_hours = 24.0 / slots_per_day
    pm_duration_slots = max(1, math.ceil(pm_duration_hours / slot_duration_hours))

    baseline_downtime_days = (horizon_days / mttf_days) * mttr_days

    return MachineProfile(
        machine_id=machine.id,
        machine_name=machine.name,
        mttf_days=mttf_days,
        mttr_days=mttr_days,
        pm_interval_days=pm_interval_days,
        pm_interval_slots=pm_interval_slots,
        pm_duration_hours=pm_duration_hours,
        pm_duration_slots=pm_duration_slots,
        pm_duration_days=pm_duration_days,
        baseline_downtime_days=baseline_downtime_days,
        downtime_cost_per_hour=machine.downtime_cost_per_hour,
        current_age_days=machine.last_maintenance_days_ago,
        current_age_slots=machine.last_maintenance_days_ago * slots_per_day,
    )


def _day_label(day_index: int, horizon_days: int) -> str:
    if horizon_days == 7:
        return DAY_NAMES[day_index]
    return f"Day {day_index + 1}"


def _slot_time_label(slot_in_day: int, slots_per_day: int) -> str:
    slot_hours = 24.0 / slots_per_day
    hour_value = (BASE_START_HOUR + (slot_in_day * slot_hours)) % 24.0
    hours = int(hour_value)
    minutes = int(round((hour_value - hours) * 60.0))
    if minutes == 60:
        minutes = 0
        hours = (hours + 1) % 24
    return f"{hours:02d}:{minutes:02d}"


def _slot_label(slot_in_day: int, slots_per_day: int) -> str:
    if slots_per_day == 2:
        return "First Half" if slot_in_day == 0 else "Second Half"
    return f"Slot {slot_in_day + 1}/{slots_per_day}"


def _first_due_deadline_slot(profile: MachineProfile) -> int:
    """
    First due deadline slot index for recurring PM cycles.

    Required formula:
          D0 = ceil(pm_interval_slots - current_age_slots) - 1
    """
    return math.ceil(profile.pm_interval_slots - profile.current_age_slots) - 1


def _build_cycle_windows(profile: MachineProfile, horizon_slots: int) -> list[tuple[int, int, int]]:
    """
    Build recurring cycle windows as (deadline_slot, window_start, window_end).

    For each cycle q:
          Dq = D0 + q * pm_interval_slots
          enforce exactly one start in [max(0, Dq - pm_interval_slots + 1), Dq]
    """
    interval = profile.pm_interval_slots
    first_deadline = _first_due_deadline_slot(profile)
    windows: list[tuple[int, int, int]] = []

    if interval <= 0:
        return windows

    deadline = max(0, first_deadline)
    while deadline < horizon_slots:
        window_start = max(0, deadline - interval + 1)
        windows.append((deadline, window_start, deadline))
        deadline += interval

    return windows


def run_maintenance_optimization(machines: list[Machine], request: OptimizeRequest) -> OptimizeResponse:
    if not machines:
        raise ValueError("No machines available for optimization")

    horizon_days = request.horizon_days
    slots_per_day = request.slots_per_day
    horizon_slots = horizon_days * slots_per_day
    profiles = [
        _build_machine_profile(machine, horizon_days=horizon_days, slots_per_day=slots_per_day)
        for machine in machines
    ]

    effective_capacity = max(1, request.maintenance_capacity_per_day)

    cycle_windows_by_machine: dict[int, list[tuple[int, int, int]]] = {}
    for profile in profiles:
        cycle_windows_by_machine[profile.machine_id] = _build_cycle_windows(profile, horizon_slots=horizon_slots)

    model = LpProblem("preventive_maintenance_scheduler", LpMinimize)

    # Decision variable:
    # x[m][s] = 1 if machine m starts preventive maintenance on slot index s.
    x: dict[int, dict[int, LpVariable]] = {
        profile.machine_id: {
            slot: LpVariable(f"x_{profile.machine_id}_{slot}", lowBound=0, upBound=1, cat=LpBinary)
            for slot in range(horizon_slots)
        }
        for profile in profiles
    }

    # Objective: minimize earliness-to-deadline over recurring cycle windows.
    model += lpSum(
        (deadline_slot - slot) * x[profile.machine_id][slot]
        for profile in profiles
        for deadline_slot, window_start, window_end in cycle_windows_by_machine[profile.machine_id]
        for slot in range(window_start, window_end + 1)
    )

    # Each machine gets one PM start per due-cycle window, and no extra starts.
    for profile in profiles:
        cycle_windows = cycle_windows_by_machine[profile.machine_id]
        model += lpSum(x[profile.machine_id][slot] for slot in range(horizon_slots)) == len(cycle_windows)

        for _deadline_slot, window_start, window_end in cycle_windows:
            model += lpSum(x[profile.machine_id][slot] for slot in range(window_start, window_end + 1)) == 1

    # Capacity constraint: active concurrent maintenances at each slot index <= requested capacity.
    for slot in range(horizon_slots):
        active_jobs = []
        for profile in profiles:
            for start_slot in range(horizon_slots):
                if start_slot <= slot < start_slot + profile.pm_duration_slots:
                    active_jobs.append(x[profile.machine_id][start_slot])
        model += lpSum(active_jobs) <= effective_capacity

    if request.avoid_peak_days and request.peak_day_indices:
        forbidden_slots: set[int] = set()
        for day in request.peak_day_indices:
            if 0 <= day < horizon_days:
                start_slot = day * slots_per_day
                forbidden_slots.update(range(start_slot, start_slot + slots_per_day))
        for profile in profiles:
            for slot in forbidden_slots:
                model += x[profile.machine_id][slot] == 0

    if request.constraints and request.constraints.max_downtime is not None:
        # In strict mode, downtime KPI uses day units.
        model += lpSum(
            (profile.pm_duration_slots / slots_per_day) * x[profile.machine_id][slot]
            for profile in profiles
            for slot in range(horizon_slots)
        ) <= request.constraints.max_downtime

    if request.constraints and request.constraints.target_availability is not None:
        target_availability = request.constraints.target_availability
        target_ratio = target_availability / 100.0 if target_availability > 1 else target_availability
        total_possible_uptime_days = horizon_days * len(profiles)
        allowed_downtime = max(0.0, (1.0 - target_ratio) * total_possible_uptime_days)
        model += lpSum(
            (profile.pm_duration_slots / slots_per_day) * x[profile.machine_id][slot]
            for profile in profiles
            for slot in range(horizon_slots)
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
        selected_slots: list[int] = []
        for slot in range(horizon_slots):
            if value(x[profile.machine_id][slot]) and value(x[profile.machine_id][slot]) > 0.5:
                selected_slots.append(slot)

        machine_optimized_days = (profile.pm_duration_hours * len(selected_slots)) / 24.0
        machine_baseline_days = profile.baseline_downtime_days

        optimized_downtime_days += machine_optimized_days
        baseline_downtime_days += machine_baseline_days
        baseline_per_machine_days[profile.machine_name] = round(machine_baseline_days, 4)

        for selected_slot in selected_slots:
            day_index = selected_slot // slots_per_day
            slot_in_day = selected_slot % slots_per_day
            time_label = _slot_time_label(slot_in_day, slots_per_day)
            task_downtime_hours = float(profile.pm_duration_hours)
            task_cost = task_downtime_hours * profile.downtime_cost_per_hour
            schedule.append(
                ScheduleItem(
                    machine=profile.machine_name,
                    day=_day_label(day_index, horizon_days),
                    time=time_label,
                    machine_id=profile.machine_id,
                    day_index=day_index,
                    slot_index=selected_slot,
                    slot_in_day=slot_in_day,
                    slot_label=_slot_label(slot_in_day, slots_per_day),
                    start_datetime_label=f"{_day_label(day_index, horizon_days)} {time_label}",
                    maintenance_duration_days=profile.pm_duration_days,
                    maintenance_duration_hours=round(task_downtime_hours, 2),
                    maintenance_duration_minutes=round(task_downtime_hours * 60.0, 1),
                    expected_downtime_hours=round(task_downtime_hours, 2),
                    estimated_cost_impact=round(task_cost, 2),
                )
            )

    schedule.sort(key=lambda item: ((item.slot_index or 0), item.machine_id or 0))

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
            horizon_slots=horizon_slots,
        ),
    )
