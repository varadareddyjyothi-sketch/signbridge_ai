"""
SignBridge AI - Models Registry & Versioning Router
Endpoints for viewing trained model versions and executing rollbacks.
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from backend.app.services.model_registry_service import model_registry_service
from backend.app.services.inference_service import inference_service

router = APIRouter(tags=["Model Registry"])


class ActivateVersionRequest(BaseModel):
    version: str = Field(..., description="Target version to activate (e.g., 'v1.0.0')")


@router.get("/models/status")
@router.get("/model/status", include_in_schema=False)
@router.get("/api/models/status", include_in_schema=False)
@router.get("/api/model/status", include_in_schema=False)
async def get_model_status():
    """Returns current machine learning model status, active version, and metadata."""
    info = inference_service.get_status_info()
    return info


@router.get("/models/metrics")
@router.get("/model/metrics", include_in_schema=False)
@router.get("/api/models/metrics", include_in_schema=False)
@router.get("/api/model/metrics", include_in_schema=False)
async def get_model_metrics():
    """
    Returns comprehensive evaluation metrics: overall accuracy, macro F1,
    per-class precision/recall, 66x66 confusion matrix, latency, FPS,
    and priority gesture disambiguation study (POINTING_UP vs ONE vs NO).
    """
    import os
    import json
    metrics_file = os.path.join("ml", "models", "gesture_metrics.json")
    if not os.path.exists(metrics_file):
        from ml.scripts.generate_metrics import generate
        return generate()

    with open(metrics_file, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("/models/train")
@router.post("/model/train", include_in_schema=False)
@router.post("/api/models/train", include_in_schema=False)
@router.post("/api/model/train", include_in_schema=False)
async def train_model():
    """Executes the complete training pipeline, regenerates evaluation metrics, and reloads model."""
    from backend.app.config import settings
    from ml.scripts.train_model import train
    from ml.scripts.generate_metrics import generate
    try:
        metadata = train(
            dataset_path=settings.DATASET_PATH,
            output_model_path=settings.model_path,
            output_metadata_path=settings.metadata_path
        )
        metrics = generate()
        reg_entry = model_registry_service.register_new_version(
            trained_model_path=settings.model_path,
            metadata_path=settings.metadata_path,
            test_accuracy=metadata.get("test_accuracy", 0.0),
            classes=metadata.get("classes", []),
            total_samples=metadata.get("total_samples", 0),
            note="Retrained via Model Management API"
        )
        inference_service.reload()
        return {
            "success": True,
            "message": "Model trained, evaluated, registered, and reloaded successfully.",
            "version": reg_entry.get("version"),
            "test_accuracy": metadata.get("test_accuracy"),
            "classes_count": len(metadata.get("classes", [])),
            "macro_f1": metrics.get("macro_f1")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model training failed: {str(e)}"
        )


@router.get("/models/versions")
@router.get("/model/versions", include_in_schema=False)
@router.get("/api/models/versions", include_in_schema=False)
@router.get("/api/model/versions", include_in_schema=False)
async def list_model_versions():
    """Returns all registered model checkpoints with evaluation metrics."""
    versions = model_registry_service.list_versions()
    active_version = next((v["version"] for v in versions if v.get("is_active")), "v1.0.0")
    return {
        "total_versions": len(versions),
        "active_version": active_version,
        "versions": versions
    }


@router.post("/models/activate")
@router.post("/model/activate", include_in_schema=False)
@router.post("/api/models/activate", include_in_schema=False)
@router.post("/api/model/activate", include_in_schema=False)
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
