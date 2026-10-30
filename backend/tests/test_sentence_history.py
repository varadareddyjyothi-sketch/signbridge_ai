"""
Backend API Tests - Sentence History & User Isolation
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.anyio
async def test_sentence_history_and_isolation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create User A
        email_a = f"usera_{uuid.uuid4().hex[:8]}@example.com"
        res_a = await ac.post("/auth/register", json={
            "email": email_a,
            "password": "Password123!",
            "display_name": "User Alpha",
            "preferred_language": "en"
        })
        token_a = res_a.json()["token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Create User B
        email_b = f"userb_{uuid.uuid4().hex[:8]}@example.com"
        res_b = await ac.post("/auth/register", json={
            "email": email_b,
            "password": "Password123!",
            "display_name": "User Beta",
            "preferred_language": "te"
        })
        token_b = res_b.json()["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User A saves a sentence
        sentence_a = {
            "original_signs": ["HELLO", "NAMASTE"],
            "confirmed_sentence": "Hello Namaste",
            "english_output": "Hello Namaste",
            "telugu_output": "హలో నమస్కారం",
            "romanized_telugu": "Halo Namaskaram",
            "selected_language": "te",
            "recognition_mode": "sentence_builder"
        }
        res_save_a = await ac.post("/history/sentence", json=sentence_a, headers=headers_a)
        assert res_save_a.status_code == 200
        saved_a = res_save_a.json()
        assert saved_a["confirmed_sentence"] == "Hello Namaste"
        assert saved_a["user_id"] is not None

        # User B queries sentences -> User B should NOT see User A's sentence
        res_list_b = await ac.get("/history/sentence", headers=headers_b)
        assert res_list_b.status_code == 200
        data_b = res_list_b.json()
        assert data_b["total"] == 0
        assert len(data_b["items"]) == 0

        # User A queries sentences -> User A sees their sentence
        res_list_a = await ac.get("/history/sentence", headers=headers_a)
        assert res_list_a.status_code == 200
        data_a = res_list_a.json()
        assert data_a["total"] >= 1
        assert any(item["id"] == saved_a["id"] for item in data_a["items"])

        # User A clears their sentence history
        res_clear_a = await ac.delete("/history/sentence", headers=headers_a)
        assert res_clear_a.status_code == 200
        assert res_clear_a.json()["success"] is True

        # Verify User A now has 0 sentences
        res_after_a = await ac.get("/history/sentence", headers=headers_a)
        assert res_after_a.json()["total"] == 0


@pytest.mark.anyio
async def test_single_sentence_delete_and_security():
    import uuid
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email_1 = f"s1_{uuid.uuid4().hex[:8]}@example.com"
        res_1 = await ac.post("/auth/register", json={
            "email": email_1, "password": "Password123!", "display_name": "S1", "preferred_language": "en"
        })
        token_1 = res_1.json()["token"]
        headers_1 = {"Authorization": f"Bearer {token_1}"}

        email_2 = f"s2_{uuid.uuid4().hex[:8]}@example.com"
        res_2 = await ac.post("/auth/register", json={
            "email": email_2, "password": "Password123!", "display_name": "S2", "preferred_language": "en"
        })
        token_2 = res_2.json()["token"]
        headers_2 = {"Authorization": f"Bearer {token_2}"}

        # User 1 creates sentence
        res_post = await ac.post("/history/sentence", json={
            "original_signs": ["WATER"],
            "confirmed_sentence": "I want water",
            "english_output": "I want water",
            "selected_language": "en"
        }, headers=headers_1)
        assert res_post.status_code == 200
        sentence_id = res_post.json()["id"]

        # User 2 tries to delete User 1's sentence -> 404 unauthorized
        res_del_hack = await ac.delete(f"/history/sentence/{sentence_id}", headers=headers_2)
        assert res_del_hack.status_code == 404

        # User 1 deletes their sentence -> 200 OK
        res_del_ok = await ac.delete(f"/history/sentence/{sentence_id}", headers=headers_1)
        assert res_del_ok.status_code == 200
        assert res_del_ok.json()["success"] is True
