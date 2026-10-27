"""
Health Check Endpoint
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.app.config import settings
from backend.app.schemas.health import HealthResponse
from backend.app.services.inference_service import inference_service
from backend.app.database.history_service import history_service
from backend.app.database.supabase_client import is_supabase_configured

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def check_health():
    """Returns application health, model availability status, and database connection mode."""
    status_info = inference_service.get_status_info()
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        model_status=status_info["status"],
        model_classes_count=status_info["classes_count"],
        storage_mode=history_service.get_current_storage_mode(),
        supabase_configured=is_supabase_configured(),
        timestamp=datetime.now(timezone.utc).isoformat()
    )
