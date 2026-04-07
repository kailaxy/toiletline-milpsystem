from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class OptimizeRequest(BaseModel):
    model_config = ConfigDict(validate_by_alias=True, validate_by_name=True)

    machine_data: list["MachineOptimizationInput | str"] | None = Field(
        default=None,
        validation_alias=AliasChoices("machine_data", "machineData"),
        serialization_alias="machineData",
    )
    constraints: "OptimizationConstraints | None" = None
    horizon_days: int = Field(default=7, ge=1, le=100)
    slots_per_day: int = Field(default=2, ge=1, le=24)
    maintenance_capacity_per_day: int = Field(default=2, ge=1, le=100)
    peak_day_indices: list[int] = Field(default_factory=list)
    avoid_peak_days: bool = True


class ScheduleItem(BaseModel):
    machine: str
    day: str
    time: str
    machine_id: int | None = None
    day_index: int | None = None
    hour_index: int | None = None
    slot_index: int | None = None
    slot_in_day: int | None = None
    slot_label: str | None = None
    start_datetime_label: str | None = None
    maintenance_duration_days: int | None = None
    maintenance_duration_hours: float | None = None
    maintenance_duration_minutes: float | None = None
    expected_downtime_hours: float | None = None
    estimated_cost_impact: float | None = None


class KPIResponse(BaseModel):
    predicted_downtime: float
    availability: float
    baseline_downtime_days: float | None = None
    optimized_downtime_days: float | None = None
    downtime_improvement_percent: float | None = None
    baseline_downtime_per_machine_days: dict[str, float] | None = None
    time_unit: str | None = None
    predicted_downtime_hours: float | None = None
    fleet_availability: float | None = None
    horizon_days: int | None = None
    horizon_hours: int | None = None
    slots_per_day: int | None = None
    horizon_slots: int | None = None


class OptimizeResponse(BaseModel):
    schedule: list[ScheduleItem]
    kpis: KPIResponse


class MachineOptimizationInput(BaseModel):
    model_config = ConfigDict(validate_by_alias=True, validate_by_name=True)

    machine_id: int | None = Field(
        default=None,
        validation_alias=AliasChoices("machine_id", "machineId", "id"),
    )
    machine: str | None = Field(
        default=None,
        validation_alias=AliasChoices("machine", "name", "machineName"),
    )
    mttf_hours: float | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("mttf_hours", "mttfHours"),
    )
    mttr_hours: float | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("mttr_hours", "mttrHours"),
    )
    downtime_cost_per_hour: float | None = Field(
        default=None,
        gt=0,
        validation_alias=AliasChoices("downtime_cost_per_hour", "downtimeCostPerHour"),
    )
    last_maintenance_days_ago: float | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("last_maintenance_days_ago", "lastMaintenanceDaysAgo"),
    )


class OptimizationConstraints(BaseModel):
    model_config = ConfigDict(validate_by_alias=True, validate_by_name=True)

    max_downtime: float | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("max_downtime", "maxDowntime"),
    )
    target_availability: float | None = Field(
        default=None,
        ge=0,
        le=100,
        validation_alias=AliasChoices("target_availability", "targetAvailability"),
    )
    maintenance_capacity_per_day: int | None = Field(
        default=None,
        ge=1,
        le=100,
        validation_alias=AliasChoices("maintenance_capacity_per_day", "maintenanceCapacityPerDay"),
    )
    peak_day_indices: list[int] | None = Field(
        default=None,
        validation_alias=AliasChoices("peak_day_indices", "peakDayIndices"),
    )
    avoid_peak_days: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("avoid_peak_days", "avoidPeakDays"),
    )
