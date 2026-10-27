"""
SignBridge AI - Supabase Client Integration
Initializes Supabase connection if environment variables are provided.
Falls back safely without crashing if credentials are not configured.
"""

import os
from typing import Optional
from backend.app.config import settings

_supabase_client = None


def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL.strip()
    key = settings.SUPABASE_PUBLISHABLE_KEY.strip() or settings.SUPABASE_SECRET_KEY.strip()

    if not url or not key or not url.startswith("http"):
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        print(f"[Supabase] Initialization error: {e}")
        return None


def is_supabase_configured() -> bool:
    return bool(
        settings.SUPABASE_URL.strip() and
        (settings.SUPABASE_PUBLISHABLE_KEY.strip() or settings.SUPABASE_SECRET_KEY.strip())
    )
