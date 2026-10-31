"""
Health Check Endpoint
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Response
from backend.app.config import settings
from backend.app.schemas.health import HealthResponse
from backend.app.services.inference_service import inference_service
from backend.app.database.mongo_client import is_mongo_configured, is_mongo_connected

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def check_health(response: Response):
    """Returns application health, model availability status, and database connection mode."""
    status_info = inference_service.get_status_info()
    mongo_cfg = is_mongo_configured()
    mongo_conn = is_mongo_connected()
    production_database_unavailable = settings.ENVIRONMENT.lower() == "production" and not mongo_conn
    if production_database_unavailable:
        response.status_code = 503

    return HealthResponse(
        status="unhealthy" if production_database_unavailable else "healthy",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        model_status=status_info["status"],
        model_classes_count=status_info["classes_count"],
        storage_mode="unavailable" if production_database_unavailable else (
            "mongodb" if mongo_conn else "local_sqlite"
        ),
        mongodb_configured=mongo_cfg,
        mongodb_connected=mongo_conn,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
