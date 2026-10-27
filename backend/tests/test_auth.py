"""
Backend API Tests - Authentication & Profile Endpoints
"""

import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.anyio
async def test_auth_full_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
        password = "SecurePassword123!"
        display_name = "Test Signer"

        # 1. Register new user
        reg_payload = {
            "email": unique_email,
            "password": password,
            "display_name": display_name,
            "preferred_language": "te"
        }
        res_reg = await ac.post("/auth/register", json=reg_payload)
        assert res_reg.status_code == 200
        reg_data = res_reg.json()
        assert "token" in reg_data
        assert reg_data["user"]["email"] == unique_email
        assert reg_data["user"]["display_name"] == display_name
        assert reg_data["user"]["preferred_language"] == "te"

        token = reg_data["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Duplicate registration should fail
        res_dup = await ac.post("/auth/register", json=reg_payload)
        assert res_dup.status_code == 400

        # 3. Get profile (/auth/me) with token
        res_me = await ac.get("/auth/me", headers=headers)
        assert res_me.status_code == 200
        me_data = res_me.json()
        assert me_data["email"] == unique_email
        assert me_data["display_name"] == display_name

        # 4. Update profile
        update_payload = {
            "display_name": "Updated Signer",
            "preferred_language": "ro"
        }
        res_update = await ac.put("/auth/profile", json=update_payload, headers=headers)
        assert res_update.status_code == 200
        updated_data = res_update.json()
        assert updated_data["display_name"] == "Updated Signer"
        assert updated_data["preferred_language"] == "ro"

        # 5. Logout
        res_logout = await ac.post("/auth/logout", headers=headers)
        assert res_logout.status_code == 200

        # 6. /auth/me should now fail after logout
        res_me_after = await ac.get("/auth/me", headers=headers)
        assert res_me_after.status_code == 401

        # 7. Login again with correct credentials
        login_payload = {
            "email": unique_email,
            "password": password
        }
        res_login = await ac.post("/auth/login", json=login_payload)
        assert res_login.status_code == 200
        login_data = res_login.json()
        assert "token" in login_data
        assert login_data["user"]["display_name"] == "Updated Signer"

        # 8. Login with wrong password should fail
        res_wrong_pw = await ac.post("/auth/login", json={
            "email": unique_email,
            "password": "WrongPassword!"
        })
        assert res_wrong_pw.status_code == 401
