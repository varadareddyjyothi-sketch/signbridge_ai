"""
SignBridge AI - Application Configuration
Loads environment variables and configuration settings.
"""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "SignBridge AI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # ML Model
    MODEL_DIR: str = os.path.join("ml", "models")
    MODEL_FILE: str = "signbridge_rf_model.joblib"
    METADATA_FILE: str = "model_metadata.json"
    CONFIDENCE_THRESHOLD: float = 0.65

    # Dataset
    DATASET_PATH: str = os.path.join("ml", "dataset", "isl_landmarks_dataset.csv")

    # Supabase (Optional - SQLite local fallback used when absent)
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""

    # Local SQLite Fallback DB Path
    SQLITE_DB_PATH: str = os.path.join("backend", "app", "database", "signbridge_local.db")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def model_path(self) -> str:
        return os.path.join(self.MODEL_DIR, self.MODEL_FILE)

    @property
    def metadata_path(self) -> str:
        return os.path.join(self.MODEL_DIR, self.METADATA_FILE)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
