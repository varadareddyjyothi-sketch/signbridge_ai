"""
Recognition History & Confirmed Sentence Endpoints
Includes genuine Excel (.xlsx) export with formula sanitization.
"""

from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Query, Header, HTTPException, Depends
from fastapi.responses import StreamingResponse
from backend.app.schemas.history import (
    HistoryResponse,
    HistoryCreateRequest,
    HistoryEntry,
    SentenceHistoryResponse,
    SentenceHistoryCreateRequest,
    SentenceHistoryEntry
)
from backend.app.database.history_service import history_service
from backend.app.database.local_storage import get_user_by_id, get_user_by_token
from backend.app.services.excel_export_service import excel_export_service
from backend.app.api.auth import get_current_user_optional

router = APIRouter(prefix="/history", tags=["History & Export"])


# =========================================================================
# 1. Individual Frame Recognition History
# =========================================================================

@router.get("", response_model=HistoryResponse)
async def get_history(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    limit: int = Query(50, ge=1, le=200, description="Max records to retrieve"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Retrieves sign recognition history."""
    effective_user_id = user_id or (current_user["id"] if current_user else None)
    items = history_service.get_history(user_id=effective_user_id, limit=limit)
    return HistoryResponse(
        items=[HistoryEntry(**item) for item in items],
        total=len(items),
        storage_mode=history_service.get_current_storage_mode(),
        cloud_connected=history_service.is_cloud_connected()
    )


@router.post("", response_model=HistoryEntry)
async def save_history(
    entry: HistoryCreateRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Saves a genuine recognition prediction result."""
    effective_user_id = entry.user_id or (current_user["id"] if current_user else None)
    result = history_service.add_entry(
        predicted_label=entry.predicted_label,
        english_meaning=entry.english_meaning,
        confidence=entry.confidence,
        recognition_mode=entry.recognition_mode,
        user_id=effective_user_id
    )
    return HistoryEntry(**result)


@router.delete("")
async def clear_history(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Clears permitted recognition history records."""
    effective_user_id = user_id or (current_user["id"] if current_user else None)
    deleted_count = history_service.clear_history(user_id=effective_user_id)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "storage_mode": history_service.get_current_storage_mode()
    }


# =========================================================================
# 2. Confirmed Sentence History
# =========================================================================

@router.get("/sentence", response_model=SentenceHistoryResponse)
async def get_sentence_history(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    limit: int = Query(100, ge=1, le=500, description="Max records to retrieve"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Retrieves confirmed human-approved sentences."""
    effective_user_id = user_id or (current_user["id"] if current_user else None)
    items = history_service.get_sentence_history(user_id=effective_user_id, limit=limit)
    return SentenceHistoryResponse(
        items=[SentenceHistoryEntry(**item) for item in items],
        total=len(items),
        storage_mode=history_service.get_current_storage_mode(),
        cloud_connected=history_service.is_cloud_connected()
    )


@router.post("/sentence", response_model=SentenceHistoryEntry)
async def save_sentence_history(
    entry: SentenceHistoryCreateRequest,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Saves an explicitly confirmed sentence to persistent history."""
    effective_user_id = entry.user_id or (current_user["id"] if current_user else None)
    result = history_service.add_sentence_entry(
        original_signs=entry.original_signs,
        confirmed_sentence=entry.confirmed_sentence,
        english_output=entry.english_output,
        telugu_output=entry.telugu_output,
        romanized_output=entry.romanized_output,
        selected_language=entry.selected_language,
        recognition_mode=entry.recognition_mode,
        user_id=effective_user_id
    )
    return SentenceHistoryEntry(**result)


@router.delete("/sentence")
async def clear_sentence_history(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Clears confirmed sentence records."""
    effective_user_id = user_id or (current_user["id"] if current_user else None)
    deleted_count = history_service.clear_sentence_history(user_id=effective_user_id)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "storage_mode": history_service.get_current_storage_mode()
    }


# =========================================================================
# 3. Excel (.xlsx) Export
# =========================================================================

@router.get("/export/excel")
async def export_excel(
    user_id: Optional[str] = Query(None, description="Optional user ID"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Generates and downloads a genuine multi-sheet Excel (.xlsx) workbook containing:
    1. User Profile Sheet
    2. Confirmed Sentence History Sheet
    3. Audit & Governance Metadata Sheet
    Includes formula injection sanitization.
    """
    effective_user = current_user
    if not effective_user and user_id:
        effective_user = get_user_by_id(user_id)

    effective_user_id = effective_user["id"] if effective_user else user_id
    sentences = history_service.get_sentence_history(user_id=effective_user_id, limit=500)
    storage_source = "Supabase PostgreSQL" if history_service.is_cloud_connected() else "Local SQLite"

    excel_stream = excel_export_service.generate_history_workbook(
        user=effective_user,
        sentences=sentences,
        storage_source=storage_source
    )

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"SignBridgeAI_History_{today_str}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Cache-Control": "no-cache"
        }
    )
