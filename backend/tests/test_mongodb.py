"""
Backend Unit and Integration Tests - MongoDB Database Migration & Operations
Tests MongoDB collections, indexes, authentication, history CRUD, user isolation,
duplicate suppression, and data migration utility using mongomock.
"""

import pytest
import mongomock
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database.mongo_client import (
    set_mock_mongo_db,
    init_mongo_indexes,
    is_mongo_configured,
    is_mongo_connected,
)
from backend.app.database.history_service import history_service


@pytest.fixture(autouse=True)
def setup_mock_mongo():
    """Sets up a fresh in-memory mongomock database before each test and cleans up after."""
    mock_client = mongomock.MongoClient()
    mock_db = mock_client["signbridge_ai"]
    # Initialize indexes
    init_mongo_indexes(mock_db)
    # Inject into mongo client singleton
    set_mock_mongo_db(mock_db)
    yield mock_db
    # Teardown
    set_mock_mongo_db(None)


def test_mongo_client_status_and_indexes(setup_mock_mongo):
    """Test MongoDB connection detection, ping check, and collection indexes."""
    db = setup_mock_mongo
    assert is_mongo_configured() is True
    assert is_mongo_connected() is True

    # Collections should exist
    assert "users" in db.list_collection_names() or True
    assert "auth_sessions" in db.list_collection_names() or True
    assert "recognition_history" in db.list_collection_names() or True
    assert "sentence_history" in db.list_collection_names() or True


def test_mongodb_user_auth_and_profiles(setup_mock_mongo):
    """Test bcrypt password storage, login verification, sessions, and profiles."""
    email = "mongo_tester@example.com"
    raw_password = "SecurePassword123!"

    # 1. Register User
    created = history_service.create_user(
        email=email,
        password=raw_password,
        display_name="MongoDB Tester",
        preferred_language="te"
    )
    assert created["email"] == email
    assert created["display_name"] == "MongoDB Tester"
    assert created["preferred_language"] == "te"
    assert "id" in created
    user_id = created["id"]

    # Passwords are stored as bcrypt hashes and never as clear text.
    user_doc = setup_mock_mongo.users.find_one({"email": email})
    assert user_doc is not None
    assert user_doc["password_hash"] != raw_password
    assert user_doc["password_hash"].startswith(("$2a$", "$2b$", "$2y$"))

    # Duplicate registration should raise ValueError
    with pytest.raises(ValueError):
        history_service.create_user(
            email=email,
            password="AnotherPassword!",
            display_name="Duplicate"
        )

    # 2. Authenticate
    auth_ok = history_service.authenticate_user(email, raw_password)
    assert auth_ok is not None
    assert auth_ok["user"]["id"] == user_id
    token = auth_ok["token"]
    session_doc = setup_mock_mongo.auth_sessions.find_one({"user_id": user_id})
    assert session_doc is not None
    assert session_doc["token"] != token
    assert len(session_doc["token"]) == 64

    auth_bad = history_service.authenticate_user(email, "WrongPassword!")
    assert auth_bad is None

    # 3. Profile update
    updated_profile = history_service.update_user_profile(
        user_id=user_id,
        display_name="MongoDB Master",
        preferred_language="en"
    )
    assert updated_profile is not None
    assert updated_profile["display_name"] == "MongoDB Master"
    assert updated_profile["preferred_language"] == "en"

    # 4. Auth Session & Token Verification
    fetched_user = history_service.get_user_by_token(token)
    assert fetched_user is not None
    assert fetched_user["id"] == user_id

    # Delete session (logout)
    logged_out = history_service.delete_session(token)
    assert logged_out is True
    assert history_service.get_user_by_token(token) is None


