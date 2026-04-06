from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MachineBase(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    mttf_hours: float = Field(gt=0)
    mttr_hours: float = Field(gt=0)
    downtime_cost_per_hour: float = Field(gt=0)
    last_maintenance_days_ago: float = Field(ge=0)


class MachineCreate(MachineBase):
    pass


class MachineRead(MachineBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
