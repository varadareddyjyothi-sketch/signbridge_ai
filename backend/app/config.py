"""
SignBridge AI - Application Configuration
Loads environment variables and configuration settings.
"""

import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SignBridge AI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("ENVIRONMENT", "development") != "production"

    # Server settings - default to 0.0.0.0 in production/cloud environments
    HOST: str = os.getenv("HOST", "0.0.0.0" if os.getenv("ENVIRONMENT") == "production" else "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost:8000"
    )

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
    JWT_SECRET: str = os.getenv("JWT_SECRET", "signbridge_ai_super_secret_jwt_key_2026_secured")
    JWT_ALGORITHM: str = "HS256"

    # Local SQLite Fallback DB Path
    SQLITE_DB_PATH: str = str(BASE_DIR / "backend" / "app" / "database" / "signbridge_local.db")

    # Static Assets Directory (Frontend Build)
    STATIC_DIR: str = str(BASE_DIR / "frontend" / "dist")

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_ORIGINS or self.ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        dev_ports = [
            "http://localhost:5173", "http://127.0.0.1:5173",
            "http://localhost:5174", "http://127.0.0.1:5174",
            "http://localhost:5175", "http://127.0.0.1:5175",
            "http://localhost:3000", "http://127.0.0.1:3000",
            "http://localhost:8000", "http://127.0.0.1:8000"
        ]
        for dp in dev_ports:
            if dp not in origins:
                origins.append(dp)
        return origins

    @property
    def allow_credentials(self) -> bool:
        # Per CORS spec, credentials cannot be enabled when allow_origins is wildcard "*"
        return "*" not in self.cors_origins

    @property
    def model_path(self) -> str:
        return os.path.join(self.MODEL_DIR, self.MODEL_FILE)

    @property
    def metadata_path(self) -> str:
        return os.path.join(self.MODEL_DIR, self.METADATA_FILE)


settings = Settings()
