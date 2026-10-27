"""
SignBridge AI - Vocabulary Router
Endpoints for dynamic gesture catalog management, multilingual translations,
and training readiness inspection.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from backend.app.services.vocabulary_service import vocabulary_service
from backend.app.services.inference_service import inference_service

router = APIRouter(prefix="/vocabulary", tags=["Vocabulary"])


class GestureCreateRequest(BaseModel):
    id: str = Field(..., min_length=2, max_length=50, description="Unique uppercase gesture ID (e.g., 'ISL_NAMASTE')")
    name: str = Field(..., min_length=2, max_length=100, description="English display name")
    telugu: str = Field(..., min_length=2, max_length=100, description="Telugu script translation")
    telugu_romanized: str = Field(..., min_length=2, max_length=100, description="Romanized Telugu pronunciation")
    canonical_label: Optional[str] = Field(None, description="Canonical uppercase label")
    english_gloss: Optional[str] = Field(None, description="Upper-case sign gloss (e.g. 'NAMASTE')")
    sign_type: Optional[str] = Field("static", description="'static' | 'dynamic' | 'two_hand' | 'full_body'")
    gesture_type: str = Field("static", description="'static' | 'dynamic' | 'verified_isl'")
    required_modalities: Optional[List[str]] = Field(["hands"], description="['hands'], ['hands', 'pose']")
    verification_status: Optional[str] = Field("experimental", description="'verified_isl' | 'experimental'")
    category: Optional[str] = Field("custom_gesture", description="Classification category")
    description: Optional[str] = Field("", description="Visual hand shape and kinematic instructions")
    example_sentence_en: Optional[str] = Field("", description="Example English sentence")
    example_sentence_te: Optional[str] = Field("", description="Example Telugu sentence")
    example_sentence_ro: Optional[str] = Field("", description="Example Romanized Telugu sentence")


@router.get("")
async def list_vocabulary():
    """Returns all gesture vocabulary entries with sample counts and training readiness."""
    active_classes = []
    if inference_service.model and hasattr(inference_service.model, "classes_"):
        active_classes = [str(c) for c in inference_service.model.classes_]

    gestures = vocabulary_service.get_all_gestures(active_model_classes=active_classes)
    return {
        "total_gestures": len(gestures),
        "active_classes_count": len(active_classes),
        "gestures": gestures
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_gesture(request: GestureCreateRequest):
    """Adds a new gesture vocabulary entry. Note: Gesture requires training samples before recognition."""
    try:
        new_entry = vocabulary_service.add_gesture(request.model_dump())
        enriched = vocabulary_service.get_gesture_by_id(new_entry["id"]) or new_entry
        return {
            "success": True,
            "message": f"Gesture '{new_entry['id']}' registered successfully. Collect at least 15 samples to enable training.",
            "gesture": enriched
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{gesture_id}")
async def get_gesture(gesture_id: str):
    """Retrieves a single gesture definition by ID."""
    g = vocabulary_service.get_gesture_by_id(gesture_id)
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Gesture '{gesture_id}' not found.")
    return g


@router.delete("/{gesture_id}")
async def delete_gesture(gesture_id: str):
    """Deletes a custom gesture definition (core system classes are protected)."""
    try:
        vocabulary_service.delete_gesture(gesture_id)
        return {"success": True, "message": f"Gesture '{gesture_id}' deleted from vocabulary."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
