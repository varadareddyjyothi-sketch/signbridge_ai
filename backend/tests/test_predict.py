"""
Backend API Tests - Prediction and Model Status Endpoints
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from ml.features import NUM_LANDMARKS


def make_test_landmarks():
    return [{"x": float(i * 0.04), "y": float(i * 0.05), "z": 0.01} for i in range(NUM_LANDMARKS)]


@pytest.mark.anyio
async def test_model_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/model/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "classes" in data
    assert len(data["classes"]) >= 2


@pytest.mark.anyio
async def test_predict_with_valid_landmarks():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "landmarks": make_test_landmarks(),
            "handedness": "Right"
        }
        response = await ac.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is True
    assert data["status"] in ["accepted", "uncertain_rejected"]
    assert data["label"] is not None
    assert data["confidence"] is not None


@pytest.mark.anyio
async def test_predict_with_no_hand():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {}
        response = await ac.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is False
    assert data["status"] == "no_hand"


@pytest.mark.anyio
async def test_predict_with_invalid_landmarks_count():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "landmarks": [{"x": 0.1, "y": 0.2, "z": 0.0}] * 5  # Only 5 landmarks instead of 21
        }
        response = await ac.post("/predict", json=payload)
    assert response.status_code == 422


@pytest.mark.anyio
async def test_predict_missing_model_behavior():
    """Verify that if the model artifact is missing/unloaded, the endpoint responds honestly with status 'model_unavailable'."""
    from backend.app.services.inference_service import inference_service
    original_model = inference_service.model
    try:
        inference_service.model = None
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "landmarks": make_test_landmarks(),
                "handedness": "Right"
            }
            response = await ac.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "model_unavailable"
        assert data["detected"] is False
        assert data["label"] is None
        assert data["confidence"] is None
    finally:
        inference_service.model = original_model


@pytest.mark.anyio
async def test_predict_custom_confidence_threshold():
    """Verify that confidence thresholds reject uncertain gestures."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # With threshold 0.999, typical synthetic input will be rejected
        payload = {
            "landmarks": make_test_landmarks(),
            "handedness": "Right",
            "confidence_threshold": 0.999
        }
        response = await ac.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "uncertain_rejected"
    assert data["rejection_threshold_used"] == 0.999

