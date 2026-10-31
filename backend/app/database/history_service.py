"""
SignBridge AI - Unified Database and Storage Service
Primary persistence using MongoDB (Atlas or local).
Resilient local persistence fallback when MongoDB is unconfigured or unreachable.
Handles users, sessions, profiles, gesture recognition logs, and confirmed sentences.
"""

import uuid
import secrets
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone, timedelta

from backend.app.config import settings
from backend.app.database.mongo_client import get_mongo_db, is_mongo_connected
from backend.app.database.local_storage import (
    _hash_password,
    _verify_password,
    hash_session_token,
    create_user as sqlite_create_user,
    authenticate_user as sqlite_authenticate_user,
    get_user_by_token as sqlite_get_user_by_token,
    get_user_by_id as sqlite_get_user_by_id,
    update_user_profile as sqlite_update_user_profile,
    delete_session as sqlite_delete_session,
    save_history_record as sqlite_save_history_record,
    fetch_history_records as sqlite_fetch_history_records,
    clear_history_records as sqlite_clear_history_records,
    delete_history_record_by_id as sqlite_delete_history_record_by_id,
    save_sentence_record as sqlite_save_sentence_record,
    fetch_sentence_records as sqlite_fetch_sentence_records,
    clear_sentence_records as sqlite_clear_sentence_records,
    delete_sentence_record_by_id as sqlite_delete_sentence_record_by_id
)

logger = logging.getLogger(__name__)


class DatabaseUnavailableError(RuntimeError):
    """Raised when production persistence is unavailable."""


