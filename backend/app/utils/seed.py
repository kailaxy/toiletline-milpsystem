from sqlalchemy.orm import Session

from app.models.machine import Machine


DEFAULT_MACHINES = [
    {
        "name": "Rewinder",
        "mttf_hours": 900,
        "mttr_hours": 6,
        "downtime_cost_per_hour": 720,
        "last_maintenance_days_ago": 14,
    },
    {
        "name": "Accumulator",
        "mttf_hours": 1100,
        "mttr_hours": 5,
        "downtime_cost_per_hour": 580,
        "last_maintenance_days_ago": 10,
    },
    {
        "name": "Distributor",
        "mttf_hours": 760,
        "mttr_hours": 4.5,
        "downtime_cost_per_hour": 460,
        "last_maintenance_days_ago": 16,
    },
    {
        "name": "Log Saw",
        "mttf_hours": 680,
        "mttr_hours": 8,
        "downtime_cost_per_hour": 810,
        "last_maintenance_days_ago": 18,
    },
    {
        "name": "Log Saw 2",
        "mttf_hours": 700,
        "mttr_hours": 7,
        "downtime_cost_per_hour": 790,
        "last_maintenance_days_ago": 12,
    },
    {
        "name": "Packaging",
        "mttf_hours": 1300,
        "mttr_hours": 3,
        "downtime_cost_per_hour": 390,
        "last_maintenance_days_ago": 8,
    },
]


def seed_demo_data(db: Session) -> None:
    if db.query(Machine).count() > 0:
        return

    for payload in DEFAULT_MACHINES:
        machine = Machine(**payload)
        db.add(machine)

    db.commit()
