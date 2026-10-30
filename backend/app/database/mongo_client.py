"""
SignBridge AI - MongoDB Database Client Integration
Connects to MongoDB Atlas or local MongoDB using PyMongo.
Creates required collections and unique indexes.
Provides graceful error handling and disconnection recovery.
"""

from typing import Optional, Dict, Any
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from backend.app.config import settings

_mongo_client: Optional[MongoClient] = None
_mongo_db: Optional[Database] = None
_is_connected: bool = False


def init_mongo_indexes(db: Database) -> None:
    """Ensures necessary indexes and constraints are created in MongoDB collections."""
    try:
        # Users collection indexes: unique email and user ID
        db.users.create_index([("email", ASCENDING)], unique=True)
        db.users.create_index([("id", ASCENDING)], unique=True)
        db.users.create_index([("created_at", DESCENDING)])

        # Auth Sessions collection indexes: token lookup & auto-expiry index
        db.auth_sessions.create_index([("token", ASCENDING)], unique=True)
        db.auth_sessions.create_index([("user_id", ASCENDING)])
        db.auth_sessions.create_index([("expires_at", ASCENDING)])

        # Profiles collection indexes
        db.profiles.create_index([("id", ASCENDING)], unique=True)
        db.profiles.create_index([("email", ASCENDING)], unique=True)

        # Recognition History collection indexes: user_id & creation timestamp
        db.recognition_history.create_index([("id", ASCENDING)], unique=True)
        db.recognition_history.create_index([("user_id", ASCENDING)])
        db.recognition_history.create_index([("created_at", DESCENDING)])

        # Sentence History collection indexes: user_id & creation timestamp
        db.sentence_history.create_index([("id", ASCENDING)], unique=True)
        db.sentence_history.create_index([("user_id", ASCENDING)])
        db.sentence_history.create_index([("created_at", DESCENDING)])

        print("[MongoDB] Collections and indexes initialized successfully.")
    except Exception as e:
        print(f"[MongoDB] Index creation warning: {e}")


def get_mongo_client() -> Optional[MongoClient]:
    """Retrieves or initializes the singleton PyMongo client."""
    global _mongo_client, _mongo_db, _is_connected

    if _mongo_client is not None:
        return _mongo_client

    uri = (settings.MONGODB_URI or "").strip()
    if not uri or not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        return None

    try:
        # Connect with 5-second server selection timeout for resilient startup
        _mongo_client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
            maxPoolSize=50,
            retryWrites=True
        )
        # Test connection ping
        _mongo_client.admin.command('ping')
        _is_connected = True

        db_name = settings.MONGODB_DB_NAME or "signbridge_ai"
        _mongo_db = _mongo_client[db_name]
        init_mongo_indexes(_mongo_db)
        print(f"[MongoDB] Successfully connected to MongoDB Atlas database: '{db_name}'.")
        return _mongo_client
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        print(f"[MongoDB] Connection to MongoDB failed ({e}). Operating in resilient fallback mode.")
        _mongo_client = None
        _mongo_db = None
        _is_connected = False
        return None


def get_mongo_db() -> Optional[Database]:
    """Retrieves the active MongoDB database instance, or None if disconnected."""
    global _mongo_db
    if _mongo_db is not None:
        return _mongo_db

    client = get_mongo_client()
    if client is not None:
        db_name = settings.MONGODB_DB_NAME or "signbridge_ai"
        _mongo_db = client[db_name]
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
        try:
            db.command('ping')
        except Exception:
            db.list_collection_names()
        return True
    except Exception:
        return False


def set_mock_mongo_db(mock_db: Optional[Database]) -> None:
    """Testing helper: sets a mock MongoDB database instance (e.g. from mongomock)."""
    global _mongo_client, _mongo_db, _is_connected
    _mongo_db = mock_db
    _is_connected = mock_db is not None
    if mock_db is not None:
        init_mongo_indexes(mock_db)


def close_mongo_connection() -> None:
    """Safely closes the MongoDB connection pool."""
    global _mongo_client, _mongo_db, _is_connected
    if _mongo_client is not None:
        try:
            _mongo_client.close()
        except Exception:
            pass
    _mongo_client = None
    _mongo_db = None
    _is_connected = False
