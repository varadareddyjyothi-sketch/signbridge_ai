"""
Pydantic schemas for Dataset collection endpoints
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


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
