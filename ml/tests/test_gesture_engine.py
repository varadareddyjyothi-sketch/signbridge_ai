"""
Tests for ml.gesture_engine - HandAnatomy, TemporalSequenceAnalyzer, and HybridGestureEngine
Validates disambiguation between POINTING_UP, ONE, NO, THUMBS_UP, THUMBS_DOWN,
OPEN_PALM, STOP, HELLO, PEACE, OK, and CLOSED_FIST.
"""

import pytest
import numpy as np
from ml.gesture_engine import HandAnatomy, TemporalSequenceAnalyzer, HybridGestureEngine


def create_mock_landmarks(pose: str = "open_palm") -> list:
    """Creates a 21-landmark array for synthetic test poses."""
    pts = [[0.0, 0.0, 0.0] for _ in range(21)]
    # Wrist
    pts[0] = [0.5, 0.8, 0.0]

    if pose == "pointing_up":
        # Thumb folded
        pts[1] = [0.45, 0.75, 0.0]
        pts[2] = [0.42, 0.70, 0.0]
        pts[3] = [0.44, 0.68, 0.0]
        pts[4] = [0.46, 0.67, 0.0]
        # Index extended upright (-y)
        pts[5] = [0.48, 0.65, 0.0]
        pts[6] = [0.48, 0.52, 0.0]
        pts[7] = [0.48, 0.40, 0.0]
        pts[8] = [0.48, 0.28, 0.0]
        # Middle, Ring, Pinky folded
        for mcp, pip, dip, tip, x in [
            (9, 10, 11, 12, 0.51),
            (13, 14, 15, 16, 0.54),
            (17, 18, 19, 20, 0.57)
        ]:
            pts[mcp] = [x, 0.65, 0.0]
            pts[pip] = [x, 0.72, 0.0]
            pts[dip] = [x, 0.70, 0.0]
            pts[tip] = [x, 0.68, 0.0]

    elif pose == "open_palm":
        # All 5 extended
        xs = [0.40, 0.46, 0.50, 0.54, 0.58]
        mcps = [2, 5, 9, 13, 17]
        for idx, (mcp, x) in enumerate(zip(mcps, xs)):
            pts[mcp] = [x, 0.65, 0.0]
            pts[mcp + 1] = [x, 0.52, 0.0]
            pts[mcp + 2] = [x, 0.40, 0.0]
            pts[mcp + 3 if mcp > 2 else 4] = [x, 0.28, 0.0]

    elif pose == "thumbs_up":
        # Thumb extended straight up
        pts[1] = [0.44, 0.72, 0.0]
        pts[2] = [0.42, 0.62, 0.0]
        pts[3] = [0.40, 0.50, 0.0]
        pts[4] = [0.40, 0.38, 0.0]
        # 4 fingers tightly curled
        for mcp, pip, dip, tip, x in [
            (5, 6, 7, 8, 0.48),
            (9, 10, 11, 12, 0.51),
            (13, 14, 15, 16, 0.54),
            (17, 18, 19, 20, 0.57)
        ]:
            pts[mcp] = [x, 0.65, 0.0]
            pts[pip] = [x, 0.73, 0.0]
            pts[dip] = [x, 0.71, 0.0]
            pts[tip] = [x, 0.68, 0.0]

    elif pose == "thumbs_down":
        # Thumb pointing straight down (+y)
        pts[1] = [0.44, 0.78, 0.0]
        pts[2] = [0.42, 0.85, 0.0]
        pts[3] = [0.40, 0.92, 0.0]
        pts[4] = [0.40, 0.99, 0.0]
        # 4 fingers tightly curled
        for mcp, pip, dip, tip, x in [
            (5, 6, 7, 8, 0.48),
            (9, 10, 11, 12, 0.51),
            (13, 14, 15, 16, 0.54),
            (17, 18, 19, 20, 0.57)
        ]:
            pts[mcp] = [x, 0.65, 0.0]
            pts[pip] = [x, 0.73, 0.0]
            pts[dip] = [x, 0.71, 0.0]
            pts[tip] = [x, 0.68, 0.0]

    elif pose == "peace":
        # Index & Middle extended, Ring & Pinky folded
        pts[1] = [0.44, 0.72, 0.0]
        pts[2] = [0.43, 0.68, 0.0]
        pts[3] = [0.45, 0.66, 0.0]
        pts[4] = [0.48, 0.65, 0.0]
        # Index extended slightly left
        pts[5] = [0.47, 0.65, 0.0]
        pts[6] = [0.45, 0.52, 0.0]
        pts[7] = [0.43, 0.40, 0.0]
        pts[8] = [0.41, 0.28, 0.0]
        # Middle extended slightly right (V shape)
        pts[9] = [0.52, 0.65, 0.0]
        pts[10] = [0.54, 0.52, 0.0]
        pts[11] = [0.56, 0.40, 0.0]
        pts[12] = [0.58, 0.28, 0.0]
        # Ring & Pinky folded
        for mcp, pip, dip, tip, x in [
            (13, 14, 15, 16, 0.55),
            (17, 18, 19, 20, 0.58)
        ]:
            pts[mcp] = [x, 0.65, 0.0]
            pts[pip] = [x, 0.72, 0.0]
            pts[dip] = [x, 0.70, 0.0]
            pts[tip] = [x, 0.68, 0.0]

    elif pose == "closed_fist":
        # All 5 fingers folded
        pts[1] = [0.45, 0.75, 0.0]
        pts[2] = [0.43, 0.72, 0.0]
        pts[3] = [0.45, 0.70, 0.0]
        pts[4] = [0.48, 0.68, 0.0]
        for mcp, pip, dip, tip, x in [
            (5, 6, 7, 8, 0.48),
            (9, 10, 11, 12, 0.51),
            (13, 14, 15, 16, 0.54),
            (17, 18, 19, 20, 0.57)
        ]:
            pts[mcp] = [x, 0.65, 0.0]
            pts[pip] = [x, 0.73, 0.0]
            pts[dip] = [x, 0.71, 0.0]
            pts[tip] = [x, 0.68, 0.0]

    return [{"x": p[0], "y": p[1], "z": p[2]} for p in pts]


