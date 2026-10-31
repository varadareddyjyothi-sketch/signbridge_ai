"""
Pytest configuration and global fixtures for backend tests.
Ensures tests run deterministically with in-memory mongomock, preventing
unintended network calls to remote MongoDB Atlas clusters during automated testing.
"""

import mongomock
import pytest
from backend.app.database.mongo_client import set_mock_mongo_db, init_mongo_indexes


@pytest.fixture(autouse=True)
def auto_mock_mongo():
    """Automatically provides an isolated in-memory MongoDB database for every test."""
    client = mongomock.MongoClient()
    mock_db = client["signbridge_ai"]
    init_mongo_indexes(mock_db)
    set_mock_mongo_db(mock_db)
    try:
        yield mock_db
    finally:
        set_mock_mongo_db(None)
        client.close()