class DatabaseService:
    def __init__(self):
        pass

    def _get_mongo_db(self) -> Optional[Any]:
        db = get_mongo_db()
        if db is None and settings.ENVIRONMENT.lower() == "production":
            raise DatabaseUnavailableError("The configured database is unavailable")
        return db

    @staticmethod
    def _raise_if_production(exc: Exception, operation: str) -> None:
        logger.error("MongoDB %s failed (%s)", operation, type(exc).__name__)
        if settings.ENVIRONMENT.lower() == "production":
            raise DatabaseUnavailableError("The configured database is unavailable") from exc


    def _build_id_query(self, record_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        id_clauses: List[Dict[str, Any]] = [{"id": record_id}]
        try:
            from bson import ObjectId
            if ObjectId.is_valid(record_id):
                id_clauses.append({"_id": ObjectId(record_id)})
        except Exception:
            pass
        id_clauses.append({"_id": record_id})

        id_match = {"$or": id_clauses}
        if user_id:
            return {"$and": [id_match, {"user_id": user_id}]}
        return {"$and": [id_match, {"$or": [{"user_id": None}, {"user_id": ""}]}]}

    def entry_exists_any(self, record_id: str) -> bool:
        """Checks if a recognition record exists under any owner."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                id_clauses: List[Dict[str, Any]] = [{"id": record_id}]
                try:
                    from bson import ObjectId
                    if ObjectId.is_valid(record_id):
                        id_clauses.append({"_id": ObjectId(record_id)})
                except Exception:
                    pass
                id_clauses.append({"_id": record_id})
                return db.recognition_history.find_one({"$or": id_clauses}) is not None
            except Exception:
                pass
        from backend.app.database.local_storage import get_db_connection
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM recognition_history WHERE id = ? LIMIT 1", (record_id,))
            return cur.fetchone() is not None

    def sentence_exists_any(self, record_id: str) -> bool:
        """Checks if a confirmed sentence record exists under any owner."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                id_clauses: List[Dict[str, Any]] = [{"id": record_id}]
                try:
                    from bson import ObjectId
                    if ObjectId.is_valid(record_id):
                        id_clauses.append({"_id": ObjectId(record_id)})
                except Exception:
                    pass
                id_clauses.append({"_id": record_id})
                return db.sentence_history.find_one({"$or": id_clauses}) is not None
            except Exception:
                pass
        from backend.app.database.local_storage import get_db_connection
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM sentence_history WHERE id = ? LIMIT 1", (record_id,))
            return cur.fetchone() is not None

    def get_current_storage_mode(self) -> str:
        """Returns 'mongodb' if MongoDB is active and reachable, else 'local_sqlite'."""
        db = self._get_mongo_db()
        return "mongodb" if db is not None else "local_sqlite"

    def is_cloud_connected(self) -> bool:
        """Returns True if connected to MongoDB."""
        return is_mongo_connected()

    # =========================================================================
    # User Authentication & Profiles (MongoDB with SQLite fallback)
    # =========================================================================

    def create_user(
        self,
        email: str,
        password: str,
        display_name: str,
        preferred_language: str = "en"
    ) -> Dict[str, Any]:
        """Registers a new user with salted hashed password and persists to database."""
        clean_email = email.strip().lower()
        clean_name = display_name.strip() or clean_email.split("@")[0]
        hashed, salt = _hash_password(password)

        user_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        db = self._get_mongo_db()
        if db is not None:
            try:
                if db.users.find_one({"email": clean_email}, {"_id": 1}):
                    raise ValueError("Email is already registered")
                user_doc = {
                    "id": user_id,
                    "email": clean_email,
                    "password_hash": hashed,
                    "salt": salt,
                    "display_name": clean_name,
                    "preferred_language": preferred_language,
                    "created_at": now_iso,
                    "updated_at": now_iso
                }
                db.users.insert_one(user_doc)

                profile_doc = {
                    "id": user_id,
                    "display_name": clean_name,
                    "email": clean_email,
                    "preferred_language": preferred_language,
                    "created_at": now_iso,
                    "updated_at": now_iso
                }
                db.profiles.update_one(
                    {"id": user_id},
                    {"$set": profile_doc},
                    upsert=True
                )

                return {
                    "id": user_id,
                    "email": clean_email,
                    "display_name": clean_name,
                    "preferred_language": preferred_language,
                    "created_at": now_iso
                }
            except ValueError:
                raise
            except Exception as e:
                if type(e).__name__ == "DuplicateKeyError":
                    raise ValueError("Email is already registered") from e
                self._raise_if_production(e, "user registration")

        return sqlite_create_user(
            email=email,
            password=password,
            display_name=display_name,
            preferred_language=preferred_language
        )

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticates user against MongoDB (or SQLite) and creates a session token."""
        clean_email = email.strip().lower()
        db = self._get_mongo_db()

        if db is not None:
            try:
                user = db.users.find_one({"email": clean_email})
                if user and _verify_password(password, user.get("password_hash", ""), user.get("salt", "")):
                    user_id = user["id"]
                    token = secrets.token_urlsafe(32)
                    now = datetime.now(timezone.utc)
                    if (
                        not user.get("password_hash", "").startswith(("$2a$", "$2b$", "$2y$"))
                        and len(password.encode("utf-8")) <= 72
                    ):
                        upgraded_hash, _ = _hash_password(password)
                        db.users.update_one(
                            {"id": user["id"]},
                            {"$set": {
                                "password_hash": upgraded_hash,
                                "salt": "",
                                "updated_at": now.isoformat()
                            }}
                        )
                    expires = now + timedelta(days=settings.SESSION_TTL_DAYS)

                    session_doc = {
                        "token": hash_session_token(token),
                        "user_id": user_id,
                        "expires_at": expires,
                        "created_at": now
                    }
                    db.auth_sessions.insert_one(session_doc)

                    return {
                        "token": token,
                        "user": {
                            "id": user_id,
                            "email": user["email"],
                            "display_name": user.get("display_name", user["email"].split("@")[0]),
                            "preferred_language": user.get("preferred_language", "en"),
                            "created_at": user.get("created_at", now.isoformat())
                        }
                    }
            except Exception as e:
                self._raise_if_production(e, "authentication")

            return None

        return sqlite_authenticate_user(email=clean_email, password=password)

    def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Resolves active user session by bearer token."""
        db = self._get_mongo_db()
        now_iso = datetime.now(timezone.utc).isoformat()
        now = datetime.now(timezone.utc)

        if db is not None:
            try:
                session = db.auth_sessions.find_one({
                    "$or": [
                        {"token": hash_session_token(token), "expires_at": {"$gt": now}},
                        {"token": token, "expires_at": {"$gt": now_iso}}
                    ]
                })
                if session:
                    user = db.users.find_one({"id": session["user_id"]})
                    if user:
                        return {
                            "id": user["id"],
                            "email": user["email"],
                            "display_name": user.get("display_name", user["email"].split("@")[0]),
                            "preferred_language": user.get("preferred_language", "en"),
                            "created_at": user.get("created_at", now_iso)
                        }
            except Exception as e:
                self._raise_if_production(e, "session lookup")

            return None

        return sqlite_get_user_by_token(token)

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves user profile by ID."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                user = db.users.find_one({"id": user_id}, {"password_hash": 0, "salt": 0, "_id": 0})
                if user:
                    return user
            except Exception as e:
                self._raise_if_production(e, "user lookup")

            return None

        return sqlite_get_user_by_id(user_id)

    def update_user_profile(
        self,
        user_id: str,
        display_name: Optional[str] = None,
        preferred_language: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Updates user profile information in MongoDB and local backup."""
        now_iso = datetime.now(timezone.utc).isoformat()
        db = self._get_mongo_db()

        if db is not None:
            try:
                user = db.users.find_one({"id": user_id})
                if user:
                    new_name = display_name.strip() if display_name is not None else user.get("display_name", "")
                    new_lang = preferred_language if preferred_language is not None else user.get("preferred_language", "en")

                    db.users.update_one(
                        {"id": user_id},
                        {"$set": {"display_name": new_name, "preferred_language": new_lang, "updated_at": now_iso}}
                    )
                    db.profiles.update_one(
                        {"id": user_id},
                        {"$set": {"display_name": new_name, "preferred_language": new_lang, "updated_at": now_iso}}
                    )

                    return {
                        "id": user_id,
                        "email": user["email"],
                        "display_name": new_name,
                        "preferred_language": new_lang,
                        "created_at": user.get("created_at", now_iso)
                    }
            except Exception as e:
                self._raise_if_production(e, "profile update")

            return None

        return sqlite_update_user_profile(user_id, display_name, preferred_language)

    def delete_session(self, token: str) -> bool:
        """Terminates an authenticated session token."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                result = db.auth_sessions.delete_one({
                    "$or": [
                        {"token": hash_session_token(token)},
                        {"token": token}
                    ]
                })
                return result.deleted_count > 0
            except Exception as e:
                self._raise_if_production(e, "session deletion")

        return sqlite_delete_session(token)

    # =========================================================================
    # Recognition History (Individual Frames)
    # =========================================================================

    def add_entry(
        self,
        predicted_label: str,
        english_meaning: str,
        confidence: Optional[float] = None,
        recognition_mode: str = "static_isl",
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Saves a recognized gesture prediction with duplicate suppression."""
        now_iso = datetime.now(timezone.utc).isoformat()
        db = self._get_mongo_db()

        if db is not None:
            try:
                # Idempotency / duplicate protection: check last record within 3 seconds
                query: Dict[str, Any] = {"predicted_label": predicted_label}
                if user_id:
                    query["user_id"] = user_id
                else:
                    query["$or"] = [{"user_id": None}, {"user_id": ""}]

                recent = db.recognition_history.find_one(query, sort=[("created_at", -1)])
                if recent:
                    try:
                        recent_dt = datetime.fromisoformat(recent["created_at"])
                        current_dt = datetime.fromisoformat(now_iso)
                        if abs((current_dt - recent_dt).total_seconds()) < 3.0:
                            recent_dict = dict(recent)
                            recent_dict.pop("_id", None)
                            recent_dict["storage_source"] = "mongodb"
                            return recent_dict
                    except Exception:
                        pass

                record_id = str(uuid.uuid4())
                doc = {
                    "id": record_id,
                    "user_id": user_id,
                    "predicted_label": predicted_label,
                    "english_meaning": english_meaning,
                    "confidence": confidence,
                    "recognition_mode": recognition_mode,
                    "created_at": now_iso
                }
                db.recognition_history.insert_one(doc)
                doc.pop("_id", None)
                doc["storage_source"] = "mongodb"
                return doc
            except Exception as e:
                self._raise_if_production(e, "history save")

        return sqlite_save_history_record(
            predicted_label=predicted_label,
            english_meaning=english_meaning,
            confidence=confidence,
            recognition_mode=recognition_mode,
            user_id=user_id
        )

    def get_history(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves recognition records ordered by creation date descending with strict user isolation."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                query: Dict[str, Any] = {}
                if user_id:
                    query["user_id"] = user_id
                else:
                    query["$or"] = [{"user_id": None}, {"user_id": ""}]

                cursor = db.recognition_history.find(query).sort("created_at", -1).limit(limit)
                items = []
                for doc in cursor:
                    if "id" not in doc or not doc["id"]:
                        doc["id"] = str(doc.get("_id", ""))
                    doc.pop("_id", None)
                    doc["storage_source"] = "mongodb"
                    items.append(doc)
                return items
            except Exception as e:
                self._raise_if_production(e, "history retrieval")

        return sqlite_fetch_history_records(user_id=user_id, limit=limit)

    def clear_history(self, user_id: Optional[str] = None) -> int:
        """Clears recognition history records for the current user or guest."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                query: Dict[str, Any] = {}
                if user_id:
                    query["user_id"] = user_id
                else:
                    query["$or"] = [{"user_id": None}, {"user_id": ""}]

                res = db.recognition_history.delete_many(query)
                return res.deleted_count
            except Exception as e:
                self._raise_if_production(e, "history deletion")

        return sqlite_clear_history_records(user_id=user_id)

    def delete_entry_by_id(self, record_id: str, user_id: Optional[str] = None) -> bool:
        """Deletes a specific recognition record owned by user or guest."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                query = self._build_id_query(record_id, user_id)
                res = db.recognition_history.delete_one(query)
                if res.deleted_count > 0:
                    return True
            except Exception as e:
                self._raise_if_production(e, "history record deletion")

            return False

        return sqlite_delete_history_record_by_id(record_id=record_id, user_id=user_id)

    # =========================================================================
    # Confirmed Sentence Records
    # =========================================================================

    def add_sentence_entry(
        self,
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
        """Saves an explicitly confirmed sentence to persistent history with duplicate suppression."""
        now_iso = datetime.now(timezone.utc).isoformat()
        db = self._get_mongo_db()

        if db is not None:
            try:
                # Duplicate suppression within 5 seconds
                query: Dict[str, Any] = {"confirmed_sentence": confirmed_sentence}
                if user_id:
                    query["user_id"] = user_id
                else:
                    query["$or"] = [{"user_id": None}, {"user_id": ""}]

                recent = db.sentence_history.find_one(query, sort=[("created_at", -1)])
                if recent:
                    try:
                        recent_dt = datetime.fromisoformat(recent["created_at"])
                        current_dt = datetime.fromisoformat(now_iso)
                        if abs((current_dt - recent_dt).total_seconds()) < 5.0:
                            recent_dict = dict(recent)
                            recent_dict.pop("_id", None)
                            recent_dict["storage_source"] = "mongodb"
                            return recent_dict
                    except Exception:
                        pass

                record_id = str(uuid.uuid4())
                doc = {
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
                    "created_at": now_iso
                }
                db.sentence_history.insert_one(doc)
                doc.pop("_id", None)
                doc["storage_source"] = "mongodb"
                return doc
            except Exception as e:
                self._raise_if_production(e, "sentence history save")

        return sqlite_save_sentence_record(
            original_signs=original_signs,
            confirmed_sentence=confirmed_sentence,
            english_output=english_output,
            telugu_output=telugu_output,
            romanized_output=romanized_output,
            selected_language=selected_language,
            recognition_mode=recognition_mode,
            source_mode=source_mode,
            user_id=user_id
        )

    def get_sentence_history(self, user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieves confirmed sentences for a user (or guest) ordered by creation date descending."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                query: Dict[str, Any] = {}
                if user_id:
                    query["user_id"] = user_id
                else:
                    query["$or"] = [{"user_id": None}, {"user_id": ""}]

                cursor = db.sentence_history.find(query).sort("created_at", -1).limit(limit)
                items = []
                for doc in cursor:
                    if "id" not in doc or not doc["id"]:
                        doc["id"] = str(doc.get("_id", ""))
                    doc.pop("_id", None)
                    doc["storage_source"] = "mongodb"
                    items.append(doc)
                return items
            except Exception as e:
                self._raise_if_production(e, "sentence history retrieval")

        return sqlite_fetch_sentence_records(user_id=user_id, limit=limit)

    def clear_sentence_history(self, user_id: Optional[str] = None) -> int:
        """Clears confirmed sentence records for the authenticated user or guest."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                query: Dict[str, Any] = {}
                if user_id:
                    query["user_id"] = user_id
                else:
                    query["$or"] = [{"user_id": None}, {"user_id": ""}]

                res = db.sentence_history.delete_many(query)
                return res.deleted_count
            except Exception as e:
                self._raise_if_production(e, "sentence history deletion")

        return sqlite_clear_sentence_records(user_id=user_id)

    def delete_sentence_by_id(self, record_id: str, user_id: Optional[str] = None) -> bool:
        """Deletes a specific confirmed sentence record if owned by user or guest."""
        db = self._get_mongo_db()
        if db is not None:
            try:
                query = self._build_id_query(record_id, user_id)
                res = db.sentence_history.delete_one(query)
                if res.deleted_count > 0:
                    return True
            except Exception as e:
                self._raise_if_production(e, "sentence record deletion")

            return False

        return sqlite_delete_sentence_record_by_id(record_id=record_id, user_id=user_id)

    # =========================================================================
    # Data Migration Utilities (Local SQLite -> MongoDB Atlas)
    # =========================================================================

    def migrate_all_to_mongodb(self) -> Dict[str, Any]:
        """
        Migrates all existing records (Users, Profiles, Auth Sessions, Recognition History,
        and Sentence History) from the local SQLite store into MongoDB Atlas.
        Preserves unique IDs, email constraints, and creation timestamps without duplicates.
        """
        db = self._get_mongo_db()
        if db is None:
            return {"success": False, "error": "MongoDB is not connected"}

        stats = {
            "users_migrated": 0,
            "profiles_migrated": 0,
            "sessions_migrated": 0,
            "history_migrated": 0,
            "sentences_migrated": 0
        }

        from backend.app.database.local_storage import get_db_connection

        with get_db_connection() as conn:
            cur = conn.cursor()

            # 1. Migrate Users
            cur.execute("SELECT id, email, password_hash, salt, display_name, preferred_language, created_at, updated_at FROM users")
            for row in cur.fetchall():
                u = dict(row)
                if not db.users.find_one({"$or": [{"id": u["id"]}, {"email": u["email"]}]}):
                    try:
                        db.users.insert_one(u)
                        stats["users_migrated"] += 1
                    except Exception:
                        pass

            # 2. Migrate Profiles
            cur.execute("SELECT id, display_name, email, preferred_language, created_at, updated_at FROM profiles")
            for row in cur.fetchall():
                p = dict(row)
                if not db.profiles.find_one({"$or": [{"id": p["id"]}, {"email": p["email"]}]}):
                    try:
                        db.profiles.insert_one(p)
                        stats["profiles_migrated"] += 1
                    except Exception:
                        pass

            # 3. Migrate Sessions
            cur.execute("SELECT token, user_id, expires_at, created_at FROM auth_sessions")
            for row in cur.fetchall():
                s = dict(row)
                token_value = s.pop("token")
                token_hash = (
                    token_value
                    if len(token_value) == 64 and all(char in "0123456789abcdef" for char in token_value.lower())
                    else hash_session_token(token_value)
                )
                s["token"] = token_hash
                try:
                    expires_at = datetime.fromisoformat(s["expires_at"])
                    s["expires_at"] = expires_at.replace(tzinfo=timezone.utc) if expires_at.tzinfo is None else expires_at
                except (TypeError, ValueError):
                    logger.warning("Skipping migration of a session with an invalid expiration value")
                    continue
                if not db.auth_sessions.find_one({"token": token_hash}):
                    try:
                        db.auth_sessions.insert_one(s)
                        stats["sessions_migrated"] += 1
                    except Exception:
                        pass

            # 4. Migrate Recognition History
            cur.execute("SELECT id, user_id, predicted_label, english_meaning, confidence, recognition_mode, created_at FROM recognition_history")
            for row in cur.fetchall():
                h = dict(row)
                if not db.recognition_history.find_one({"id": h["id"]}):
                    try:
                        db.recognition_history.insert_one(h)
                        stats["history_migrated"] += 1
                    except Exception:
                        pass

            # 5. Migrate Sentence History
            cur.execute("SELECT id, user_id, original_signs, confirmed_sentence, english_output, telugu_output, romanized_output, selected_language, recognition_mode, source_mode, created_at FROM sentence_history")
            for row in cur.fetchall():
                s = dict(row)
                if not db.sentence_history.find_one({"id": s["id"]}):
                    try:
                        db.sentence_history.insert_one(s)
                        stats["sentences_migrated"] += 1
                    except Exception:
                        pass

        return {
            "success": True,
            "stats": stats,
            "users_migrated": stats["users_migrated"],
            "profiles_migrated": stats["profiles_migrated"],
            "sessions_migrated": stats["sessions_migrated"],
            "history_migrated": stats["history_migrated"],
            "sentences_migrated": stats["sentences_migrated"]
        }


# Singleton service export
history_service = DatabaseService()
