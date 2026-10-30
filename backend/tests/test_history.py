"""
Backend API Tests - History Persistence Endpoints
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.anyio
async def test_history_crud_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Insert history item
        payload = {
            "predicted_label": "ISL_1",
            "english_meaning": "Number 1",
            "confidence": 0.9450,
            "recognition_mode": "static_isl"
        }
        res_post = await ac.post("/history", json=payload)
        assert res_post.status_code == 200
        saved_item = res_post.json()
        assert saved_item["predicted_label"] == "ISL_1"
        assert saved_item["confidence"] == 0.9450
        assert "id" in saved_item

        # 2. Retrieve history items
        res_get = await ac.get("/history?limit=10")
        assert res_get.status_code == 200
        history_data = res_get.json()
        assert history_data["total"] >= 1
        assert any(item["id"] == saved_item["id"] for item in history_data["items"])

        # 3. Clear history
        res_del = await ac.delete("/history")
        assert res_del.status_code == 200
        del_data = res_del.json()
        assert del_data["success"] is True

        # 4. Verify cleared
        res_get_after = await ac.get("/history")
        assert res_get_after.status_code == 200
        assert res_get_after.json()["total"] == 0


@pytest.mark.anyio
async def test_history_single_delete_and_isolation():
    import uuid
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create User A
        email_a = f"hist_a_{uuid.uuid4().hex[:8]}@example.com"
        res_a = await ac.post("/auth/register", json={
            "email": email_a,
            "password": "Password123!",
            "display_name": "Hist User Alpha",
            "preferred_language": "en"
        })
        token_a = res_a.json()["token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Create User B
        email_b = f"hist_b_{uuid.uuid4().hex[:8]}@example.com"
        res_b = await ac.post("/auth/register", json={
            "email": email_b,
            "password": "Password123!",
            "display_name": "Hist User Beta",
            "preferred_language": "te"
        })
        token_b = res_b.json()["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User A saves a recognition
        payload_a = {
            "predicted_label": "ISL_5",
            "english_meaning": "Number 5",
            "confidence": 0.96,
            "recognition_mode": "custom_isl_rf"
        }
        res_save = await ac.post("/history", json=payload_a, headers=headers_a)
        assert res_save.status_code == 200
        item_a = res_save.json()
        assert item_a["predicted_label"] == "ISL_5"
        assert item_a["user_id"] is not None

        # User B queries history -> must be isolated (0 items)
        res_list_b = await ac.get("/history", headers=headers_b)
        assert res_list_b.status_code == 200
        assert len(res_list_b.json()["items"]) == 0

        # User B tries to delete User A's record -> must fail with 404
        res_del_unauth = await ac.delete(f"/history/{item_a['id']}", headers=headers_b)
        assert res_del_unauth.status_code == 404

        # User A queries history -> sees their item
        res_list_a = await ac.get("/history", headers=headers_a)
        assert res_list_a.status_code == 200
        assert any(x["id"] == item_a["id"] for x in res_list_a.json()["items"])

        # User A deletes their single record -> succeeds
        res_del_ok = await ac.delete(f"/history/{item_a['id']}", headers=headers_a)
        assert res_del_ok.status_code == 200
        assert res_del_ok.json()["success"] is True

        # User A verifies it is gone
        res_list_a_after = await ac.get("/history", headers=headers_a)
        assert res_list_a_after.status_code == 200
        assert not any(x["id"] == item_a["id"] for x in res_list_a_after.json()["items"])


@pytest.mark.anyio
async def test_history_duplicate_suppression():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "predicted_label": "HELLO",
            "english_meaning": "Hello / Greetings",
            "confidence": 0.92,
            "recognition_mode": "pretrained_mediapipe"
        }
        # First save
        res1 = await ac.post("/history", json=payload)
        assert res1.status_code == 200
        item1 = res1.json()

        # Immediate second save (duplicate frame within 3 seconds)
        res2 = await ac.post("/history", json=payload)
        assert res2.status_code == 200
        item2 = res2.json()

        # Should suppress duplicate and reuse existing record ID
        assert item1["id"] == item2["id"]

        # Clean up
        await ac.delete(f"/history/{item1['id']}")
