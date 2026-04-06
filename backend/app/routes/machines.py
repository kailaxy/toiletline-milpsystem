from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.machine import MachineCreate, MachineRead
from app.services.machine_service import create_machine, get_machines

router = APIRouter(tags=["machines"])


@router.post("/machines", response_model=MachineRead, status_code=201)
def create_machine_route(payload: MachineCreate, db: Session = Depends(get_db)) -> MachineRead:
    existing_names = {machine.name.lower() for machine in get_machines(db)}
    if payload.name.lower() in existing_names:
        raise HTTPException(status_code=409, detail="Machine name already exists")
    machine = create_machine(db, payload)
    return MachineRead.model_validate(machine)


@router.get("/machines", response_model=list[MachineRead])
def list_machines_route(db: Session = Depends(get_db)) -> list[MachineRead]:
    machines = get_machines(db)
    return [MachineRead.model_validate(machine) for machine in machines]
