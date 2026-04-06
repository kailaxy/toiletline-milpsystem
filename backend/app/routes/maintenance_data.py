from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.maintenance_data import MaintenanceDataCreate, MaintenanceDataRead
from app.services.maintenance_service import create_maintenance_record, get_maintenance_records

router = APIRouter(tags=["maintenance-data"])


@router.post("/maintenance-data", response_model=MaintenanceDataRead, status_code=201)
def create_maintenance_data_route(
    payload: MaintenanceDataCreate, db: Session = Depends(get_db)
) -> MaintenanceDataRead:
    try:
        record = create_maintenance_record(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return MaintenanceDataRead(
        id=record.id,
        machine_id=record.machine_id,
        machine_name=record.machine.name,
        performed_at=record.performed_at,
        duration_hours=record.duration_hours,
        notes=record.notes,
    )


@router.get("/maintenance-data", response_model=list[MaintenanceDataRead])
def list_maintenance_data_route(db: Session = Depends(get_db)) -> list[MaintenanceDataRead]:
    rows = get_maintenance_records(db)
    return [
        MaintenanceDataRead(
            id=record.id,
            machine_id=record.machine_id,
            machine_name=machine_name,
            performed_at=record.performed_at,
            duration_hours=record.duration_hours,
            notes=record.notes,
        )
        for record, machine_name in rows
    ]
