from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.models import machine, maintenance_data  # noqa: F401
from app.utils.seed import seed_demo_data


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def init_db_with_seed(db: Session) -> None:
    seed_demo_data(db)
