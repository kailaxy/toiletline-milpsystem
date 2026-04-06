from sqlalchemy.orm import Session

from app.milp.scheduler import run_maintenance_optimization
from app.models.machine import Machine
from app.schemas.optimize import OptimizeRequest, OptimizeResponse
from app.services.machine_service import get_machines


def _resolve_machine_from_identifier(machines: list[Machine], value: str) -> Machine | None:
    normalized = value.strip().casefold()
    if not normalized:
        return None

    for machine in machines:
        if machine.name.casefold() == normalized:
            return machine

    if normalized.isdigit():
        machine_id = int(normalized)
        for machine in machines:
            if machine.id == machine_id:
                return machine

    return None


def _get_effective_request(payload: OptimizeRequest) -> OptimizeRequest:
    effective = payload.model_copy(deep=True)
    constraints = payload.constraints
    if constraints is None:
        return effective

    if constraints.maintenance_capacity_per_day is not None:
        effective.maintenance_capacity_per_day = constraints.maintenance_capacity_per_day
    if constraints.peak_day_indices is not None:
        effective.peak_day_indices = constraints.peak_day_indices
    if constraints.avoid_peak_days is not None:
        effective.avoid_peak_days = constraints.avoid_peak_days

    return effective


def _resolve_machine_inputs(db_machines: list[Machine], payload: OptimizeRequest) -> list[Machine]:
    if not payload.machine_data:
        return db_machines

    resolved: list[Machine] = []

    for index, entry in enumerate(payload.machine_data):
        if isinstance(entry, str):
            machine = _resolve_machine_from_identifier(db_machines, entry)
            if machine is None:
                raise ValueError(
                    f"Machine '{entry}' was provided in machineData but does not exist in the database"
                )
            resolved.append(machine)
            continue

        matched: Machine | None = None
        if entry.machine_id is not None:
            matched = next((machine for machine in db_machines if machine.id == entry.machine_id), None)
        if matched is None and entry.machine:
            matched = _resolve_machine_from_identifier(db_machines, entry.machine)

        machine_name = entry.machine or (matched.name if matched else f"Machine {index + 1}")
        mttf_hours = entry.mttf_hours if entry.mttf_hours is not None else (matched.mttf_hours if matched else None)
        mttr_hours = entry.mttr_hours if entry.mttr_hours is not None else (matched.mttr_hours if matched else None)
        downtime_cost_per_hour = (
            entry.downtime_cost_per_hour
            if entry.downtime_cost_per_hour is not None
            else (matched.downtime_cost_per_hour if matched else None)
        )
        last_maintenance_days_ago = (
            entry.last_maintenance_days_ago
            if entry.last_maintenance_days_ago is not None
            else (matched.last_maintenance_days_ago if matched else None)
        )

        missing_fields = [
            field_name
            for field_name, field_value in [
                ("mttf_hours", mttf_hours),
                ("mttr_hours", mttr_hours),
                ("downtime_cost_per_hour", downtime_cost_per_hour),
                ("last_maintenance_days_ago", last_maintenance_days_ago),
            ]
            if field_value is None
        ]
        if missing_fields:
            raise ValueError(
                f"machineData[{index}] is missing required machine reliability fields: {', '.join(missing_fields)}"
            )

        resolved.append(
            Machine(
                id=entry.machine_id or (matched.id if matched else (1000 + index)),
                name=machine_name,
                mttf_hours=float(mttf_hours),
                mttr_hours=float(mttr_hours),
                downtime_cost_per_hour=float(downtime_cost_per_hour),
                last_maintenance_days_ago=float(last_maintenance_days_ago),
            )
        )

    return resolved


def optimize_schedule(db: Session, payload: OptimizeRequest) -> OptimizeResponse:
    db_machines = get_machines(db)
    machines = _resolve_machine_inputs(db_machines, payload)
    if not machines:
        raise ValueError("No machines available for optimization")

    effective_request = _get_effective_request(payload)
    return run_maintenance_optimization(machines=machines, request=effective_request)
