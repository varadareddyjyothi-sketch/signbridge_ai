import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.vocabulary_service import vocabulary_service
from backend.app.services.model_registry_service import model_registry_service
from backend.app.services.sentence_service import sentence_service

client = TestClient(app)


def test_vocabulary_listing():
    """Verify vocabulary returns multilingual translations and readiness metadata."""
    response = client.get("/vocabulary")
    assert response.status_code == 200
    data = response.json()
    assert "gestures" in data
    assert data["total_gestures"] >= 10

    # Verify Telugu script and Romanized fields exist on ISL_1 and ISL_5
    isl_1 = next((g for g in data["gestures"] if g["id"] == "ISL_1"), None)
    assert isl_1 is not None
    assert isl_1["telugu"] == "సంఖ్య 1 / ఒకటి"
    assert isl_1["telugu_romanized"] == "Sankhya 1 / Okati"
    assert "readiness" in isl_1

    isl_5 = next((g for g in data["gestures"] if g["id"] == "ISL_5"), None)
    assert isl_5 is not None
    assert "ఐదు" in isl_5["telugu"]

    open_palm = next((g for g in data["gestures"] if g["id"] == "Open_Palm"), None)
    assert open_palm is not None
    assert "నమస్కారం" in open_palm["telugu"]


def test_vocabulary_create_and_delete_custom_gesture():
    """Verify adding a new custom gesture dynamically without code changes."""
    import uuid
    test_id = f"TEST_SIGN_{uuid.uuid4().hex[:6].upper()}"

    new_gesture = {
        "id": test_id,
        "name": "Custom Test Sign",
        "telugu": "పరీక్ష సంకేతం",
        "telugu_romanized": "Pareeksha Sanketham",
        "gesture_type": "static",
        "description": "A test gesture to verify dynamic vocabulary addition"
    }

    try:
        # Create
        create_res = client.post("/vocabulary", json=new_gesture)
        assert create_res.status_code == 201
        created_data = create_res.json()
        assert created_data["success"] is True
        assert created_data["gesture"]["id"] == test_id
        # Newly added gesture with 0 samples MUST have readiness "needs_data"
        assert created_data["gesture"]["readiness"] == "needs_data"

        # Verify listing contains it
        list_res = client.get("/vocabulary")
        assert any(g["id"] == test_id for g in list_res.json()["gestures"])
    finally:
        # Delete safely
        del_res = client.delete(f"/vocabulary/{test_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

    # Verify deletion
    list_after = client.get("/vocabulary")
    assert not any(g["id"] == test_id for g in list_after.json()["gestures"])


def test_model_version_registry():
    """Verify model version listing and version rollback support."""
    res = client.get("/models/versions")
    assert res.status_code == 200
    data = res.json()
    assert "versions" in data
    assert len(data["versions"]) >= 1
    v1 = next((v for v in data["versions"] if v["version"] == "v1.0.0"), None)
    assert v1 is not None
    assert v1["test_accuracy"] >= 0.80

    # Test activating valid version
    act_res = client.post("/models/activate", json={"version": "v1.0.0"})
    assert act_res.status_code == 200
    assert act_res.json()["success"] is True
    assert act_res.json()["activated_version"] == "v1.0.0"

    # Test activating non-existent version
    bad_res = client.post("/models/activate", json={"version": "v999.0.0"})
    assert bad_res.status_code == 404


def test_sentence_translation():
    """Verify sequence accumulation and translation to English and Telugu."""
    # Test multi-sign sequence
    payload = {
        "tokens": ["ISL_1", "ISL_OK"]
    }
    res = client.post("/translate/sentence", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "english" in data
    assert "telugu" in data
    assert "telugu_romanized" in data
    assert len(data["english"]) > 0
    assert len(data["telugu"]) > 0

    # Test empty tokens rejection
    empty_res = client.post("/translate/sentence", json={"tokens": []})
    assert empty_res.status_code == 400


def test_prediction_endpoint_multilingual():
    """Verify predict endpoint includes Telugu translations in response."""
    # Dummy 63-dimensional feature array for 21 hand landmarks
    dummy_features = [0.0] * 63
    payload = {
        "features": dummy_features,
        "handedness": "Right",
        "confidence_threshold": 0.5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "telugu" in data
    assert "telugu_romanized" in data
    assert "gesture_type" in data
    assert "model_version" in data
