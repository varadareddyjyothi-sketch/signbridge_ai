"""
Backend API Tests - Dataset Management, Sample Logging, Validation, and Export
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from ml.features import FEATURE_DIMENSION


@pytest.mark.anyio
async def test_dataset_stats():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/dataset/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_samples" in data
    assert "class_counts" in data
    assert data["total_samples"] >= 0


@pytest.mark.anyio
async def test_dataset_validate():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/dataset/validate")
    assert response.status_code == 200
    data = response.json()
    assert "is_valid" in data
    assert "status" in data
    assert "total_samples" in data
    assert "classes_count" in data
    assert "recommendation" in data


@pytest.mark.anyio
async def test_dataset_export():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/dataset/export")
    # Dataset file exists, so it should return 200 with text/csv
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        assert "text/csv" in response.headers["content-type"]
        assert len(response.text) > 0


@pytest.mark.anyio
async def test_dataset_sample_invalid_dimension():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Invalid 10 features instead of 63
        payload = {
            "label": "ISL_1",
            "features": [0.1] * 10
        }
        response = await ac.post("/dataset/sample", json=payload)
    assert response.status_code == 422
