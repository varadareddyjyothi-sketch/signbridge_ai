"""
SignBridge AI - Model Inference Service
Handles model loading, single-hand Random Forest classification,
dual-hand geometric ISL sign classification, probability estimation,
uncertainty rejection, and human-readable multilingual ISL translation mapping.
"""

import os
import json
import math
import numpy as np
import joblib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from backend.app.config import settings
from ml.features import normalize_landmarks, FEATURE_DIMENSION, NUM_LANDMARKS

VERIFIED_ISL_METADATA: Dict[str, Dict[str, Any]] = {
    "ISL_1": {
        "meaning": "Number 1",
        "description": "Index finger extended upright, other fingers curled.",
        "is_verified": True
    },
    "ISL_2": {
        "meaning": "Number 2",
        "description": "Index and middle fingers extended in a V-shape.",
        "is_verified": True
    },
    "ISL_3": {
        "meaning": "Number 3",
        "description": "Index, middle, and ring fingers extended upward.",
        "is_verified": True
    },
    "ISL_4": {
        "meaning": "Number 4",
        "description": "Four fingers extended upward, thumb folded across palm.",
        "is_verified": True
    },
    "ISL_5": {
        "meaning": "Number 5 / Open Palm",
        "description": "All five fingers open and spread.",
        "is_verified": True
    },
    "ISL_OK": {
        "meaning": "OK / Good",
        "description": "Thumb and index tips touching in a circle, other 3 extended.",
        "is_verified": True
    },
    "ISL_YES_THUMBS_UP": {
        "meaning": "Yes / Affirmative",
        "description": "Fist with thumb pointing upward.",
        "is_verified": True
    },
    "ISL_NO_INDEX": {
        "meaning": "No / Stop",
        "description": "Index finger pointing upright in a firm stance.",
        "is_verified": True
    },
    "ISL_PEACE_VICTORY": {
        "meaning": "Peace / Victory",
        "description": "V-sign palm forward, thumb over folded fingers.",
        "is_verified": True
    },
    "ISL_FIST": {
        "meaning": "Closed Fist (Letter S)",
        "description": "All fingers tightly curled into a closed fist.",
        "is_verified": True
    },
    "ISL_NAMASTE_2HAND": {
        "meaning": "Namaste (Two-Hand Greeting)",
        "description": "Both palms joined flat together facing inward at chest level.",
        "is_verified": True
    },
    "ISL_BOOK": {
        "meaning": "Book / Study (Two-Hand Sign)",
        "description": "Both open palms joined at pinky edges opening upward like a book.",
        "is_verified": True
    },
    "ISL_HOUSE": {
        "meaning": "House / Home (Roof Pose)",
        "description": "Fingertips of both hands meeting at an apex in an inverted V roof shape.",
        "is_verified": True
    },
    "ISL_CLAP": {
        "meaning": "Clap / Applause",
        "description": "Both hands clapping together in close contact.",
        "is_verified": True
    },
    "ISL_HELP_2HAND": {
        "meaning": "Help / Assistance (Two-Hand Support)",
        "description": "Closed fist placed on top of flat open palm.",
        "is_verified": True
    },
    "ISL_PRAY": {
        "meaning": "Thank You / Respectful Prayer",
        "description": "Both hands held together in reverence.",
        "is_verified": True
    }
}


def _pt_dist(p1: Dict[str, float], p2: Dict[str, float]) -> float:
    """Computes 3D Euclidean distance between two landmark dicts."""
    dx = p1.get("x", 0.0) - p2.get("x", 0.0)
    dy = p1.get("y", 0.0) - p2.get("y", 0.0)
    dz = p1.get("z", 0.0) - p2.get("z", 0.0)
    return math.hypot(dx, dy, dz)


def _to_landmark_dict(pt: Any) -> Dict[str, float]:
    if hasattr(pt, "x") and hasattr(pt, "y"):
        return {"x": float(pt.x), "y": float(pt.y), "z": float(getattr(pt, "z", 0.0) or 0.0)}
    elif isinstance(pt, dict):
        return {"x": float(pt.get("x", 0.0)), "y": float(pt.get("y", 0.0)), "z": float(pt.get("z", 0.0) or 0.0)}
    raise ValueError(f"Invalid landmark point: {pt}")


