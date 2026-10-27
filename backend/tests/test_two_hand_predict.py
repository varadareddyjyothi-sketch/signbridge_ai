"""
Backend API Tests - Dual-Hand ISL Prediction Endpoints
Validates two-hand geometric classification, status reporting, and multilingual mappings.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from ml.features import NUM_LANDMARKS


def create_hand(wrist_x: float, wrist_y: float, index_x: float, index_y: float, middle_x: float, middle_y: float, pinky_x: float, pinky_y: float):
    landmarks = []
    # 0: Wrist
    landmarks.append({"x": wrist_x, "y": wrist_y, "z": 0.0})
    # 1-4: Thumb
    for i in range(1, 5):
        landmarks.append({"x": wrist_x + (index_x - wrist_x) * 0.2 * i, "y": wrist_y + (index_y - wrist_y) * 0.2 * i, "z": 0.0})
    # 5-8: Index (8 is tip)
    for i in range(1, 5):
        landmarks.append({"x": wrist_x + (index_x - wrist_x) * 0.25 * i, "y": wrist_y + (index_y - wrist_y) * 0.25 * i, "z": 0.0})
    # 9-12: Middle (12 is tip)
    for i in range(1, 5):
        landmarks.append({"x": wrist_x + (middle_x - wrist_x) * 0.25 * i, "y": wrist_y + (middle_y - wrist_y) * 0.25 * i, "z": 0.0})
    # 13-16: Ring
    for i in range(1, 5):
        landmarks.append({"x": wrist_x + (pinky_x - wrist_x) * 0.22 * i, "y": wrist_y + (pinky_y - wrist_y) * 0.22 * i, "z": 0.0})
    # 17-20: Pinky (17 is base, 20 is tip)
    for i in range(1, 5):
        landmarks.append({"x": wrist_x + (pinky_x - wrist_x) * 0.25 * i, "y": wrist_y + (pinky_y - wrist_y) * 0.25 * i, "z": 0.0})
    return landmarks


def make_namaste_hands():
    """Both hands joined vertically facing each other at chest level."""
    left = create_hand(wrist_x=0.45, wrist_y=0.60, index_x=0.49, index_y=0.35, middle_x=0.49, middle_y=0.33, pinky_x=0.43, pinky_y=0.40)
    right = create_hand(wrist_x=0.55, wrist_y=0.60, index_x=0.51, index_y=0.35, middle_x=0.51, middle_y=0.33, pinky_x=0.57, pinky_y=0.40)
    return left, right


def make_book_hands():
    """Both open palms joined at pinky edges opening upward."""
    left = create_hand(wrist_x=0.44, wrist_y=0.58, index_x=0.32, index_y=0.45, middle_x=0.34, middle_y=0.43, pinky_x=0.48, pinky_y=0.52)
    right = create_hand(wrist_x=0.56, wrist_y=0.58, index_x=0.68, index_y=0.45, middle_x=0.66, middle_y=0.43, pinky_x=0.52, pinky_y=0.52)
    return left, right


def make_house_hands():
    """Fingertips meeting at apex, wrists spread apart."""
    left = create_hand(wrist_x=0.32, wrist_y=0.65, index_x=0.49, index_y=0.36, middle_x=0.49, middle_y=0.34, pinky_x=0.38, pinky_y=0.45)
    right = create_hand(wrist_x=0.68, wrist_y=0.65, index_x=0.51, index_y=0.36, middle_x=0.51, middle_y=0.34, pinky_x=0.62, pinky_y=0.45)
    return left, right


@pytest.mark.anyio
async def test_predict_two_hand_namaste():
    left, right = make_namaste_hands()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "left_landmarks": left,
            "right_landmarks": right,
            "confidence_threshold": 0.60
        }
        response = await ac.post("/predict/two-hand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is True
    assert data["label"] == "ISL_NAMASTE_2HAND"
    assert data["status"] == "accepted"
    assert data["is_verified_isl"] is True
    assert data["hands_detected"] == 2
    assert "నమస్కారం" in (data.get("telugu") or "")


@pytest.mark.anyio
async def test_predict_two_hand_book():
    left, right = make_book_hands()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "left_landmarks": left,
            "right_landmarks": right,
            "confidence_threshold": 0.60
        }
        response = await ac.post("/predict/two-hand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is True
    assert data["label"] == "ISL_BOOK"
    assert data["status"] == "accepted"
    assert data["is_verified_isl"] is True
    assert data["hands_detected"] == 2


@pytest.mark.anyio
async def test_predict_two_hand_house():
    left, right = make_house_hands()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "left_landmarks": left,
            "right_landmarks": right,
            "confidence_threshold": 0.60
        }
        response = await ac.post("/predict/two-hand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is True
    assert data["label"] == "ISL_HOUSE"
    assert data["status"] == "accepted"
    assert data["is_verified_isl"] is True
    assert data["hands_detected"] == 2


@pytest.mark.anyio
async def test_predict_unified_endpoint_two_hands():
    left, right = make_namaste_hands()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "hands_count": 2,
            "two_hand_landmarks": {
                "left": left,
                "right": right
            },
            "confidence_threshold": 0.60
        }
        response = await ac.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is True
    assert data["label"] == "ISL_NAMASTE_2HAND"
    assert data["hands_detected"] == 2


@pytest.mark.anyio
async def test_predict_two_hand_unclassified_pose():
    # Hands completely separated and arbitrary: should NOT fabricate an ISL sign
    left = create_hand(wrist_x=0.10, wrist_y=0.80, index_x=0.12, index_y=0.40, middle_x=0.14, middle_y=0.38, pinky_x=0.18, pinky_y=0.45)
    right = create_hand(wrist_x=0.90, wrist_y=0.80, index_x=0.88, index_y=0.40, middle_x=0.86, middle_y=0.38, pinky_x=0.82, pinky_y=0.45)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "left_landmarks": left,
            "right_landmarks": right,
            "confidence_threshold": 0.70
        }
        response = await ac.post("/predict/two-hand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["detected"] is True
    assert data["status"] == "uncertain_rejected"
    assert data["hands_detected"] == 2
    assert "Two hands detected" in data["english_meaning"]
