from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "MILP Preventive Maintenance API"
    app_version: str = "0.1.0"
    sqlite_db_path: str = "backend/milp_system.db"
    cors_origins: list[str] = ["*"]

    @property
    def sqlite_db_file_path(self) -> Path:
        configured_path = Path(self.sqlite_db_path).expanduser()
        if configured_path.is_absolute():
            return configured_path

        project_root = Path(__file__).resolve().parents[3]
        return (project_root / configured_path).resolve()


settings = Settings()
