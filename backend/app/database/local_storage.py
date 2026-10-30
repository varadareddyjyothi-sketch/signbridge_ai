"""
SignBridge AI - Local SQLite Persistent Fallback & Auth Database
Provides zero-configuration local persistence, secure authentication,
profile management, and confirmed sentence history.
"""

import os
import sqlite3
import uuid
import hashlib
import secrets
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timezone, timedelta
from backend.app.config import settings


def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(settings.SQLITE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    return conn


def _hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hashes a password with PBKDF2-HMAC-SHA256 and salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return hashed, salt


def _verify_password(password: str, hashed: str, salt: str) -> bool:
    new_hash, _ = _hash_password(password, salt)
    return secrets.compare_digest(new_hash, hashed)


def init_local_db():
    """Initializes local SQLite tables matching the application schema."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Users table for secure authentication
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                display_name TEXT NOT NULL,
                preferred_language TEXT DEFAULT 'en',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Auth Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                display_name TEXT,
                email TEXT,
                preferred_language TEXT DEFAULT 'en',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Recognition History table (individual gesture frames)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recognition_history (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                predicted_label TEXT NOT NULL,
                english_meaning TEXT NOT NULL,
                confidence REAL,
                recognition_mode TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)

        # Sentence History table (confirmed human-approved sentences)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sentence_history (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                original_signs TEXT NOT NULL,
                confirmed_sentence TEXT NOT NULL,
                english_output TEXT,
                telugu_output TEXT,
                romanized_output TEXT,
                selected_language TEXT NOT NULL,
                recognition_mode TEXT NOT NULL,
                source_mode TEXT DEFAULT 'camera_recognition',
                created_at TEXT NOT NULL
            );
        """)

        # Schema migrations for existing databases
        cursor.execute("PRAGMA table_info(profiles);")
        profile_cols = [col[1] for col in cursor.fetchall()]
        if "email" not in profile_cols:
            cursor.execute("ALTER TABLE profiles ADD COLUMN email TEXT;")
        if "preferred_language" not in profile_cols:
            cursor.execute("ALTER TABLE profiles ADD COLUMN preferred_language TEXT DEFAULT 'en';")
        if "updated_at" not in profile_cols:
            cursor.execute("ALTER TABLE profiles ADD COLUMN updated_at TEXT;")

        cursor.execute("PRAGMA table_info(sentence_history);")
        sent_cols = [col[1] for col in cursor.fetchall()]
        if "source_mode" not in sent_cols:
            cursor.execute("ALTER TABLE sentence_history ADD COLUMN source_mode TEXT DEFAULT 'camera_recognition';")

        # Indices
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_user_id ON recognition_history(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_created_at ON recognition_history(created_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sentences_user_id ON sentence_history(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sentences_created_at ON sentence_history(created_at DESC);")

        conn.commit()


# =========================================================================
# User Authentication & Profile Operations
# =========================================================================

def create_user(
    email: str,
    password: str,
    display_name: str,
    preferred_language: str = "en"
) -> Dict[str, Any]:
    """Registers a new user with salted hashed password."""
    init_local_db()
    clean_email = email.strip().lower()
    clean_name = display_name.strip() or clean_email.split("@")[0]
    hashed, salt = _hash_password(password)

    user_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (clean_email,))
        if cursor.fetchone():
            raise ValueError("Email is already registered")

        cursor.execute("""
            INSERT INTO users (id, email, password_hash, salt, display_name, preferred_language, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, clean_email, hashed, salt, clean_name, preferred_language, now_iso, now_iso))

        cursor.execute("""
            INSERT INTO profiles (id, display_name, email, preferred_language, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, clean_name, clean_email, preferred_language, now_iso, now_iso))

        conn.commit()

    return {
        "id": user_id,
        "email": clean_email,
        "display_name": clean_name,
        "preferred_language": preferred_language,
        "created_at": now_iso
    }


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticates user and returns user info + new session token."""
    init_local_db()
    clean_email = email.strip().lower()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, password_hash, salt, display_name, preferred_language, created_at
            FROM users WHERE email = ?
        """, (clean_email,))
        row = cursor.fetchone()

        if not row:
            return None

        if not _verify_password(password, row["password_hash"], row["salt"]):
            return None

        user_id = row["id"]
        # Generate new session token (valid for 30 days)
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires = (now + timedelta(days=30)).isoformat()

        cursor.execute("""
            INSERT INTO auth_sessions (token, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        """, (token, user_id, expires, now.isoformat()))
        conn.commit()

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": row["email"],
            "display_name": row["display_name"],
            "preferred_language": row["preferred_language"],
            "created_at": row["created_at"]
        }
    }


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    """Retrieves user by active session token."""
    init_local_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.email, u.display_name, u.preferred_language, u.created_at
            FROM auth_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
        """, (token, now_iso))
        row = cursor.fetchone()
        if not row:
            return None

        return {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "preferred_language": row["preferred_language"],
            "created_at": row["created_at"]
        }


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves user by ID."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, display_name, preferred_language, created_at
            FROM users WHERE id = ?
        """, (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)


