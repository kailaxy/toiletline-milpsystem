from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MaintenanceDataCreate(BaseModel):
    machine_id: int = Field(gt=0)
    performed_at: datetime
    duration_hours: float = Field(gt=0)
    notes: str = Field(default="", max_length=255)


class MaintenanceDataUpdate(BaseModel):
    machine_id: int = Field(gt=0)
    performed_at: datetime
    duration_hours: float = Field(gt=0)
    notes: str = Field(default="", max_length=255)


class MaintenanceDataRead(MaintenanceDataCreate):
    id: int
    machine_name: str

    model_config = ConfigDict(from_attributes=True)
