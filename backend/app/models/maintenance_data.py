from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MaintenanceData(Base):
    __tablename__ = "maintenance_data"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), nullable=False, index=True)
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    duration_hours: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    machine = relationship("Machine", back_populates="maintenance_records")