def update_user_profile(
    user_id: str,
    display_name: Optional[str] = None,
    preferred_language: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Updates user profile settings."""
    init_local_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, display_name, preferred_language, created_at FROM users WHERE id = ?", (user_id,))
        current = cursor.fetchone()
        if not current:
            return None

        new_name = display_name.strip() if display_name is not None else current["display_name"]
        new_lang = preferred_language if preferred_language is not None else current["preferred_language"]

        cursor.execute("""
            UPDATE users SET display_name = ?, preferred_language = ?, updated_at = ? WHERE id = ?
        """, (new_name, new_lang, now_iso, user_id))

        cursor.execute("""
            UPDATE profiles SET display_name = ?, preferred_language = ?, updated_at = ? WHERE id = ?
        """, (new_name, new_lang, now_iso, user_id))

        conn.commit()

    return {
        "id": user_id,
        "email": current["email"],
        "display_name": new_name,
        "preferred_language": new_lang,
        "created_at": current["created_at"]
    }


def delete_session(token: str) -> bool:
    """Invalidates an auth session token."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
        conn.commit()
    return True


# =========================================================================
# Recognition History (Individual Frames)
# =========================================================================

def save_history_record(
    predicted_label: str,
    english_meaning: str,
    confidence: Optional[float] = None,
    recognition_mode: str = "static_isl",
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Inserts a recognition record into the local SQLite table with duplicate suppression."""
    init_local_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Idempotency / duplicate protection: check if identical record was saved within the last 3.0 seconds
        if user_id:
            cursor.execute("""
                SELECT id, user_id, predicted_label, english_meaning, confidence, recognition_mode, created_at
                FROM recognition_history
                WHERE user_id = ? AND predicted_label = ?
                ORDER BY created_at DESC LIMIT 1
            """, (user_id, predicted_label))
        else:
            cursor.execute("""
                SELECT id, user_id, predicted_label, english_meaning, confidence, recognition_mode, created_at
                FROM recognition_history
                WHERE (user_id IS NULL OR user_id = '') AND predicted_label = ?
                ORDER BY created_at DESC LIMIT 1
            """, (predicted_label,))

        recent = cursor.fetchone()
        if recent:
            recent_dict = dict(recent)
            try:
                recent_dt = datetime.fromisoformat(recent_dict["created_at"])
                current_dt = datetime.fromisoformat(now_iso)
                if abs((current_dt - recent_dt).total_seconds()) < 3.0:
                    recent_dict["storage_source"] = "local_sqlite"
                    return recent_dict
            except Exception:
                pass

        record_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO recognition_history (
                id, user_id, predicted_label, english_meaning, confidence, recognition_mode, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (record_id, user_id, predicted_label, english_meaning, confidence, recognition_mode, now_iso))
        conn.commit()

    return {
        "id": record_id,
        "user_id": user_id,
        "predicted_label": predicted_label,
        "english_meaning": english_meaning,
        "confidence": confidence,
        "recognition_mode": recognition_mode,
        "created_at": now_iso,
        "storage_source": "local_sqlite"
    }


def fetch_history_records(user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves recognition records ordered by creation date descending with user/guest isolation."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("""
                SELECT id, user_id, predicted_label, english_meaning, confidence, recognition_mode, created_at
                FROM recognition_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            cursor.execute("""
                SELECT id, user_id, predicted_label, english_meaning, confidence, recognition_mode, created_at
                FROM recognition_history
                WHERE user_id IS NULL OR user_id = ''
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
        rows = cursor.fetchall()

    return [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "predicted_label": row["predicted_label"],
            "english_meaning": row["english_meaning"],
            "confidence": row["confidence"],
            "recognition_mode": row["recognition_mode"],
            "created_at": row["created_at"],
            "storage_source": "local_sqlite"
        }
        for row in rows
    ]


def clear_history_records(user_id: Optional[str] = None) -> int:
    """Clears history records for the current user or guest, never touching another user's records."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM recognition_history WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("DELETE FROM recognition_history WHERE user_id IS NULL OR user_id = ''")
        deleted_count = cursor.rowcount
        conn.commit()
    return deleted_count


def delete_history_record_by_id(record_id: str, user_id: Optional[str] = None) -> bool:
    """Deletes an individual recognition record if owned by the specific user or guest session."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM recognition_history WHERE id = ? AND user_id = ?", (record_id, user_id))
        else:
            cursor.execute("DELETE FROM recognition_history WHERE id = ? AND (user_id IS NULL OR user_id = '')", (record_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
    return deleted


# =========================================================================
# Confirmed Sentence History
# =========================================================================

def save_sentence_record(
    original_signs: str,
    confirmed_sentence: str,
    english_output: Optional[str] = None,
    telugu_output: Optional[str] = None,
    romanized_output: Optional[str] = None,
    selected_language: str = "en",
    recognition_mode: str = "custom_isl",
    source_mode: str = "camera_recognition",
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """Inserts a confirmed sentence record into persistent storage with duplicate suppression."""
    init_local_db()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Idempotency / duplicate protection: check if identical record was saved within the last 5 seconds
        if user_id:
            cursor.execute("""
                SELECT id, user_id, original_signs, confirmed_sentence, english_output,
                       telugu_output, romanized_output, selected_language, recognition_mode,
                       COALESCE(source_mode, 'camera_recognition') AS source_mode, created_at
                FROM sentence_history
                WHERE user_id = ? AND confirmed_sentence = ?
                ORDER BY created_at DESC LIMIT 1
            """, (user_id, confirmed_sentence))
        else:
            cursor.execute("""
                SELECT id, user_id, original_signs, confirmed_sentence, english_output,
                       telugu_output, romanized_output, selected_language, recognition_mode,
                       COALESCE(source_mode, 'camera_recognition') AS source_mode, created_at
                FROM sentence_history
                WHERE (user_id IS NULL OR user_id = '') AND confirmed_sentence = ?
                ORDER BY created_at DESC LIMIT 1
            """, (confirmed_sentence,))

        recent = cursor.fetchone()
        if recent:
            recent_dict = dict(recent)
            try:
                recent_dt = datetime.fromisoformat(recent_dict["created_at"])
                current_dt = datetime.fromisoformat(now_iso)
                if abs((current_dt - recent_dt).total_seconds()) < 5.0:
                    recent_dict["storage_source"] = "local_sqlite"
                    return recent_dict
            except Exception:
                pass

        record_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO sentence_history (
                id, user_id, original_signs, confirmed_sentence, english_output,
                telugu_output, romanized_output, selected_language, recognition_mode, source_mode, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record_id, user_id, original_signs, confirmed_sentence, english_output,
            telugu_output, romanized_output, selected_language, recognition_mode, source_mode, now_iso
        ))
        conn.commit()

    return {
        "id": record_id,
        "user_id": user_id,
        "original_signs": original_signs,
        "confirmed_sentence": confirmed_sentence,
        "english_output": english_output,
        "telugu_output": telugu_output,
        "romanized_output": romanized_output,
        "selected_language": selected_language,
        "recognition_mode": recognition_mode,
        "source_mode": source_mode,
        "created_at": now_iso,
        "storage_source": "local_sqlite"
    }


def fetch_sentence_records(user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieves confirmed sentence records ordered by created_at DESC with user/guest isolation."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("""
                SELECT id, user_id, original_signs, confirmed_sentence, english_output,
                       telugu_output, romanized_output, selected_language, recognition_mode,
                       COALESCE(source_mode, 'camera_recognition') AS source_mode, created_at
                FROM sentence_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
        else:
            cursor.execute("""
                SELECT id, user_id, original_signs, confirmed_sentence, english_output,
                       telugu_output, romanized_output, selected_language, recognition_mode,
                       COALESCE(source_mode, 'camera_recognition') AS source_mode, created_at
                FROM sentence_history
                WHERE user_id IS NULL OR user_id = ''
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
        rows = cursor.fetchall()

    return [dict(row) for row in rows]


def clear_sentence_records(user_id: Optional[str] = None) -> int:
    """Clears confirmed sentence records for the current user or guest, never touching another user's records."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM sentence_history WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("DELETE FROM sentence_history WHERE user_id IS NULL OR user_id = ''")
        deleted_count = cursor.rowcount
        conn.commit()
    return deleted_count


def delete_sentence_record_by_id(record_id: str, user_id: Optional[str] = None) -> bool:
    """Deletes a specific confirmed sentence record if owned by the specific user or guest session."""
    init_local_db()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM sentence_history WHERE id = ? AND user_id = ?", (record_id, user_id))
        else:
            cursor.execute("DELETE FROM sentence_history WHERE id = ? AND (user_id IS NULL OR user_id = '')", (record_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
    return deleted

