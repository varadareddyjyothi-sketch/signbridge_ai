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
