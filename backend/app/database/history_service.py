"""
SignBridge AI - Unified History Service
Interacts with Supabase PostgreSQL if available; gracefully falls back to local SQLite.
Supports both individual sign recognition logging and confirmed sentence history.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from backend.app.database.supabase_client import get_supabase_client
from backend.app.database.local_storage import (
    save_history_record,
    fetch_history_records,
    clear_history_records,
    save_sentence_record,
    fetch_sentence_records,
    clear_sentence_records
)


class HistoryService:
    def __init__(self):
        pass

    def get_current_storage_mode(self) -> str:
        client = get_supabase_client()
        return "supabase" if client is not None else "local_sqlite"

    def is_cloud_connected(self) -> bool:
        return get_supabase_client() is not None

    # -------------------------------------------------------------------------
    # Individual Gesture Frame Records
    # -------------------------------------------------------------------------
    def add_entry(
        self,
        predicted_label: str,
        english_meaning: str,
        confidence: Optional[float] = None,
        recognition_mode: str = "static_isl",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        client = get_supabase_client()
        if client is not None:
            try:
                record_id = str(uuid.uuid4())
                now_iso = datetime.now(timezone.utc).isoformat()
                payload = {
                    "id": record_id,
                    "user_id": user_id,
                    "predicted_label": predicted_label,
                    "english_meaning": english_meaning,
                    "confidence": confidence,
                    "recognition_mode": recognition_mode,
                    "created_at": now_iso
                }
                res = client.table("recognition_history").insert(payload).execute()
                if res.data:
                    entry = res.data[0]
                    entry["storage_source"] = "supabase"
                    return entry
            except Exception as e:
                print(f"[HistoryService] Supabase insert failed ({e}), falling back to SQLite.")

        # Fallback to SQLite
        return save_history_record(
            predicted_label=predicted_label,
            english_meaning=english_meaning,
            confidence=confidence,
            recognition_mode=recognition_mode,
            user_id=user_id
        )

    def get_history(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if client is not None:
            try:
                query = client.table("recognition_history").select("*").order("created_at", desc=True).limit(limit)
                if user_id:
                    query = query.eq("user_id", user_id)
                res = query.execute()
                if res.data is not None:
                    items = []
                    for row in res.data:
                        r = dict(row)
                        r["storage_source"] = "supabase"
                        items.append(r)
                    return items
            except Exception as e:
                print(f"[HistoryService] Supabase select failed ({e}), falling back to SQLite.")

        return fetch_history_records(user_id=user_id, limit=limit)

    def clear_history(self, user_id: Optional[str] = None) -> int:
        client = get_supabase_client()
        if client is not None:
            try:
                query = client.table("recognition_history").delete()
                if user_id:
                    query = query.eq("user_id", user_id)
                else:
                    query = query.neq("id", "")
                res = query.execute()
                return len(res.data) if res.data else 0
            except Exception as e:
                print(f"[HistoryService] Supabase delete failed ({e}), falling back to SQLite.")

        return clear_history_records(user_id=user_id)

    # -------------------------------------------------------------------------
    # Confirmed Sentence Records
    # -------------------------------------------------------------------------
    def add_sentence_entry(
        self,
        original_signs: str,
        confirmed_sentence: str,
        english_output: Optional[str] = None,
        telugu_output: Optional[str] = None,
        romanized_output: Optional[str] = None,
        selected_language: str = "en",
        recognition_mode: str = "custom_isl",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Saves an explicitly confirmed sentence to persistent history."""
        client = get_supabase_client()
        if client is not None:
            try:
                record_id = str(uuid.uuid4())
                now_iso = datetime.now(timezone.utc).isoformat()
                payload = {
                    "id": record_id,
                    "user_id": user_id,
                    "original_signs": original_signs,
                    "confirmed_sentence": confirmed_sentence,
                    "english_output": english_output,
                    "telugu_output": telugu_output,
                    "romanized_output": romanized_output,
                    "selected_language": selected_language,
                    "recognition_mode": recognition_mode,
                    "created_at": now_iso
                }
                res = client.table("sentence_history").insert(payload).execute()
                if res.data:
                    entry = res.data[0]
                    entry["storage_source"] = "supabase"
                    return entry
            except Exception as e:
                print(f"[HistoryService] Supabase sentence insert failed ({e}), falling back to SQLite.")

        return save_sentence_record(
            original_signs=original_signs,
            confirmed_sentence=confirmed_sentence,
            english_output=english_output,
            telugu_output=telugu_output,
            romanized_output=romanized_output,
            selected_language=selected_language,
            recognition_mode=recognition_mode,
            user_id=user_id
        )

    def get_sentence_history(self, user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieves confirmed sentences for a user (or local guest)."""
        client = get_supabase_client()
        if client is not None:
            try:
                query = client.table("sentence_history").select("*").order("created_at", desc=True).limit(limit)
                if user_id:
                    query = query.eq("user_id", user_id)
                res = query.execute()
                if res.data is not None:
                    items = []
                    for row in res.data:
                        r = dict(row)
                        r["storage_source"] = "supabase"
                        items.append(r)
                    return items
            except Exception as e:
                print(f"[HistoryService] Supabase sentence select failed ({e}), falling back to SQLite.")

        return fetch_sentence_records(user_id=user_id, limit=limit)

    def clear_sentence_history(self, user_id: Optional[str] = None) -> int:
        """Clears confirmed sentence history."""
        client = get_supabase_client()
        if client is not None:
            try:
                query = client.table("sentence_history").delete()
                if user_id:
                    query = query.eq("user_id", user_id)
                else:
                    query = query.neq("id", "")
                res = query.execute()
                return len(res.data) if res.data else 0
            except Exception as e:
                print(f"[HistoryService] Supabase sentence delete failed ({e}), falling back to SQLite.")

        return clear_sentence_records(user_id=user_id)


history_service = HistoryService()
