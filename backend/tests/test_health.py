"""
Backend API Tests - Health & Root Endpoints
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app


@pytest.mark.anyio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert data["app"] == "SignBridge AI"


@pytest.mark.anyio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_status"] in ["trained", "evaluated", "experimental", "unavailable"]
    assert "storage_mode" in data
    assert "mongodb_configured" in data
    assert "mongodb_connected" in data
    assert "timestamp" in data


@pytest.mark.anyio
async def test_unknown_api_route_returns_json_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/not-a-route", headers={"Accept": "text/html"})

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["status_code"] == 404


@pytest.mark.anyio
async def test_missing_asset_is_not_rewritten_to_spa(monkeypatch, tmp_path):
    (tmp_path / "index.html").write_text("<html>app</html>", encoding="utf-8")
    monkeypatch.setattr("backend.app.main.settings.STATIC_DIR", str(tmp_path))
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        page = await ac.get("/recognition", headers={"Accept": "text/html"})
        asset = await ac.get("/assets/missing.js", headers={"Accept": "*/*"})

    assert page.status_code == 200
    assert page.text == "<html>app</html>"
    assert asset.status_code == 404
    assert asset.headers["content-type"].startswith("application/json")
