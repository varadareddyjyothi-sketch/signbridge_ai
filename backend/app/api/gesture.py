"""
SignBridge AI - Advanced Hand Gesture Engine Router
Implements the complete real-time gesture recognition API architecture:
- POST /api/gesture/predict: Single-frame landmark anatomy & static classification
- POST /api/gesture/sequence: Multi-frame temporal sequence & dynamic motion classification
- GET /api/gesture/classes: Comprehensive vocabulary metadata, priority gestures & tags
- GET /api/gesture/history: Gesture recognition logs & history trail
"""

import os
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Query, Request
from backend.app.schemas.predict import (
    PredictionRequest,
    SequencePredictionRequest,
    PredictionResponse,
    ModelStatusResponse
)
from backend.app.services.inference_service import inference_service
from backend.app.database.history_service import history_service
from backend.app.services.vocabulary_service import vocabulary_service

router = APIRouter(prefix="/api/gesture", tags=["Gesture Recognition"])


@router.post("/predict", response_model=PredictionResponse)
async def predict_single_gesture(request: PredictionRequest):
    """
    Analyzes single-frame 21 hand landmarks, extracts normalized biomechanical features
    (finger flexion, extension, joint angles, palm orientation), and outputs gesture prediction.
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


@router.post("/sequence", response_model=PredictionResponse)
async def predict_gesture_sequence(request: SequencePredictionRequest):
    """
    Evaluates a temporal sequence of landmark frames.
    Tracks velocity, acceleration, trajectory, and oscillation count (direction reversals)
    to accurately recognize dynamic gestures (e.g., NO horizontal shake, HELLO wave, STOP push)
    and disambiguate from static postures (POINTING_UP vs ONE vs NO).
    """
    result = inference_service.predict_sequence(
        frames=request.frames,
        handedness=request.handedness,
        custom_threshold=request.confidence_threshold,
        mode=request.mode
    )

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.get("english_meaning", "Sequence inference error")
        )

    return PredictionResponse(**result)


@router.get("/classes")
async def get_gesture_classes(category: Optional[str] = None):
    """
    Returns full vocabulary of supported gestures, including priority gestures,
    static vs dynamic metadata, biomechanical descriptions, and multilingual translations.
    """
    vocab = vocabulary_service.get_all_gestures()

    priority_ids = {
        "Pointing_Up", "ISL_1", "ISL_NO", "Open_Palm", "Closed_Fist",
        "Thumb_Up", "Thumb_Down", "ISL_PEACE_VICTORY", "ISL_OK",
        "ISL_STOP", "ISL_HELLO", "ISL_THANK_YOU"
    }

    dynamic_ids = {"ISL_NO", "ISL_HELLO", "ISL_STOP", "ISL_THANK_YOU"}

    enriched = []
    for item in vocab:
        item_id = item.get("id") or item.get("canonical_label")
        is_priority = item_id in priority_ids or any(p.lower() in item_id.lower() for p in ["point", "thumb", "fist", "palm", "peace", "stop", "hello", "thank"])
        is_dynamic = item_id in dynamic_ids or item.get("gesture_type") == "dynamic"

        enriched.append({
            **item,
            "is_priority": is_priority,
            "is_dynamic": is_dynamic,
            "gesture_type": "dynamic" if is_dynamic else item.get("gesture_type", "static")
        })

    if category:
        enriched = [e for e in enriched if e.get("category", "").lower() == category.lower()]

    return {
        "total_classes": len(enriched),
        "priority_classes_count": sum(1 for e in enriched if e.get("is_priority")),
        "classes": enriched
    }


@router.get("/history")
async def get_gesture_history(
    user_id: Optional[str] = Query(None, description="Optional user filter"),
    limit: int = Query(50, ge=1, le=200)
):
    """Retrieves chronological gesture recognition history for audit and verification."""
    result = history_service.get_history(user_id=user_id, limit=limit)
    return result
