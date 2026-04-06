from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.maintenance_data import MaintenanceData
from app.schemas.maintenance_data import MaintenanceDataCreate


def create_maintenance_record(db: Session, payload: MaintenanceDataCreate) -> MaintenanceData:
    machine = db.query(Machine).filter(Machine.id == payload.machine_id).first()
    if machine is None:
        raise ValueError("Machine not found")

    record = MaintenanceData(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_maintenance_records(db: Session) -> list[tuple[MaintenanceData, str]]:
    rows = (
        db.query(MaintenanceData, Machine.name)
        .join(Machine, MaintenanceData.machine_id == Machine.id)
        .order_by(MaintenanceData.performed_at.desc())
        .all()
    )
    return rows
