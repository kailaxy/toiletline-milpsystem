from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.maintenance_data import (
    MaintenanceDataCreate,
    MaintenanceDataRead,
    MaintenanceDataUpdate,
)
from app.services.maintenance_service import (
    create_maintenance_record,
    delete_maintenance_record,
    get_maintenance_record,
    get_maintenance_records,
    update_maintenance_record,
)

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


@router.get("/maintenance-data/{record_id}", response_model=MaintenanceDataRead)
def get_maintenance_data_route(record_id: int, db: Session = Depends(get_db)) -> MaintenanceDataRead:
    record = get_maintenance_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    return MaintenanceDataRead(
        id=record.id,
        machine_id=record.machine_id,
        machine_name=record.machine.name,
        performed_at=record.performed_at,
        duration_hours=record.duration_hours,
        notes=record.notes,
    )


@router.put("/maintenance-data/{record_id}", response_model=MaintenanceDataRead)
def update_maintenance_data_route(
    record_id: int,
    payload: MaintenanceDataUpdate,
    db: Session = Depends(get_db),
) -> MaintenanceDataRead:
    record = get_maintenance_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    try:
        updated = update_maintenance_record(db, record, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return MaintenanceDataRead(
        id=updated.id,
        machine_id=updated.machine_id,
        machine_name=updated.machine.name,
        performed_at=updated.performed_at,
        duration_hours=updated.duration_hours,
        notes=updated.notes,
    )


@router.delete("/maintenance-data/{record_id}", status_code=204)
def delete_maintenance_data_route(record_id: int, db: Session = Depends(get_db)) -> None:
    record = get_maintenance_record(db, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    delete_maintenance_record(db, record)
