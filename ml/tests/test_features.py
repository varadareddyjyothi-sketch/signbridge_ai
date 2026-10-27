"""
Unit tests for Landmark Feature Extraction & Normalization
"""

import pytest
import numpy as np
from ml.features import normalize_landmarks, validate_landmarks, FEATURE_DIMENSION, NUM_LANDMARKS


def generate_mock_hand_landmarks(offset=(0.0, 0.0, 0.0), scale=1.0):
    """Generates synthetic 21 hand landmarks."""
    base_points = []
    for i in range(NUM_LANDMARKS):
        # A realistic hand-like tree distribution
        x = (i * 0.05 + offset[0]) * scale
        y = (i * 0.08 + offset[1]) * scale
        z = (np.sin(i) * 0.02 + offset[2]) * scale
        base_points.append({"x": float(x), "y": float(y), "z": float(z)})
    return base_points


def test_valid_landmarks_shape_and_length():
    landmarks = generate_mock_hand_landmarks()
    features = normalize_landmarks(landmarks)
    assert isinstance(features, np.ndarray)
    assert features.shape == (FEATURE_DIMENSION,)
    # Wrist (first 3 coordinates) must be exactly 0.0
    np.testing.assert_allclose(features[0:3], [0.0, 0.0, 0.0], atol=1e-6)


def test_translation_invariance():
    """Shifting the hand in 3D camera space must produce identical features."""
    lm1 = generate_mock_hand_landmarks(offset=(0.0, 0.0, 0.0))
    lm2 = generate_mock_hand_landmarks(offset=(150.0, -82.0, 30.0))

    f1 = normalize_landmarks(lm1)
    f2 = normalize_landmarks(lm2)

    np.testing.assert_allclose(f1, f2, atol=1e-5)


def test_scale_invariance():
    """Moving closer or further from camera (scaling) must produce identical features."""
    lm1 = generate_mock_hand_landmarks(scale=1.0)
    lm2 = generate_mock_hand_landmarks(scale=3.5)

    f1 = normalize_landmarks(lm1)
    f2 = normalize_landmarks(lm2)

    np.testing.assert_allclose(f1, f2, atol=1e-5)


def test_handedness_mirroring():
    """Left hand should mirror x coordinates relative to right hand."""
    lm = generate_mock_hand_landmarks()
    f_right = normalize_landmarks(lm, handedness="Right")
    f_left = normalize_landmarks(lm, handedness="Left")

    # Reshape to (21, 3) to test x coordinates
    pts_r = f_right.reshape((21, 3))
    pts_l = f_left.reshape((21, 3))

    np.testing.assert_allclose(pts_r[:, 0], -pts_l[:, 0], atol=1e-5)
    np.testing.assert_allclose(pts_r[:, 1:], pts_l[:, 1:], atol=1e-5)


def test_invalid_landmarks_rejection():
    # Less than 21 landmarks
    with pytest.raises(ValueError):
        validate_landmarks([{"x": 0.1, "y": 0.2, "z": 0.0}] * 10)

    # Empty
    with pytest.raises(ValueError):
        validate_landmarks([])

    # NaN coordinates
    bad_lms = generate_mock_hand_landmarks()
    bad_lms[5]["x"] = float("nan")
    with pytest.raises(ValueError):
        normalize_landmarks(bad_lms)
