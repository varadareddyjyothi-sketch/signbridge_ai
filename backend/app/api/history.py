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
    limit: int = Query(50, ge=1, le=200, description="Max records to retrieve"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Retrieves sign recognition history for the current user or guest."""
    effective_user_id = current_user["id"] if current_user else None
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
    """Saves a genuine recognition prediction result with authenticated user isolation."""
    effective_user_id = current_user["id"] if current_user else None
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
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Clears permitted recognition history records for the authenticated user or guest."""
    effective_user_id = current_user["id"] if current_user else None
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
@router.get("/sentences", response_model=SentenceHistoryResponse)
async def get_sentence_history(
    limit: int = Query(100, ge=1, le=500, description="Max records to retrieve"),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Retrieves confirmed human-approved sentences for the authenticated user or guest."""
    effective_user_id = current_user["id"] if current_user else None
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
    """Saves an explicitly confirmed sentence to persistent history with user isolation."""
    effective_user_id = current_user["id"] if current_user else None
    result = history_service.add_sentence_entry(
        original_signs=entry.original_signs,
        confirmed_sentence=entry.confirmed_sentence,
        english_output=entry.english_output,
        telugu_output=entry.telugu_output,
        romanized_output=entry.romanized_output,
        selected_language=entry.selected_language,
        recognition_mode=entry.recognition_mode,
        source_mode=entry.source_mode,
        user_id=effective_user_id
    )
    return SentenceHistoryEntry(**result)


@router.delete("/sentence")
async def clear_sentence_history(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Clears confirmed sentence records for the current user or guest session."""
    effective_user_id = current_user["id"] if current_user else None
    deleted_count = history_service.clear_sentence_history(user_id=effective_user_id)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "storage_mode": history_service.get_current_storage_mode()
    }


@router.delete("/sentence/{record_id}")
async def delete_single_sentence(
    record_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Deletes an individual confirmed sentence record owned by the user or guest."""
    effective_user_id = current_user["id"] if current_user else None
    deleted = history_service.delete_sentence_by_id(record_id=record_id, user_id=effective_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Sentence record not found or unauthorized to delete")
    return {
        "success": True,
        "deleted_id": record_id,
        "storage_mode": history_service.get_current_storage_mode()
    }


# =========================================================================
# 3. Excel (.xlsx) Export
# =========================================================================

@router.get("/export/excel")
async def export_excel(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Generates and downloads a genuine multi-sheet Excel (.xlsx) workbook containing:
    1. User Profile Sheet
    2. Confirmed Sentence History Sheet
    3. Audit & Governance Metadata Sheet
    Includes formula injection sanitization and authenticated user isolation.
    """
    effective_user = current_user
    effective_user_id = effective_user["id"] if effective_user else None
    sentences = history_service.get_sentence_history(user_id=effective_user_id, limit=500)
    storage_source = "MongoDB Atlas" if history_service.is_cloud_connected() else "Local SQLite"

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


# =========================================================================
# 4. Individual Recognition Deletion (Generic ID parameter declared last)
# =========================================================================

@router.delete("/{record_id}")
async def delete_single_history(
    record_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Deletes an individual recognition history record owned by the user or guest."""
    effective_user_id = current_user["id"] if current_user else None
    deleted = history_service.delete_entry_by_id(record_id=record_id, user_id=effective_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Recognition record not found or unauthorized to delete")
    return {
        "success": True,
        "deleted_id": record_id,
        "storage_mode": history_service.get_current_storage_mode()
    }
