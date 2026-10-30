"""
SignBridge AI - Sentence Translation & Quick Phrase Router
Supports:
Mode 1: Live Sign Recognition sequence translation with grammar intent & punctuation
Mode 2: Searchable Quick Phrase Assistance across 8 categories
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query
from backend.app.services.sentence_service import sentence_translation_service
from backend.app.services.phrase_library_service import phrase_library_service

router = APIRouter(prefix="/translate", tags=["Translation"])


# =========================================================================
# Mode 1: Live Sign Recognition Sentence Translation
# =========================================================================

class MeaningBreakdownItem(BaseModel):
    token: str
    supported: bool
    gloss: str
    role: str
    english: str
    telugu: str
    telugu_romanized: str


class DisambiguationOption(BaseModel):
    label: str
    english: str
    telugu: str
    telugu_romanized: str


class SentenceTranslationRequest(BaseModel):
    tokens: List[str] = Field(..., description="List of recognized gesture IDs in temporal order")


class SentenceTranslationResponse(BaseModel):
    tokens: List[str]
    english: str
    telugu: str
    telugu_romanized: str
    sentence_intent: str = "statement"
    punctuation: str = "."
    is_idiomatic_match: bool
    meaning_breakdown: List[MeaningBreakdownItem] = []
    source_mode: str = "camera_recognition"
    disambiguation_options: List[DisambiguationOption] = []


@router.post("/sentence", response_model=SentenceTranslationResponse)
async def translate_sentence(request: SentenceTranslationRequest):
    """
    Translates a sequence of recognized signs into natural English, Telugu script,
    and Romanized Telugu sentences using grammar intent and punctuation rules.
    """
    clean = [t.strip() for t in request.tokens if t and t.strip()]
    if not clean:
        raise HTTPException(status_code=400, detail="Tokens list cannot be empty")

    result = sentence_translation_service.translate_signs_sequence(clean)
    return SentenceTranslationResponse(**result)


# =========================================================================
# Mode 2: Quick Phrase Assistance Library (8 Categories A-H)
# =========================================================================

class QuickPhraseCategory(BaseModel):
    id: str
    name: str
    icon: str
    count: int


class QuickPhraseItem(BaseModel):
    id: str
    category: str
    english: str
    telugu: str
    telugu_romanized: str
    is_emergency: bool = False
    verified: bool = True
    notes: Optional[str] = None
    source_mode: str = "quick_phrase"


class QuickPhraseListResponse(BaseModel):
    categories: List[QuickPhraseCategory]
    phrases: List[QuickPhraseItem]
    total: int


@router.get("/categories", response_model=List[QuickPhraseCategory])
async def get_phrase_categories():
    """Returns the 8 standard communication categories for quick phrase selection."""
    return phrase_library_service.get_categories()


@router.get("/phrases", response_model=QuickPhraseListResponse)
async def get_quick_phrases(
    category: Optional[str] = Query(None, description="Optional category filter (e.g. 'greetings', 'health_emergency')"),
    search: Optional[str] = Query(None, description="Optional search term across English and Telugu")
):
    """
    Retrieves reviewed quick assistance phrases for everyday communication,
    directions, needs, work, and emergency situations.
    """
    categories = phrase_library_service.get_categories()
    phrases = phrase_library_service.get_all_phrases(category=category, search_query=search)
    return QuickPhraseListResponse(
        categories=[QuickPhraseCategory(**c) for c in categories],
        phrases=[QuickPhraseItem(**p) for p in phrases],
        total=len(phrases)
    )


# =========================================================================
# Mode 3: Multilingual Speech & Text Translation / Transliteration
# =========================================================================

class TextTranslationRequest(BaseModel):
    text: str = Field(..., description="Input spoken or typed text")
    source_lang: str = Field("en", description="Source language code ('en', 'te', 'hi')")
    target_lang: str = Field("te", description="Target language code ('en', 'te', 'te-ro', 'hi')")


class TextTranslationResponse(BaseModel):
    original_text: str
    source_lang: str
    target_lang: str
    translated_text: str
    romanized_text: Optional[str] = ""
    english_text: Optional[str] = ""
    telugu_text: Optional[str] = ""
    hindi_text: Optional[str] = ""
    confidence: float
    method: str


class TransliterationRequest(BaseModel):
    text: str = Field(..., description="Native script text")
    script: str = Field("telugu", description="Source script name ('telugu')")


class TransliterationResponse(BaseModel):
    original_text: str
    script: str
    romanized_text: str


@router.post("/text", response_model=TextTranslationResponse)
async def translate_text_endpoint(request: TextTranslationRequest):
    """
    Translates recognized speech or typed text between English, Telugu, and Hindi,
    providing Romanized Telugu transliteration and preserving the original sentence.
    """
    from backend.app.services.multilingual_nlp_service import multilingual_nlp_service
    res = multilingual_nlp_service.translate(
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang
    )
    return TextTranslationResponse(**res)


@router.post("/transliterate", response_model=TransliterationResponse)
async def transliterate_endpoint(request: TransliterationRequest):
    """
    Deterministically transliterates Telugu script Unicode into natural phonetic Romanized Telugu.
    """
    from backend.app.services.multilingual_nlp_service import multilingual_nlp_service
    res = multilingual_nlp_service.transliterate_text(text=request.text, script=request.script)
    return TransliterationResponse(
        original_text=request.text,
        script=request.script,
        romanized_text=res
    )

