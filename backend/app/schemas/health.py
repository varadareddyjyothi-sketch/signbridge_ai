"""
Pydantic schemas for Health & Dataset collection endpoints
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    environment: str
    model_status: str
    model_classes_count: int
    storage_mode: str
    mongodb_configured: bool = False
    mongodb_connected: bool = False
    timestamp: str


class DatasetSampleRequest(BaseModel):
    label: str
    features: List[float]
    handedness: str = "Right"
    session_id: Optional[str] = "web_collector"


class DatasetStatsResponse(BaseModel):
    dataset_exists: bool
    total_samples: int
    class_counts: Dict[str, int]
    classes: List[str]
    dataset_path: str