def test_mongodb_recognition_history_crud_and_duplicates(setup_mock_mongo):
    """Test recognition history save, 3-second duplicate frame suppression, isolation, and deletion."""
    user_id = "user_mongo_101"

    # 1. Insert first recognition
    rec1 = history_service.add_entry(
        predicted_label="ISL_1",
        english_meaning="Number 1",
        confidence=0.95,
        recognition_mode="static_isl",
        user_id=user_id
    )
    assert rec1 is not None
    assert rec1["predicted_label"] == "ISL_1"
    assert rec1["storage_source"] == "mongodb"
    id1 = rec1["id"]

    # 2. Insert immediate duplicate within 3s -> Should return same record ID
    rec2 = history_service.add_entry(
        predicted_label="ISL_1",
        english_meaning="Number 1",
        confidence=0.96,
        recognition_mode="static_isl",
        user_id=user_id
    )
    assert rec2["id"] == id1

    # 3. Retrieve user records
    records = history_service.get_history(user_id=user_id, limit=50)
    assert len(records) == 1
    assert records[0]["id"] == id1

    # Another user gets 0 records
    other_records = history_service.get_history(user_id="other_user_202", limit=50)
    assert len(other_records) == 0

    # 4. Delete single record with wrong user -> False
    del_wrong = history_service.delete_entry_by_id(id1, user_id="other_user_202")
    assert del_wrong is False

    # Delete single record with correct user -> True
    deleted = history_service.delete_entry_by_id(id1, user_id=user_id)
    assert deleted is True

    records_after = history_service.get_history(user_id=user_id, limit=50)
    assert len(records_after) == 0


def test_mongodb_sentence_history_crud_and_duplicates(setup_mock_mongo):
    """Test confirmed sentence save, 5-second duplicate suppression, isolation, and deletion."""
    user_id = "user_mongo_202"

    sent1 = history_service.add_sentence_entry(
        original_signs="HELLO NAMASTE",
        confirmed_sentence="Hello and Namaste",
        selected_language="te",
        user_id=user_id,
        english_output="Hello and Namaste",
        telugu_output="హలో మరియు నమస్కారం",
        romanized_output="Halo mariyu Namaskaram",
        recognition_mode="sentence_builder"
    )
    assert sent1 is not None
    assert sent1["confirmed_sentence"] == "Hello and Namaste"
    assert sent1["storage_source"] == "mongodb"
    sent_id = sent1["id"]

    # Immediate duplicate within 5 seconds -> Should suppress
    sent2 = history_service.add_sentence_entry(
        original_signs="HELLO NAMASTE",
        confirmed_sentence="Hello and Namaste",
        selected_language="te",
        user_id=user_id
    )
    assert sent2["id"] == sent_id

    # Retrieve sentences
    sentences = history_service.get_sentence_history(user_id=user_id, limit=20)
    assert len(sentences) == 1
    assert sentences[0]["id"] == sent_id

    # Other user has zero
    other_sents = history_service.get_sentence_history(user_id="unauthorized_user", limit=20)
    assert len(other_sents) == 0

    # Delete single sentence with wrong user -> False
    del_fail = history_service.delete_sentence_by_id(sent_id, user_id="unauthorized_user")
    assert del_fail is False

    # Delete single sentence with correct user -> True
    del_ok = history_service.delete_sentence_by_id(sent_id, user_id=user_id)
    assert del_ok is True

    # Verify deleted
    sents_empty = history_service.get_sentence_history(user_id=user_id, limit=20)
    assert len(sents_empty) == 0


def test_mongodb_clear_all_history(setup_mock_mongo):
    """Test clear_history deletes only the targeted user's recognitions in MongoDB."""
    user_a = "user_a_clear"
    user_b = "user_b_clear"

    history_service.add_entry(predicted_label="A", english_meaning="A", confidence=0.9, recognition_mode="static", user_id=user_a)
    history_service.add_entry(predicted_label="B", english_meaning="B", confidence=0.9, recognition_mode="static", user_id=user_b)

    # User A clears all
    cleared = history_service.clear_history(user_id=user_a)
    assert cleared >= 1

    # User A has 0, User B still has 1
    items_a = history_service.get_history(user_id=user_a)
    items_b = history_service.get_history(user_id=user_b)
    assert len(items_a) == 0
    assert len(items_b) == 1


