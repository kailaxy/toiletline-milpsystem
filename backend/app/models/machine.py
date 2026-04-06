from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    mttf_hours: Mapped[float] = mapped_column(Float, nullable=False)
    mttr_hours: Mapped[float] = mapped_column(Float, nullable=False)
    downtime_cost_per_hour: Mapped[float] = mapped_column(Float, nullable=False)
    last_maintenance_days_ago: Mapped[float] = mapped_column(Float, nullable=False, default=7.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    maintenance_records = relationship("MaintenanceData", back_populates="machine", cascade="all, delete")
