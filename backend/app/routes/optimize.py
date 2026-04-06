from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.optimize import OptimizeRequest, OptimizeResponse
from app.services.optimization_service import optimize_schedule

router = APIRouter(tags=["optimization"])


@router.post("/optimize", response_model=OptimizeResponse)
def optimize_route(payload: OptimizeRequest, db: Session = Depends(get_db)) -> OptimizeResponse:
    try:
        return optimize_schedule(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
