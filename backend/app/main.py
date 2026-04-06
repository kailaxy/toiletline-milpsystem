from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.init_db import init_db, init_db_with_seed
from app.db.session import SessionLocal
from app.routes.health import router as health_router
from app.routes.machines import router as machines_router
from app.routes.maintenance_data import router as maintenance_router
from app.routes.optimize import router as optimize_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        init_db_with_seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(machines_router)
app.include_router(maintenance_router)
app.include_router(optimize_router)
