"""
SignBridge AI - MongoDB Database Client Integration
Connects to MongoDB Atlas or local MongoDB using PyMongo.
Creates required collections and unique indexes.
Provides graceful error handling and disconnection recovery.
"""

import logging
import threading
from typing import Optional, Any
import time

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from pymongo.database import Database
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    PYMONGO_AVAILABLE = True
except ImportError:
    class MongoClient:  # type: ignore
        def __init__(self, *args, **kwargs): pass
    Database = Any  # type: ignore
    ASCENDING = 1
    DESCENDING = -1
    ConnectionFailure = Exception  # type: ignore
    ServerSelectionTimeoutError = Exception  # type: ignore
    PYMONGO_AVAILABLE = False

from backend.app.config import settings

logger = logging.getLogger(__name__)
_mongo_client: Optional[Any] = None
_mongo_db: Optional[Any] = None
_last_connect_failure_time: float = 0.0
_CONNECT_RETRY_INTERVAL_SECONDS: float = 5.0
_MONGO_LOCK = threading.Lock()


def init_mongo_indexes(db: Any) -> None:
    """Ensures necessary indexes and constraints are created in MongoDB collections."""
    if not PYMONGO_AVAILABLE or db is None:
        return
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.users.create_index([("id", ASCENDING)], unique=True)
    db.users.create_index([("created_at", DESCENDING)])

    db.auth_sessions.create_index([("token", ASCENDING)], unique=True)
    db.auth_sessions.create_index([("user_id", ASCENDING)])
    db.auth_sessions.create_index([("expires_at", ASCENDING)])

    db.profiles.create_index([("id", ASCENDING)], unique=True)
    db.profiles.create_index([("email", ASCENDING)], unique=True)

    db.recognition_history.create_index([("id", ASCENDING)], unique=True)
    db.recognition_history.create_index([("user_id", ASCENDING)])
    db.recognition_history.create_index([("created_at", DESCENDING)])

    db.sentence_history.create_index([("id", ASCENDING)], unique=True)
    db.sentence_history.create_index([("user_id", ASCENDING)])
    db.sentence_history.create_index([("created_at", DESCENDING)])


def get_mongo_client() -> Optional[Any]:
    """Retrieves or initializes the singleton PyMongo client with retry cooldown."""
    global _mongo_client, _mongo_db, _last_connect_failure_time

    if not PYMONGO_AVAILABLE:
        return None

    if _mongo_client is not None:
        return _mongo_client

    uri = (settings.MONGODB_URI or "").strip()
    if not uri or not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        return None

    with _MONGO_LOCK:
        if _mongo_client is not None:
            return _mongo_client
        if time.monotonic() - _last_connect_failure_time < _CONNECT_RETRY_INTERVAL_SECONDS:
            return None

        client = None
        try:
            client = MongoClient(
                uri,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                socketTimeoutMS=3000,
                retryWrites=True
            )
            client.admin.command("ping")
            db_name = settings.MONGODB_DB_NAME or "signbridge_ai"
            db = client[db_name]
            init_mongo_indexes(db)
            _mongo_client = client
            _mongo_db = db
            _last_connect_failure_time = 0.0
            logger.info("Connected to MongoDB database %s", db_name)
            return _mongo_client
        except Exception as exc:
            if client is not None:
                client.close()
            _last_connect_failure_time = time.monotonic()
            _mongo_db = None
            logger.error("MongoDB connection or index initialization failed: %s", type(exc).__name__)
            return None
def get_mongo_db() -> Optional[Database]:
    """Retrieves the active MongoDB database instance, or None if disconnected."""
    global _mongo_db
    if _mongo_db is not None:
        return _mongo_db

    client = get_mongo_client()
    if client is not None:
        return _mongo_db
    return None


def is_mongo_configured() -> bool:
    """Checks whether a valid MongoDB URI is configured in environment or active test mock."""
    global _mongo_db
    if _mongo_db is not None:
        return True
    uri = (settings.MONGODB_URI or "").strip()
    return bool(uri and (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")))


def is_mongo_connected() -> bool:
    """Verifies live connection health to MongoDB."""
    db = get_mongo_db()
    if db is None:
        return False
    try:
        db.command("ping")
        return True
    except Exception:
        return False


def set_mock_mongo_db(mock_db: Optional[Database]) -> None:
    """Testing helper: sets a mock MongoDB database instance (e.g. from mongomock)."""
    global _mongo_client, _mongo_db, _last_connect_failure_time
    _mongo_db = mock_db
    _mongo_client = getattr(mock_db, "client", mock_db) if mock_db is not None else None
    _last_connect_failure_time = 0.0
    if mock_db is not None:
        init_mongo_indexes(mock_db)


def close_mongo_connection() -> None:
    """Safely closes the MongoDB connection pool."""
    global _mongo_client, _mongo_db
    with _MONGO_LOCK:
        if _mongo_client is not None:
            _mongo_client.close()
        _mongo_client = None
        _mongo_db = None
