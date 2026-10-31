"""
Pydantic schemas for Prediction and Model Status
Supports both single-hand and dual-hand predictions.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class LandmarkPoint(BaseModel):
    x: float = Field(..., description="Normalized x coordinate (0.0 to 1.0 or pixel space)")
    y: float = Field(..., description="Normalized y coordinate")
    z: Optional[float] = Field(0.0, description="Normalized depth/z coordinate")


class TwoHandLandmarks(BaseModel):
    left: Optional[List[LandmarkPoint]] = Field(None, description="21 landmarks for Left hand")
    right: Optional[List[LandmarkPoint]] = Field(None, description="21 landmarks for Right hand")


class PredictionRequest(BaseModel):
    landmarks: Optional[List[LandmarkPoint]] = Field(
        None,
        description="List of 21 MediaPipe hand landmark points (single hand)"
    )
    features: Optional[List[float]] = Field(
        None,
        description="Pre-extracted 63-dimensional normalized feature vector"
    )
    handedness: Optional[str] = Field("Right", description="Handedness: 'Left', 'Right', or 'Both'")
    hands_count: Optional[int] = Field(1, description="Number of hands detected (0, 1, or 2)")
    two_hand_landmarks: Optional[TwoHandLandmarks] = Field(
        None,
        description="Landmarks for Left and Right hands when 2 hands are present"
    )
    two_hand_features: Optional[List[float]] = Field(
        None,
        description="Pre-extracted dual-hand feature vector"
    )
    confidence_threshold: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Custom confidence rejection threshold (defaults to server config: 0.65)"
    )


class TwoHandPredictionRequest(BaseModel):
    left_landmarks: List[LandmarkPoint] = Field(..., description="21 landmarks for Left hand")
    right_landmarks: List[LandmarkPoint] = Field(..., description="21 landmarks for Right hand")
    confidence_threshold: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Custom confidence rejection threshold"
    )


class TemporalFrame(BaseModel):
    landmarks: List[LandmarkPoint] = Field(..., description="21 landmarks for this frame")
    timestamp: Optional[float] = Field(None, description="Timestamp in seconds or ms")
    handedness: Optional[str] = Field("Right", description="'Left' or 'Right'")


class SequencePredictionRequest(BaseModel):
    frames: List[TemporalFrame] = Field(..., description="Sequence of landmark frames across time")
    handedness: Optional[str] = Field("Right", description="'Left' or 'Right'")
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    mode: Optional[str] = Field("general", description="'general' | 'numerical' | 'isl'")


class PredictionResponse(BaseModel):
    detected: bool = Field(..., description="Whether a hand was present and valid")
    label: Optional[str] = Field(None, description="Predicted sign class label (e.g., 'ISL_1' or 'ISL_NAMASTE_2HAND')")
    english_meaning: Optional[str] = Field(None, description="Human-readable translation or description")
    telugu: Optional[str] = Field(None, description="Telugu script translation")
    telugu_romanized: Optional[str] = Field(None, description="Romanized Telugu translation")
    hindi: Optional[str] = Field(None, description="Hindi script translation")
    confidence: Optional[float] = Field(None, description="Predicted probability/confidence score (0.0 - 1.0)")
    status: str = Field(
        ...,
        description="'accepted' | 'uncertain_rejected' | 'no_hand' | 'model_unavailable' | 'error'"
    )
    state: Optional[str] = Field(
        None,
        description="'waiting_hand' | 'hand_detected' | 'analyzing_gesture' | 'recognizing_movement' | 'gesture_recognized' | 'low_confidence' | 'unknown_gesture'"
    )
    is_verified_isl: bool = Field(False, description="Whether this label is verified in ISL vocabulary")
    gesture_type: Optional[str] = Field("static", description="'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture'")
    hands_detected: int = Field(1, description="Number of hands detected for this sign (1 or 2)")
    model_version: Optional[str] = Field("v1.0.0", description="Active model version")
    motion: Optional[Dict[str, Any]] = Field(None, description="Dynamic trajectory and motion analysis")
    anatomy: Optional[Dict[str, Any]] = Field(None, description="Biomechanical hand anatomy and orientation")
    disambiguation_note: Optional[str] = Field(None, description="Reasoning applied to disambiguate visually similar gestures")
    all_probabilities: Optional[Dict[str, float]] = Field(
        None,
        description="Class probability breakdown from the classifier"
    )
    rejection_threshold_used: float = Field(..., description="The rejection threshold applied to this prediction")
    timestamp: str = Field(..., description="UTC ISO timestamp of the prediction")


class ModelStatusResponse(BaseModel):
    status: str = Field(..., description="'unavailable' | 'experimental' | 'trained' | 'evaluated'")
    model_name: Optional[str] = None
    active_version: Optional[str] = "v1.0.0"
    classes: List[str] = []
    classes_count: int = 0
    feature_dimension: int = 63
    confidence_rejection_threshold: float = 0.65
    test_accuracy: Optional[float] = None
    total_samples: Optional[int] = None
    training_timestamp: Optional[str] = None
    known_limitations: List[str] = []
    retrain_command: Optional[str] = None
