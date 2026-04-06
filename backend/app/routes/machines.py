from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.machine import MachineCreate, MachineRead, MachineUpdate
from app.services.machine_service import (
    create_machine,
    delete_machine,
    get_machine_by_id,
    get_machines,
    is_machine_name_conflict,
    update_machine,
)

router = APIRouter(tags=["machines"])


@router.post("/machines", response_model=MachineRead, status_code=201)
def create_machine_route(payload: MachineCreate, db: Session = Depends(get_db)) -> MachineRead:
    if is_machine_name_conflict(db, payload.name):
        raise HTTPException(status_code=409, detail="Machine name already exists")
    machine = create_machine(db, payload)
    return MachineRead.model_validate(machine)


@router.get("/machines", response_model=list[MachineRead])
def list_machines_route(db: Session = Depends(get_db)) -> list[MachineRead]:
    machines = get_machines(db)
    return [MachineRead.model_validate(machine) for machine in machines]


@router.get("/machines/{machine_id}", response_model=MachineRead)
def get_machine_route(machine_id: int, db: Session = Depends(get_db)) -> MachineRead:
    machine = get_machine_by_id(db, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Machine not found")

    return MachineRead.model_validate(machine)


@router.put("/machines/{machine_id}", response_model=MachineRead)
def update_machine_route(
    machine_id: int,
    payload: MachineUpdate,
    db: Session = Depends(get_db),
) -> MachineRead:
    machine = get_machine_by_id(db, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Machine not found")

    if is_machine_name_conflict(db, payload.name, exclude_machine_id=machine_id):
        raise HTTPException(status_code=409, detail="Machine name already exists")

    updated = update_machine(db, machine, payload)
    return MachineRead.model_validate(updated)


@router.delete("/machines/{machine_id}", status_code=204)
def delete_machine_route(machine_id: int, db: Session = Depends(get_db)) -> None:
    machine = get_machine_by_id(db, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Machine not found")

    delete_machine(db, machine)