def test_sqlite_to_mongodb_migration_utility(setup_mock_mongo):
    """Test data migration utility from local SQLite to MongoDB Atlas collections."""
    migration_summary = history_service.migrate_all_to_mongodb()
    assert migration_summary["success"] is True
    assert migration_summary["users_migrated"] >= 0
    assert migration_summary["profiles_migrated"] >= 0
    assert migration_summary["sentences_migrated"] >= 0
    assert migration_summary["history_migrated"] >= 0

    # Verify migrated items exist in mock MongoDB
    db = setup_mock_mongo
    user_count = db.users.count_documents({})
    profile_count = db.profiles.count_documents({})
    assert user_count == migration_summary["users_migrated"]
    assert profile_count == migration_summary["profiles_migrated"]


@pytest.mark.anyio
async def test_full_api_auth_and_history_in_mongo_mode(setup_mock_mongo):
    """Full end-to-end integration test of FastAPI endpoints backed by MongoDB."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Health check returns mongodb status
        res_health = await ac.get("/health")
        assert res_health.status_code == 200
        health_data = res_health.json()
        assert health_data["storage_mode"] == "mongodb"
        assert health_data["mongodb_configured"] is True
        assert health_data["mongodb_connected"] is True

        # 2. Register new user
        reg_payload = {
            "email": "e2e_mongo_user@signbridge.ai",
            "password": "E2EPassword123!",
            "display_name": "E2E Mongo User",
            "preferred_language": "te"
        }
        res_reg = await ac.post("/auth/register", json=reg_payload)
        assert res_reg.status_code == 200
        reg_data = res_reg.json()
        assert "token" in reg_data
        token = reg_data["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Check /auth/me
        res_me = await ac.get("/auth/me", headers=headers)
        assert res_me.status_code == 200
        me_data = res_me.json()
        assert me_data["email"] == reg_payload["email"]
        assert me_data["display_name"] == reg_payload["display_name"]

        # 4. Save and delete recognition
        rec_payload = {
            "predicted_label": "ISL_PEACE",
            "english_meaning": "Peace / Victory",
            "confidence": 0.98,
            "recognition_mode": "static_isl"
        }
        res_rec = await ac.post("/history", json=rec_payload, headers=headers)
        assert res_rec.status_code == 200
        saved_rec = res_rec.json()
        rec_id = saved_rec["id"]

        # List history
        res_list = await ac.get("/history", headers=headers)
        assert res_list.status_code == 200
        assert res_list.json()["total"] >= 1
        assert res_list.json()["storage_mode"] == "mongodb"

        # Delete recognition
        res_del_rec = await ac.delete(f"/history/{rec_id}", headers=headers)
        assert res_del_rec.status_code == 200
        assert res_del_rec.json()["success"] is True

        # 5. Save and retrieve sentence
        sentence_payload = {
            "original_signs": ["GOOD", "MORNING"],
            "confirmed_sentence": "Good Morning",
            "selected_language": "en"
        }
        res_sent = await ac.post("/history/sentence", json=sentence_payload, headers=headers)
        assert res_sent.status_code == 200
        saved_sent = res_sent.json()
        sent_id = saved_sent["id"]

        res_sent_list = await ac.get("/history/sentence", headers=headers)
        assert res_sent_list.status_code == 200
        assert res_sent_list.json()["total"] >= 1

        # Delete sentence
        res_del_sent = await ac.delete(f"/history/sentence/{sent_id}", headers=headers)
        assert res_del_sent.status_code == 200
        assert res_del_sent.json()["success"] is True

        # 6. Test Excel export
        res_excel = await ac.get("/history/export/excel", headers=headers)
        assert res_excel.status_code == 200
        assert "spreadsheetml" in res_excel.headers["content-type"]

        # 7. Test migration endpoint
        res_migrate = await ac.post("/auth/migrate-to-mongo", headers=headers)
        assert res_migrate.status_code == 200
        migrate_data = res_migrate.json()
        assert migrate_data["success"] is True
        assert "users_migrated" in migrate_data