class InferenceService:
    def __init__(self):
        self.model = None
        self.metadata = {}
        self.status = "unavailable"
        self._load_model()

    def _load_model(self):
        """Loads trained Random Forest model and metadata if available."""
        model_path = settings.model_path
        metadata_path = settings.metadata_path

        if not os.path.exists(model_path):
            self.model = None
            self.metadata = {}
            self.status = "unavailable"
            print(f"[InferenceService] Model file not found at '{model_path}'. Status: unavailable.")
            return

        try:
            self.model = joblib.load(model_path)
            if os.path.exists(metadata_path):
                with open(metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                self.status = self.metadata.get("status", "trained")
            else:
                self.metadata = {
                    "model_name": type(self.model).__name__,
                    "classes": list(self.model.classes_),
                    "confidence_rejection_threshold": settings.CONFIDENCE_THRESHOLD,
                    "status": "trained"
                }
                self.status = "trained"

            print(f"[InferenceService] Successfully loaded model from '{model_path}'. Status: {self.status}.")
        except Exception as e:
            self.model = None
            self.metadata = {}
            self.status = "unavailable"
            print(f"[InferenceService] Error loading model from '{model_path}': {e}")

    def reload(self):
        """Reloads the model from disk (e.g. after retraining)."""
        self._load_model()

    def get_status_info(self) -> Dict[str, Any]:
        classes = self.metadata.get("classes", []) if self.metadata else []
        if self.model and hasattr(self.model, "classes_"):
            classes = [str(c) for c in self.model.classes_]

        # Add supported two-hand classes to reported capabilities
        two_hand_classes = ["ISL_NAMASTE_2HAND", "ISL_BOOK", "ISL_HOUSE", "ISL_CLAP", "ISL_HELP_2HAND"]
        combined_classes = list(dict.fromkeys(classes + two_hand_classes))

        return {
            "status": self.status,
            "model_name": self.metadata.get("model_name", "RandomForestClassifier + TwoHandClassifier" if self.model else "TwoHandClassifier"),
            "classes": combined_classes,
            "classes_count": len(combined_classes),
            "feature_dimension": self.metadata.get("feature_dimension", FEATURE_DIMENSION),
            "confidence_rejection_threshold": self.metadata.get(
                "confidence_rejection_threshold", settings.CONFIDENCE_THRESHOLD
            ),
            "test_accuracy": self.metadata.get("test_accuracy"),
            "total_samples": self.metadata.get("total_samples"),
            "training_timestamp": self.metadata.get("training_timestamp"),
            "known_limitations": self.metadata.get("known_limitations", [
                "Supports static single-hand signs (ISL 1-5, OK, YES, NO, PEACE, FIST) and verified two-hand signs (Namaste, Book, House, Clap, Help). Continuous rapid dynamic signing requires steady hold."
            ]),
            "retrain_command": self.metadata.get("retrain_command", "python ml/scripts/train_model.py")
        }

    def predict_two_hand(
        self,
        left_landmarks: List[Any],
        right_landmarks: List[Any],
        custom_threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Performs genuine geometric and topological classification for dual-hand signs.
        Validates spatial distance between wrists, fingertips, and relative hand poses.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        threshold = custom_threshold if custom_threshold is not None else settings.CONFIDENCE_THRESHOLD

        try:
            left_pts = [_to_landmark_dict(pt) for pt in left_landmarks]
            right_pts = [_to_landmark_dict(pt) for pt in right_landmarks]
        except Exception as e:
            return {
                "detected": False,
                "label": None,
                "english_meaning": f"Malformed two-hand landmark data: {str(e)}",
                "confidence": None,
                "status": "error",
                "is_verified_isl": False,
                "gesture_type": "two_hand_isl",
                "hands_detected": 2,
                "all_probabilities": None,
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        if len(left_pts) != NUM_LANDMARKS or len(right_pts) != NUM_LANDMARKS:
            return {
                "detected": False,
                "label": None,
                "english_meaning": f"Expected 21 landmarks per hand, got Left={len(left_pts)}, Right={len(right_pts)}",
                "confidence": None,
                "status": "error",
                "is_verified_isl": False,
                "gesture_type": "two_hand_isl",
                "hands_detected": 2,
                "all_probabilities": None,
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        lwrist, rwrist = left_pts[0], right_pts[0]
        lindex_tip, rindex_tip = left_pts[8], right_pts[8]
        lmiddle_tip, rmiddle_tip = left_pts[12], right_pts[12]
        lpinky_base, rpinky_base = left_pts[17], right_pts[17]

        inter_wrist_dist = _pt_dist(lwrist, rwrist)
        inter_wrist_y = abs(lwrist["y"] - rwrist["y"])
        inter_index_tip = _pt_dist(lindex_tip, rindex_tip)
        inter_middle_tip = _pt_dist(lmiddle_tip, rmiddle_tip)
        inter_pinky_base = _pt_dist(lpinky_base, rpinky_base)

        def is_open(pts: List[Dict[str, float]]) -> bool:
            w = pts[0]
            tip8 = _pt_dist(pts[8], w)
            tip12 = _pt_dist(pts[12], w)
            mcp5 = _pt_dist(pts[5], w)
            return tip8 > mcp5 * 1.1 and tip12 > mcp5 * 1.1

        left_open = is_open(left_pts)
        right_open = is_open(right_pts)

        predicted_label: Optional[str] = None
        confidence: float = 0.0
        gesture_type = "two_hand_isl"
        is_verified = True

        # 1. ISL_NAMASTE_2HAND
        if (
            left_open and right_open and
            inter_wrist_dist < 0.22 and
            inter_wrist_y < 0.12 and
            (inter_index_tip < 0.14 or inter_middle_tip < 0.14)
        ):
            predicted_label = "ISL_NAMASTE_2HAND"
            confidence = min(0.96, 0.80 + (0.22 - inter_wrist_dist) * 0.5 + (0.14 - inter_middle_tip) * 0.5)

        # 2. ISL_BOOK
        elif (
            left_open and right_open and
            inter_pinky_base < 0.19 and
            inter_index_tip > 0.16 and
            inter_wrist_dist < 0.26 and
            inter_wrist_y < 0.14
        ):
            predicted_label = "ISL_BOOK"
            confidence = min(0.94, 0.78 + (0.19 - inter_pinky_base) * 0.5 + (inter_index_tip - 0.16) * 0.4)

        # 3. ISL_HOUSE
        elif (
            left_open and right_open and
            (inter_middle_tip < 0.12 or inter_index_tip < 0.12) and
            inter_wrist_dist > 0.24 and
            inter_wrist_y < 0.15
        ):
            predicted_label = "ISL_HOUSE"
            confidence = min(0.93, 0.76 + (inter_wrist_dist - 0.24) * 0.4 + (0.12 - inter_middle_tip) * 0.6)

        # 4. ISL_CLAP
        elif (
            left_open and right_open and
            inter_wrist_dist < 0.18 and
            inter_index_tip < 0.12 and
            inter_middle_tip < 0.12
        ):
            predicted_label = "ISL_CLAP"
            confidence = 0.92

        # 5. ISL_HELP_2HAND
        elif (
            (not left_open and right_open and abs(lwrist["x"] - rwrist["x"]) < 0.18 and lwrist["y"] <= rwrist["y"] + 0.08) or
            (not right_open and left_open and abs(rwrist["x"] - lwrist["x"]) < 0.18 and rwrist["y"] <= lwrist["y"] + 0.08)
        ):
            predicted_label = "ISL_HELP_2HAND"
            confidence = 0.90

        # Look up vocabulary mapping
        from backend.app.services.vocabulary_service import vocabulary_service
        if predicted_label:
            meta = vocabulary_service.get_multilingual_mapping(predicted_label)
            active_version = self.metadata.get("version", "v1.0.0 (Two-Hand Dual Geometric)")

            if confidence < threshold:
                return {
                    "detected": True,
                    "label": predicted_label,
                    "english_meaning": f"Uncertain gesture ({meta['english']})",
                    "telugu": f"అనిశ్చిత సంజ్ఞ ({meta['telugu']})",
                    "telugu_romanized": f"Anischitha samjna ({meta['telugu_romanized']})",
                    "confidence": round(confidence, 4),
                    "status": "uncertain_rejected",
                    "is_verified_isl": is_verified,
                    "gesture_type": gesture_type,
                    "hands_detected": 2,
                    "model_version": active_version,
                    "all_probabilities": {predicted_label: round(confidence, 4)},
                    "rejection_threshold_used": threshold,
                    "timestamp": now_iso
                }

            return {
                "detected": True,
                "label": predicted_label,
                "english_meaning": meta["english"],
                "telugu": meta["telugu"],
                "telugu_romanized": meta["telugu_romanized"],
                "confidence": round(confidence, 4),
                "status": "accepted",
                "is_verified_isl": is_verified,
                "gesture_type": gesture_type,
                "hands_detected": 2,
                "model_version": active_version,
                "all_probabilities": {predicted_label: round(confidence, 4)},
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        # Two hands present, but no recognized sign formed
        return {
            "detected": True,
            "label": None,
            "english_meaning": "Two hands detected — Moving or unclassified sign",
            "telugu": "రెండు చేతులు గుర్తించబడ్డాయి (సంజ్ఞ ఏర్పడలేదు)",
            "telugu_romanized": "Rendu chethulu gurthinchabaddaayi (samjna erpadaledu)",
            "confidence": None,
            "status": "uncertain_rejected",
            "is_verified_isl": False,
            "gesture_type": "static",
            "hands_detected": 2,
            "model_version": self.metadata.get("version", "v1.0.0"),
            "all_probabilities": None,
            "rejection_threshold_used": threshold,
            "timestamp": now_iso
        }

    def predict(
        self,
        landmarks: Optional[List[Any]] = None,
        features: Optional[List[float]] = None,
        handedness: Optional[str] = "Right",
        custom_threshold: Optional[float] = None,
        two_hand_landmarks: Optional[Dict[str, Any]] = None,
        hands_count: Optional[int] = 1
    ) -> Dict[str, Any]:
        """
        Executes prediction on input landmarks (single or dual hand) or features.
        Returns structured PredictionResponse dict.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        threshold = custom_threshold if custom_threshold is not None else settings.CONFIDENCE_THRESHOLD

        # If dual-hand input is supplied
        if two_hand_landmarks is not None:
            left_lms = two_hand_landmarks.get("left")
            right_lms = two_hand_landmarks.get("right")
            if left_lms and right_lms:
                return self.predict_two_hand(left_lms, right_lms, threshold)

        # Check model availability for single-hand classification
        if self.model is None:
            return {
                "detected": False,
                "label": None,
                "english_meaning": None,
                "confidence": None,
                "status": "model_unavailable",
                "is_verified_isl": False,
                "gesture_type": "static",
                "hands_detected": 1,
                "all_probabilities": None,
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        # Check if hand detected / input provided
        if landmarks is None and features is None:
            return {
                "detected": False,
                "label": None,
                "english_meaning": "No hand detected in camera frame",
                "confidence": None,
                "status": "no_hand",
                "is_verified_isl": False,
                "gesture_type": "static",
                "hands_detected": 0,
                "all_probabilities": None,
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        # Preprocess features
        try:
            if features is not None and len(features) == FEATURE_DIMENSION:
                input_vector = np.array(features, dtype=np.float32).reshape(1, -1)
            elif landmarks is not None:
                pts = [_to_landmark_dict(pt) for pt in landmarks]
                feat = normalize_landmarks(pts, handedness=handedness)
                input_vector = feat.reshape(1, -1)
            else:
                return {
                    "detected": False,
                    "label": None,
                    "english_meaning": "Malformed landmark data",
                    "confidence": None,
                    "status": "error",
                    "is_verified_isl": False,
                    "gesture_type": "static",
                    "hands_detected": 1,
                    "all_probabilities": None,
                    "rejection_threshold_used": threshold,
                    "timestamp": now_iso
                }
        except Exception as e:
            return {
                "detected": False,
                "label": None,
                "english_meaning": f"Feature normalization error: {str(e)}",
                "confidence": None,
                "status": "error",
                "is_verified_isl": False,
                "gesture_type": "static",
                "hands_detected": 1,
                "all_probabilities": None,
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        # Run inference
        probs = self.model.predict_proba(input_vector)[0]
        max_idx = int(np.argmax(probs))
        confidence = float(probs[max_idx])
        predicted_label = str(self.model.classes_[max_idx])

        # Probability breakdown
        prob_dict = {str(c): round(float(p), 4) for c, p in zip(self.model.classes_, probs)}

        # Multilingual metadata lookup via vocabulary_service
        from backend.app.services.vocabulary_service import vocabulary_service
        meta = vocabulary_service.get_multilingual_mapping(predicted_label)
        active_version = self.metadata.get("version", "v1.0.0")

        # Apply confidence rejection threshold
        if confidence < threshold:
            return {
                "detected": True,
                "label": predicted_label,
                "english_meaning": f"Uncertain gesture ({meta['english']})",
                "telugu": f"అనిశ్చిత సంజ్ఞ ({meta['telugu']})",
                "telugu_romanized": f"Anischitha samjna ({meta['telugu_romanized']})",
                "confidence": round(confidence, 4),
                "status": "uncertain_rejected",
                "is_verified_isl": meta["is_verified_isl"],
                "gesture_type": meta.get("gesture_type", "static"),
                "hands_detected": 1,
                "model_version": active_version,
                "all_probabilities": prob_dict,
                "rejection_threshold_used": threshold,
                "timestamp": now_iso
            }

        return {
            "detected": True,
            "label": predicted_label,
            "english_meaning": meta["english"],
            "telugu": meta["telugu"],
            "telugu_romanized": meta["telugu_romanized"],
            "confidence": round(confidence, 4),
            "status": "accepted",
            "is_verified_isl": meta["is_verified_isl"],
            "gesture_type": meta.get("gesture_type", "static"),
            "hands_detected": 1,
            "model_version": active_version,
            "all_probabilities": prob_dict,
            "rejection_threshold_used": threshold,
            "timestamp": now_iso
        }


inference_service = InferenceService()
