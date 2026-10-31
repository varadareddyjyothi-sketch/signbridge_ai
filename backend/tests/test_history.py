"""Backend API tests for persistent history and authenticated user isolation."""

import uuid

import mongomock
import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.database.mongo_client import set_mock_mongo_db
from backend.app.main import app


@pytest.fixture(autouse=True)
def isolated_mongo():
    client = mongomock.MongoClient()
    set_mock_mongo_db(client["signbridge_ai"])
    yield
    set_mock_mongo_db(None)
    client.close()


@pytest.mark.anyio
async def test_history_crud_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": f"history_{uuid.uuid4().hex}@example.com",
                "password": "Password123!",
                "display_name": "History User",
            },
        )
        assert registered.status_code == 200
        payload = {
            "predicted_label": "ISL_1",
            "english_meaning": "Number 1",
            "confidence": 0.945,
            "recognition_mode": "static_isl",
        }
        saved = await client.post("/history", json=payload)
        assert saved.status_code == 200
        item = saved.json()
        assert item["predicted_label"] == "ISL_1"
        assert item["confidence"] == 0.945
        assert item["id"]

        retrieved = await client.get("/history?limit=10")
        assert retrieved.status_code == 200
        assert any(entry["id"] == item["id"] for entry in retrieved.json()["items"])

        cleared = await client.delete("/history")
        assert cleared.status_code == 200
        assert cleared.json()["success"] is True
        assert (await client.get("/history")).json()["total"] == 0


@pytest.mark.anyio
async def test_history_single_delete_and_user_isolation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as user_a:
        email_a = f"hist_a_{uuid.uuid4().hex}@example.com"
        registered_a = await user_a.post(
            "/auth/register",
            json={
                "email": email_a,
                "password": "Password123!",
                "display_name": "Hist User Alpha",
                "preferred_language": "en",
            },
        )
        assert registered_a.status_code == 200

        async with AsyncClient(transport=transport, base_url="http://test") as user_b:
            registered_b = await user_b.post(
                "/auth/register",
                json={
                    "email": f"hist_b_{uuid.uuid4().hex}@example.com",
                    "password": "Password123!",
                    "display_name": "Hist User Beta",
                    "preferred_language": "te",
                },
            )
            assert registered_b.status_code == 200

            saved = await user_a.post(
                "/history",
                json={
                    "predicted_label": "ISL_5",
                    "english_meaning": "Number 5",
                    "confidence": 0.96,
                    "recognition_mode": "custom_isl_rf",
                },
            )
            assert saved.status_code == 200
            item = saved.json()
            assert item["user_id"] is not None

            user_b_history = await user_b.get("/history")
            assert user_b_history.status_code == 200
            assert item["id"] not in [row["id"] for row in user_b_history.json()["items"]]

            forbidden_delete = await user_b.delete(f"/history/{item['id']}")
            assert forbidden_delete.status_code == 404

            user_a_history = await user_a.get("/history")
            assert item["id"] in [row["id"] for row in user_a_history.json()["items"]]

            deleted = await user_a.delete(f"/history/{item['id']}")
            assert deleted.status_code == 200
            assert deleted.json()["success"] is True


@pytest.mark.anyio
async def test_history_duplicate_suppression():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        registered = await client.post(
            "/auth/register",
            json={
                "email": f"duplicate_{uuid.uuid4().hex}@example.com",
                "password": "Password123!",
                "display_name": "Duplicate User",
            },
        )
        assert registered.status_code == 200
        payload = {
            "predicted_label": "HELLO",
            "english_meaning": "Hello / Greetings",
            "confidence": 0.92,
            "recognition_mode": "pretrained_mediapipe",
        }
        first = await client.post("/history", json=payload)
        second = await client.post("/history", json=payload)
        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json()["id"] == second.json()["id"]
        await client.delete(f"/history/{first.json()['id']}")
