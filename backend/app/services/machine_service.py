from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.maintenance_data import MaintenanceData
from app.schemas.machine import MachineCreate, MachineUpdate


def create_machine(db: Session, payload: MachineCreate) -> Machine:
    machine = Machine(**payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


def get_machine_by_id(db: Session, machine_id: int) -> Machine | None:
    return db.query(Machine).filter(Machine.id == machine_id).first()


def is_machine_name_conflict(db: Session, name: str, exclude_machine_id: int | None = None) -> bool:
    query = db.query(Machine).filter(func.lower(Machine.name) == name.lower())
    if exclude_machine_id is not None:
        query = query.filter(Machine.id != exclude_machine_id)
    return query.first() is not None


def update_machine(db: Session, machine: Machine, payload: MachineUpdate) -> Machine:
    for field, value in payload.model_dump().items():
        setattr(machine, field, value)

    db.commit()
    db.refresh(machine)
    return machine


def delete_machine(db: Session, machine: Machine) -> None:
    db.delete(machine)
    db.commit()


def _days_since(performed_at: datetime) -> float:
    performed_at_utc = (
        performed_at.replace(tzinfo=timezone.utc)
        if performed_at.tzinfo is None
        else performed_at.astimezone(timezone.utc)
    )
    delta_seconds = (datetime.now(timezone.utc) - performed_at_utc).total_seconds()
    return max(0.0, delta_seconds / 86400.0)


def get_machines(db: Session) -> list[Machine]:
    machines = db.query(Machine).order_by(Machine.id.asc()).all()

    latest_by_machine_id = {
        machine_id: performed_at
        for machine_id, performed_at in (
            db.query(MaintenanceData.machine_id, func.max(MaintenanceData.performed_at))
            .group_by(MaintenanceData.machine_id)
            .all()
        )
        if performed_at is not None
    }

    for machine in machines:
        latest_performed_at = latest_by_machine_id.get(machine.id)
        if latest_performed_at is not None:
            machine.last_maintenance_days_ago = _days_since(latest_performed_at)

    return machines
