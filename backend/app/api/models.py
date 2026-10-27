"""
SignBridge AI - Models Registry & Versioning Router
Endpoints for viewing trained model versions and executing rollbacks.
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from backend.app.services.model_registry_service import model_registry_service
from backend.app.services.inference_service import inference_service

router = APIRouter(prefix="/models", tags=["Model Registry"])


class ActivateVersionRequest(BaseModel):
    version: str = Field(..., description="Target version to activate (e.g., 'v1.0.0')")


@router.get("/versions")
async def list_model_versions():
    """Returns all registered model checkpoints with evaluation metrics."""
    versions = model_registry_service.list_versions()
    active_version = next((v["version"] for v in versions if v.get("is_active")), "v1.0.0")
    return {
        "total_versions": len(versions),
        "active_version": active_version,
        "versions": versions
    }


@router.post("/activate")
async def activate_model_version(request: ActivateVersionRequest):
    """Rolls back or switches the active model to a previous version."""
    try:
        result = model_registry_service.activate_version(request.version)
        # Reload inference service to load newly deployed checkpoint
        inference_service.reload()
        return {
            "success": True,
            "message": f"Successfully activated model version '{request.version}'.",
            "activated_version": request.version,
            "classes_count": result.get("classes_count", 0),
            "test_accuracy": result.get("test_accuracy")
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Rollback failed: {str(e)}")
