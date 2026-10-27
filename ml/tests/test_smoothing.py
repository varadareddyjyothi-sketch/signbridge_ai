"""
Unit Tests for Temporal Prediction Smoothing Algorithm
Validates sliding window consensus, anti-flicker hysteresis, and dropout handling.
"""

from collections import Counter
from typing import List, Optional, Dict, Any


class TemporalPredictionSmoother:
    """Python mirror of the frontend TemporalPredictionSmoother for testing consensus logic."""
    def __init__(self, window_size: int = 5, min_agreement_ratio: float = 0.60):
        self.window_size = window_size
        self.min_agreement_ratio = min_agreement_ratio
        self.history: List[Dict[str, Any]] = []
        self.last_stable_prediction: Optional[Dict[str, Any]] = None

    def push(self, prediction: Dict[str, Any]) -> Dict[str, Any]:
        self.history.append(prediction)
        if len(self.history) > self.window_size:
            self.history.pop(0)

        # 1. No hand condition
        if not prediction.get("detected"):
            self.last_stable_prediction = None
            return {
                "detected": False,
                "label": None,
                "english_meaning": "Waiting for hand in frame...",
                "confidence": None,
                "status": "no_hand",
                "is_stable": False,
                "agreement_ratio": 0.0,
                "window_size": len(self.history)
            }

        # 2. Check model unavailable
        if prediction.get("status") == "model_unavailable":
            return {
                "detected": True,
                "label": None,
                "english_meaning": "Model not trained / unavailable",
                "confidence": None,
                "status": "model_unavailable",
                "is_stable": False,
                "agreement_ratio": 0.0,
                "window_size": len(self.history)
            }

        # 3. Filter detected frames with valid labels
        detected_frames = [
            f for f in self.history
            if f.get("detected") and f.get("label") and f.get("status") == "accepted"
        ]

        if not detected_frames:
            return {
                "detected": True,
                "label": prediction.get("label"),
                "english_meaning": "Uncertain gesture / transitioning...",
                "confidence": prediction.get("confidence"),
                "status": "uncertain_rejected",
                "is_stable": False,
                "agreement_ratio": 0.0,
                "window_size": len(self.history)
            }

        # Count frequencies
        label_counts = Counter(f["label"] for f in detected_frames)
        dominant_label, dominant_count = label_counts.most_common(1)[0]
        ratio = dominant_count / len(self.history)

        # Average confidence for dominant label
        dom_confidences = [f["confidence"] for f in detected_frames if f.get("label") == dominant_label and f.get("confidence") is not None]
        avg_conf = sum(dom_confidences) / len(dom_confidences) if dom_confidences else (prediction.get("confidence") or 0.0)

        latest_match = next((f for f in reversed(detected_frames) if f.get("label") == dominant_label), prediction)

        if ratio >= self.min_agreement_ratio:
            smoothed = {
                "detected": True,
                "label": dominant_label,
                "english_meaning": latest_match.get("english_meaning", dominant_label),
                "confidence": round(avg_conf, 4),
                "status": "accepted",
                "is_stable": True,
                "agreement_ratio": round(ratio, 2),
                "window_size": len(self.history)
            }
            self.last_stable_prediction = smoothed
            return smoothed

        # If below agreement ratio, hold last stable prediction if available
        if self.last_stable_prediction is not None:
            return {
                **self.last_stable_prediction,
                "is_stable": False,
                "agreement_ratio": round(ratio, 2),
                "window_size": len(self.history)
            }

        return {
            "detected": True,
            "label": dominant_label,
            "english_meaning": "Analyzing gesture...",
            "confidence": round(avg_conf, 4),
            "status": "uncertain_rejected",
            "is_stable": False,
            "agreement_ratio": round(ratio, 2),
            "window_size": len(self.history)
        }


def make_frame(label: Optional[str], confidence: float, status: str = "accepted", detected: bool = True):
    return {
        "detected": detected,
        "label": label,
        "english_meaning": f"Meaning of {label}" if label else None,
        "confidence": confidence,
        "status": status,
        "is_verified_isl": True
    }


def test_smoothing_filters_single_frame_flicker():
    """A single rogue frame in a stream of stable frames should NOT switch the dominant label."""
    smoother = TemporalPredictionSmoother(window_size=5, min_agreement_ratio=0.60)
    
    # Push 4 frames of ISL_1
    for _ in range(4):
        res = smoother.push(make_frame("ISL_1", 0.95))
    assert res["status"] == "accepted"
    assert res["label"] == "ISL_1"
    assert res["is_stable"] is True

    # Push 1 flickering rogue frame of ISL_2
    rogue_res = smoother.push(make_frame("ISL_2", 0.70))
    # ISL_1 is still dominant (4 out of 5 = 80% > 60%)
    assert rogue_res["label"] == "ISL_1"
    assert rogue_res["is_stable"] is True


def test_smoothing_transitions_cleanly_on_sustained_new_sign():
    """When a new gesture is held for the consensus window, it should switch cleanly."""
    smoother = TemporalPredictionSmoother(window_size=5, min_agreement_ratio=0.60)

    # Establish ISL_1
    for _ in range(5):
        smoother.push(make_frame("ISL_1", 0.92))

    # Begin transition to ISL_YES_THUMBS_UP
    smoother.push(make_frame("ISL_YES_THUMBS_UP", 0.88))
    smoother.push(make_frame("ISL_YES_THUMBS_UP", 0.91))
    res3 = smoother.push(make_frame("ISL_YES_THUMBS_UP", 0.94))
    
    # 3 out of 5 frames = 60% -> consensus switches
    assert res3["label"] == "ISL_YES_THUMBS_UP"
    assert res3["status"] == "accepted"
    assert res3["is_stable"] is True


def test_smoothing_resets_on_hand_removal():
    """Removing hand immediately resets consensus and clears state."""
    smoother = TemporalPredictionSmoother(window_size=5, min_agreement_ratio=0.60)

    for _ in range(5):
        smoother.push(make_frame("ISL_OK", 0.95))

    no_hand_res = smoother.push(make_frame(None, 0.0, status="no_hand", detected=False))
    assert no_hand_res["detected"] is False
    assert no_hand_res["status"] == "no_hand"
    assert no_hand_res["label"] is None
    assert no_hand_res["is_stable"] is False
