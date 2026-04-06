from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.schemas.machine import MachineCreate


def create_machine(db: Session, payload: MachineCreate) -> Machine:
    machine = Machine(**payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


def get_machines(db: Session) -> list[Machine]:
    return db.query(Machine).order_by(Machine.id.asc()).all()
