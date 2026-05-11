from fastapi import Header, HTTPException

from app.core.config import settings


def verify_action_pin(x_action_pin: str | None = Header(default=None)) -> bool:
    """
    Dependency to validate the action PIN from request headers.
    
    Raises:
        HTTPException: 401 Unauthorized if PIN doesn't match SYSTEM_PIN
    
    Returns:
        True if PIN is valid (used just for dependency injection marker)
    """
    if not x_action_pin or x_action_pin != settings.system_pin:
        raise HTTPException(status_code=401, detail="Invalid or missing PIN")
    return True
