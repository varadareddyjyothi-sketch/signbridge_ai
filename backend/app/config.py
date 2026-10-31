"""
SignBridge AI - Application Configuration
Loads environment variables and configuration settings.
"""

import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def _resolve_static_dir(base_dir: Path) -> str:
    """Finds the production frontend build directory across local dev, monorepos, and Docker."""
    candidates = [
        base_dir / "frontend" / "dist",
        base_dir / "dist",
        Path("/app/frontend/dist"),
        Path("/app/dist")
    ]
    for c in candidates:
        if (c / "index.html").is_file():
            return str(c)
    return str(base_dir / "frontend" / "dist")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SignBridge AI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("ENVIRONMENT", "development") != "production"

    # Server settings - default to 0.0.0.0 in production/cloud environments
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Configure the exact browser origins in production. Development loopback
    # origins are added only outside production.
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "")

    # ML Model & Dataset Paths (anchored to BASE_DIR)
    BASE_DIR: Path = BASE_DIR
    MODEL_DIR: str = str(BASE_DIR / "ml" / "models")
    MODEL_FILE: str = "signbridge_rf_model.joblib"
    METADATA_FILE: str = "model_metadata.json"
    CONFIDENCE_THRESHOLD: float = 0.40

    DATASET_PATH: str = str(BASE_DIR / "ml" / "dataset" / "isl_landmarks_dataset.csv")

    # MongoDB Configuration (Atlas or local connection string)
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "signbridge_ai")
    SESSION_COOKIE_NAME: str = "signbridge_session"
    SESSION_TTL_DAYS: int = 30

    # Local SQLite Fallback DB Path
    SQLITE_DB_PATH: str = str(BASE_DIR / "backend" / "app" / "database" / "signbridge_local.db")

    # Static Assets Directory (Frontend Build)
    STATIC_DIR: str = _resolve_static_dir(BASE_DIR)

    @property
    def cors_origins(self) -> List[str]:
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        if self.ENVIRONMENT.lower() != "production":
            dev_origins = [
                f"http://{host}:{port}"
                for host in ("localhost", "127.0.0.1")
                for port in (3000, 5173, 5174, 5175, 8000)
            ]
            origins.extend(origin for origin in dev_origins if origin not in origins)
        return origins

    @property
    def allow_credentials(self) -> bool:
        return True

    @property
    def model_path(self) -> str:
        return os.path.join(self.MODEL_DIR, self.MODEL_FILE)

    @property
    def metadata_path(self) -> str:
        return os.path.join(self.MODEL_DIR, self.METADATA_FILE)


settings = Settings()
