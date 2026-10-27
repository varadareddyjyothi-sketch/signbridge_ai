"""
Dataset Collection and Stats Endpoints
Supports interactive web studio data collection.
"""

import os
import csv
import time
from fastapi import APIRouter, HTTPException, status
from backend.app.config import settings
from backend.app.schemas.dataset import DatasetSampleRequest, DatasetStatsResponse
from ml.features import FEATURE_DIMENSION
from ml.scripts.train_model import train

router = APIRouter(prefix="/dataset", tags=["Dataset"])


@router.get("/stats", response_model=DatasetStatsResponse)
async def get_dataset_stats():
    """Returns sample counts and classes in the dataset CSV."""
    path = settings.DATASET_PATH
    if not os.path.exists(path):
        return DatasetStatsResponse(
            dataset_exists=False,
            total_samples=0,
            class_counts={},
            classes=[],
            dataset_path=path
        )

    counts = {}
    total = 0
    with open(path, mode="r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lbl = row.get("label", "unknown")
            counts[lbl] = counts.get(lbl, 0) + 1
            total += 1

    return DatasetStatsResponse(
        dataset_exists=True,
        total_samples=total,
        class_counts=counts,
        classes=sorted(list(counts.keys())),
        dataset_path=path
    )


@router.post("/sample")
async def save_dataset_sample(sample: DatasetSampleRequest):
    """Appends a valid 63-dimensional normalized feature vector to the dataset CSV."""
    if len(sample.features) != FEATURE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Features array must contain exactly {FEATURE_DIMENSION} floats, got {len(sample.features)}"
        )

    path = settings.DATASET_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)

    file_exists = os.path.exists(path)
    header = ["label", "handedness", "timestamp", "session_id"] + [f"f_{i}" for i in range(FEATURE_DIMENSION)]

    with open(path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(header)

        now = time.time()
        row = [sample.label, sample.handedness, now, sample.session_id or "web_collector"] + sample.features
        writer.writerow(row)

    return {"success": True, "label": sample.label, "timestamp": now}


@router.post("/train")
async def trigger_retrain():
    """Executes the training pipeline and reloads the model."""
    try:
        metadata = train(
            dataset_path=settings.DATASET_PATH,
            output_model_path=settings.model_path,
            output_metadata_path=settings.metadata_path
        )
        from backend.app.services.inference_service import inference_service
        from backend.app.services.model_registry_service import model_registry_service
        
        reg_entry = model_registry_service.register_new_version(
            trained_model_path=settings.model_path,
            metadata_path=settings.metadata_path,
            test_accuracy=metadata.get("test_accuracy", 0.0),
            classes=metadata.get("classes", []),
            total_samples=metadata.get("total_samples", 0),
            note="Retrained via Dataset Studio"
        )
        inference_service.reload()
        return {
            "success": True,
            "message": "Model retrained, registered, and reloaded successfully",
            "version": reg_entry.get("version"),
            "test_accuracy": metadata.get("test_accuracy"),
            "classes": metadata.get("classes")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retraining failed: {str(e)}"
        )


@router.get("/export")
async def export_dataset():
    """Downloads the current dataset CSV file."""
    path = settings.DATASET_PATH
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Dataset file does not exist yet")
    from fastapi.responses import FileResponse
    return FileResponse(path, filename="isl_landmarks_dataset.csv", media_type="text/csv")


@router.get("/validate")
async def validate_dataset():
    """Validates the dataset structure, features dimension, class distribution, and balance."""
    path = settings.DATASET_PATH
    if not os.path.exists(path):
        return {
            "is_valid": False,
            "status": "missing_dataset",
            "message": "Dataset file not found",
            "total_samples": 0,
            "classes_count": 0,
            "class_counts": {},
            "recommendation": "Collect at least 20 samples across at least 2 classes in the Dataset Studio."
        }

    counts = {}
    total = 0
    corrupted_rows = 0

    with open(path, mode="r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            lbl = row.get("label", "unknown")
            counts[lbl] = counts.get(lbl, 0) + 1
            total += 1
            # Check feature values
            try:
                features = [float(row[f"f_{j}"]) for j in range(FEATURE_DIMENSION)]
                if len(features) != FEATURE_DIMENSION:
                    corrupted_rows += 1
            except (KeyError, ValueError):
                corrupted_rows += 1

    classes_count = len(counts)
    min_count = min(counts.values()) if counts else 0
    max_count = max(counts.values()) if counts else 0

    is_valid = total >= 20 and classes_count >= 2 and corrupted_rows == 0
    status_str = "valid" if is_valid else "insufficient_data"
    if corrupted_rows > 0:
        status_str = "corrupted"

    rec = "Dataset is balanced and ready for model training."
    if classes_count < 2:
        rec = "Dataset must have at least 2 distinct gesture classes to train a classifier."
    elif min_count < 15:
        rec = f"Some classes have fewer than 15 samples (min: {min_count}). Capture more samples for better generalization."

    return {
        "is_valid": is_valid,
        "status": status_str,
        "message": f"Dataset contains {total} samples across {classes_count} classes.",
        "total_samples": total,
        "classes_count": classes_count,
        "class_counts": counts,
        "min_samples_per_class": min_count,
        "max_samples_per_class": max_count,
        "corrupted_rows": corrupted_rows,
        "recommendation": rec
    }

