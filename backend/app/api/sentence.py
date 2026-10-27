"""
SignBridge AI - Sentence Translation Router
Translates sequential gesture streams into fluent English and Telugu sentences.
"""

from typing import List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from backend.app.services.sentence_service import sentence_translation_service

router = APIRouter(prefix="/translate", tags=["Translation"])


class SentenceTranslationRequest(BaseModel):
    tokens: List[str] = Field(..., description="List of recognized gesture IDs in temporal order")


class SentenceTranslationResponse(BaseModel):
    tokens: List[str]
    english: str
    telugu: str
    telugu_romanized: str
    is_idiomatic_match: bool


@router.post("/sentence", response_model=SentenceTranslationResponse)
async def translate_sentence(request: SentenceTranslationRequest):
    """
    Translates a sequence of recognized signs into natural English, Telugu script,
    and Romanized Telugu sentences.
    """
    clean = [t.strip() for t in request.tokens if t and t.strip()]
    if not clean:
        raise HTTPException(status_code=400, detail="Tokens list cannot be empty")

    result = sentence_translation_service.translate_signs_sequence(clean)
    return SentenceTranslationResponse(**result)
