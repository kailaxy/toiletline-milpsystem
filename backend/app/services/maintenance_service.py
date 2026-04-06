from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.maintenance_data import MaintenanceData
from app.schemas.maintenance_data import MaintenanceDataCreate, MaintenanceDataUpdate
from app.services.machine_service import _days_since


def recalculate_machine_last_maintenance(db: Session, machine_id: int) -> None:
    machine = db.query(Machine).filter(Machine.id == machine_id).first()
    if machine is None:
        return

    latest_performed_at = (
        db.query(func.max(MaintenanceData.performed_at))
        .filter(MaintenanceData.machine_id == machine_id)
        .scalar()
    )

    if latest_performed_at is None:
        # Preserve the existing value when no maintenance history remains.
        if machine.last_maintenance_days_ago is None:
            machine.last_maintenance_days_ago = 0.0
        return

    machine.last_maintenance_days_ago = _days_since(latest_performed_at)


def create_maintenance_record(db: Session, payload: MaintenanceDataCreate) -> MaintenanceData:
    machine = db.query(Machine).filter(Machine.id == payload.machine_id).first()
    if machine is None:
        raise ValueError("Machine not found")

    record = MaintenanceData(**payload.model_dump())
    db.add(record)
    db.flush()
    recalculate_machine_last_maintenance(db, payload.machine_id)
    db.commit()
    db.refresh(record)
    return record


def get_maintenance_record(db: Session, record_id: int) -> MaintenanceData | None:
    return db.query(MaintenanceData).filter(MaintenanceData.id == record_id).first()


def update_maintenance_record(
    db: Session,
    record: MaintenanceData,
    payload: MaintenanceDataUpdate,
) -> MaintenanceData:
    previous_machine_id = record.machine_id

    target_machine = db.query(Machine).filter(Machine.id == payload.machine_id).first()
    if target_machine is None:
        raise ValueError("Machine not found")

    for field, value in payload.model_dump().items():
        setattr(record, field, value)

    db.flush()
    recalculate_machine_last_maintenance(db, payload.machine_id)
    if previous_machine_id != payload.machine_id:
        recalculate_machine_last_maintenance(db, previous_machine_id)

    db.commit()
    db.refresh(record)
    return record


def delete_maintenance_record(db: Session, record: MaintenanceData) -> None:
    machine_id = record.machine_id
    db.delete(record)
    db.flush()
    recalculate_machine_last_maintenance(db, machine_id)
    db.commit()


def get_maintenance_records(db: Session) -> list[tuple[MaintenanceData, str]]:
    rows = (
        db.query(MaintenanceData, Machine.name)
        .join(Machine, MaintenanceData.machine_id == Machine.id)
        .order_by(MaintenanceData.performed_at.desc())
        .all()
    )
    return rows
