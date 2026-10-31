"""Backend API tests for cookie-based authentication and user sessions."""

import uuid
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import mongomock
import pytest
from httpx import ASGITransport, AsyncClient

import backend.app.database.history_service as history_service_module
import backend.app.database.mongo_client as mongo_client_module
from backend.app.config import settings
from backend.app.database.mongo_client import set_mock_mongo_db
from backend.app.database.local_storage import (
    authenticate_user,
    get_db_connection,
    hash_session_token,
    init_local_db,
)
from backend.app.main import app


@pytest.fixture(autouse=True)
def isolated_mongo():
    client = mongomock.MongoClient()
    set_mock_mongo_db(client["signbridge_ai"])
    yield client["signbridge_ai"]
    set_mock_mongo_db(None)
    client.close()


@pytest.mark.anyio
async def test_auth_full_lifecycle(isolated_mongo):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = f"user_{uuid.uuid4().hex}@example.com"
        password = "SecurePassword123!"
        registration = {
            "email": email,
            "password": password,
            "display_name": "Test Signer",
            "preferred_language": "te",
        }

        response = await client.post("/auth/register", json=registration)
        assert response.status_code == 200
        user = response.json()["user"]
        assert user["email"] == email
        assert user["display_name"] == "Test Signer"
        assert user["preferred_language"] == "te"
        assert "token" not in response.json()
        assert "httponly" in response.headers["set-cookie"].lower()

        user_doc = isolated_mongo.users.find_one({"email": email})
        assert user_doc is not None
        assert user_doc["password_hash"] != password
        assert bcrypt.checkpw(password.encode(), user_doc["password_hash"].encode())
        session = isolated_mongo.auth_sessions.find_one({"user_id": user_doc["id"]})
        assert session is not None
        assert session["token"] != client.cookies.get("signbridge_session")
        assert len(session["token"]) == 64

        duplicate = await client.post("/auth/register", json=registration)
        assert duplicate.status_code == 400

        profile = await client.get("/auth/me")
        assert profile.status_code == 200
        assert profile.json()["email"] == email

        updated = await client.put(
            "/auth/profile",
            json={"display_name": "Updated Signer", "preferred_language": "ro"},
        )
        assert updated.status_code == 200
        assert updated.json()["display_name"] == "Updated Signer"
        assert updated.json()["preferred_language"] == "ro"

        logout = await client.post("/auth/logout")
        assert logout.status_code == 200
        assert (await client.get("/auth/me")).status_code == 401

        login = await client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )
        assert login.status_code == 200
        assert login.json()["user"]["display_name"] == "Updated Signer"
        assert "httponly" in login.headers["set-cookie"].lower()

        wrong_password = await client.post(
            "/auth/login",
            json={"email": email, "password": "WrongPassword!"},
        )
        assert wrong_password.status_code == 401


@pytest.mark.anyio
async def test_auth_validation_and_unauthenticated_access():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        invalid_email = await client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePassword123!",
                "display_name": "Invalid",
            },
        )
        assert invalid_email.status_code == 422

        weak_password = await client.post(
            "/auth/register",
            json={
                "email": f"weak_{uuid.uuid4().hex}@example.com",
                "password": "short",
                "display_name": "Weak",
            },
        )
        assert weak_password.status_code == 422

        missing_password = await client.post(
            "/auth/login",
            json={"email": f"missing_{uuid.uuid4().hex}@example.com"},
        )
        assert missing_password.status_code == 422

        unknown_user = await client.post(
            "/auth/login",
            json={
                "email": f"missing_{uuid.uuid4().hex}@example.com",
                "password": "SecurePassword123!",
            },
        )
        assert unknown_user.status_code == 401
        assert (await client.get("/auth/me")).status_code == 401
        assert (await client.get("/history")).status_code == 401


@pytest.mark.anyio
async def test_invalid_and_expired_sessions_are_rejected(isolated_mongo):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        registration = await client.post(
            "/auth/register",
            json={
                "email": f"expiry_{uuid.uuid4().hex}@example.com",
                "password": "SecurePassword123!",
                "display_name": "Expiry Test",
            },
        )
        assert registration.status_code == 200
        user_id = registration.json()["user"]["id"]
        session = isolated_mongo.auth_sessions.find_one({"user_id": user_id})
        isolated_mongo.auth_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}},
        )
        assert (await client.get("/auth/me")).status_code == 401

        client.cookies.set("signbridge_session", "invalid-session-token")
        assert (await client.get("/auth/me")).status_code == 401


@pytest.mark.anyio
async def test_auth_mutations_reject_untrusted_browser_origins():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/auth/register",
            headers={"Origin": "https://untrusted.example"},
            json={
                "email": f"origin_{uuid.uuid4().hex}@example.com",
                "password": "SecurePassword123!",
                "display_name": "Origin Test",
            },
        )
    assert response.status_code == 403


def test_legacy_pbkdf2_password_is_upgraded_and_session_token_is_hashed(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "SQLITE_DB_PATH", str(tmp_path / "auth.sqlite3"))
    password = "LegacyPassword123!"
    salt = "legacy-salt"
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100000
    ).hex()
    init_local_db()
    with get_db_connection() as connection:
        connection.execute(
            """INSERT INTO users (
                   id, email, password_hash, salt, display_name, preferred_language, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            ("legacy-user", "legacy@example.com", password_hash, salt, "Legacy", "en", "now", "now"),
        )

    authenticated = authenticate_user("legacy@example.com", password)
    assert authenticated is not None
    with get_db_connection() as connection:
        stored = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?", ("legacy-user",)
        ).fetchone()
        session = connection.execute(
            "SELECT token FROM auth_sessions WHERE user_id = ?", ("legacy-user",)
        ).fetchone()
    assert stored["password_hash"].startswith(("$2a$", "$2b$", "$2y$"))
    assert session["token"] == hash_session_token(authenticated["token"])


@pytest.mark.anyio
async def test_production_database_outage_returns_503_without_sqlite_fallback(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(history_service_module, "get_mongo_db", lambda: None)
    monkeypatch.setattr(mongo_client_module, "get_mongo_db", lambda: None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        health = await client.get("/health")
        assert health.status_code == 503
        assert health.json()["mongodb_connected"] is False
        response = await client.post(
            "/auth/register",
            json={
                "email": f"outage_{uuid.uuid4().hex}@example.com",
                "password": "SecurePassword123!",
                "display_name": "No Database",
            },
        )
    assert response.status_code == 503