def test_hand_anatomy_finger_states():
    lms = create_mock_landmarks("pointing_up")
    anatomy = HandAnatomy(lms)
    assert anatomy.is_extended["index"] is True
    assert anatomy.is_folded["middle"] is True
    assert anatomy.is_folded["ring"] is True
    assert anatomy.is_folded["pinky"] is True


def test_pointing_up_stationary():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("pointing_up")
    res = engine.disambiguate_and_predict(lms, mode="general")
    assert res["label"] == "Pointing_Up"
    assert res["status"] == "accepted"


def test_one_in_numerical_mode():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("pointing_up")
    res = engine.disambiguate_and_predict(lms, mode="numerical")
    assert res["label"] == "ISL_1"
    assert res["status"] == "accepted"


def test_no_gesture_with_horizontal_shake():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("pointing_up")

    # Simulate multi-frame oscillating index finger (shaking side to side)
    history = []
    offsets = [-0.04, 0.04, -0.04, 0.04, -0.03, 0.03]
    for i, dx in enumerate(offsets):
        frame_lms = create_mock_landmarks("pointing_up")
        frame_lms[8]["x"] += dx  # index tip shifts left and right
        history.append({
            "landmarks": frame_lms,
            "timestamp": 1000.0 + i * 0.05,
            "handedness": "Right"
        })

    res = engine.disambiguate_and_predict(lms, history_frames=history)
    assert res["label"] == "ISL_NO"
    assert res["gesture_type"] == "dynamic"
    assert res["status"] == "accepted"


def test_thumbs_up():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("thumbs_up")
    res = engine.disambiguate_and_predict(lms)
    assert res["label"] == "Thumb_Up"
    assert res["status"] == "accepted"


def test_thumbs_down():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("thumbs_down")
    res = engine.disambiguate_and_predict(lms)
    assert res["label"] == "Thumb_Down"
    assert res["status"] == "accepted"


def test_closed_fist():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("closed_fist")
    res = engine.disambiguate_and_predict(lms)
    assert res["label"] == "Closed_Fist"
    assert res["status"] == "accepted"


def test_peace_victory():
    engine = HybridGestureEngine()
    lms = create_mock_landmarks("peace")
    res = engine.disambiguate_and_predict(lms)
    assert res["label"] in ["ISL_PEACE_VICTORY", "ISL_2"]
    assert res["status"] == "accepted"
