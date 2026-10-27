"""
Prediction and Model Status Endpoints
Supports both single-hand and dual-hand predictions.
"""

from fastapi import APIRouter, HTTPException, status
from backend.app.schemas.predict import (
    PredictionRequest,
    TwoHandPredictionRequest,
    PredictionResponse,
    ModelStatusResponse
)
from backend.app.services.inference_service import inference_service

router = APIRouter(tags=["Inference"])


@router.get("/model/status", response_model=ModelStatusResponse)
async def get_model_status():
    """Returns current machine learning model status and metadata."""
    info = inference_service.get_status_info()
    return ModelStatusResponse(**info)


@router.post("/predict", response_model=PredictionResponse)
async def predict_gesture(request: PredictionRequest):
    """
    Validates input landmarks (single or dual hand) or pre-extracted features,
    applies normalization or dual-hand geometry, and returns predicted ISL sign label with confidence score.
    """
    two_hand_dict = None
    if request.two_hand_landmarks:
        two_hand_dict = {
            "left": request.two_hand_landmarks.left,
            "right": request.two_hand_landmarks.right
        }

    result = inference_service.predict(
        landmarks=request.landmarks,
        features=request.features,
        handedness=request.handedness,
        custom_threshold=request.confidence_threshold,
        two_hand_landmarks=two_hand_dict,
        hands_count=request.hands_count or 1
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.get("english_meaning", "Inference error")
        )

    return PredictionResponse(**result)


@router.post("/predict/two-hand", response_model=PredictionResponse)
async def predict_two_hand_gesture(request: TwoHandPredictionRequest):
    """
    Evaluates dual-hand landmarks directly and classifies verified two-hand ISL signs.
    """
    result = inference_service.predict_two_hand(
        left_landmarks=request.left_landmarks,
        right_landmarks=request.right_landmarks,
        custom_threshold=request.confidence_threshold
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.get("english_meaning", "Two-hand inference error")
        )

    return PredictionResponse(**result)


@router.post("/model/reload", tags=["Inference"])
async def reload_model():
    """Triggers reloading of model artifacts from disk."""
    inference_service.reload()
    return {"message": "Model reloaded", "status": inference_service.status}
