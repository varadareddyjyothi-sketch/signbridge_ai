"""
Pydantic schemas for Recognition History and Confirmed Sentence History
"""

from typing import List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class HistoryEntry(BaseModel):
    id: str
    user_id: Optional[str] = None
    predicted_label: str
    english_meaning: str
    confidence: Optional[float] = None
    recognition_mode: str = "static_isl"
    created_at: str
    storage_source: str = Field(..., description="'supabase' or 'local_sqlite'")


class HistoryCreateRequest(BaseModel):
    predicted_label: str
    english_meaning: str
    confidence: Optional[float] = None
    recognition_mode: str = "static_isl"
    user_id: Optional[str] = None


class HistoryResponse(BaseModel):
    items: List[HistoryEntry]
    total: int
    storage_mode: str = Field(..., description="'supabase' | 'local_sqlite'")
    cloud_connected: bool


# =========================================================================
# Confirmed Sentence History Schemas
# =========================================================================

class SentenceHistoryEntry(BaseModel):
    id: str
    user_id: Optional[str] = None
    original_signs: str
    confirmed_sentence: str
    english_output: Optional[str] = None
    telugu_output: Optional[str] = None
    romanized_output: Optional[str] = None
    selected_language: str = "en"
    recognition_mode: str = "custom_isl"
    created_at: str
    storage_source: Optional[str] = "local_sqlite"


class SentenceHistoryCreateRequest(BaseModel):
    original_signs: Union[List[str], str] = Field(..., description="Original recognized sign tokens")
    confirmed_sentence: str = Field(..., description="Confirmed sentence string")
    english_output: Optional[str] = None
    telugu_output: Optional[str] = None
    romanized_output: Optional[str] = None
    selected_language: str = Field(default="en", description="Output language ('en', 'te', 'ro')")
    recognition_mode: str = Field(default="custom_isl", description="'custom_isl' or 'pretrained'")
    user_id: Optional[str] = None

    @field_validator("original_signs", mode="before")
    @classmethod
    def serialize_original_signs(cls, v):
        if isinstance(v, list):
            return ", ".join(str(item) for item in v)
        return str(v)


class SentenceHistoryResponse(BaseModel):
    items: List[SentenceHistoryEntry]
    total: int
    storage_mode: str
    cloud_connected: bool
