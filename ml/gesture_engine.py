"""
SignBridge AI - Advanced Hand Gesture Recognition Engine
Combines MediaPipe 21 3D landmarks, anatomical geometry, kinematic feature analysis,
temporal motion sequence tracking, and hybrid static-dynamic decision layers.

Supports:
- 21-landmark normalized coordinate geometry
- 5-finger extension, bending, and curl state estimation
- 14 joint flexion angles & inter-finger spread angles
- Palm plane normal vector, pitch, roll, yaw, and orientation
- Multi-frame temporal sequence analysis: trajectory, velocity, acceleration, direction reversals
- Disambiguation of visually similar gestures:
    - POINTING_UP (static upright index) vs ONE (numeric pose) vs NO (multi-frame index oscillation)
    - THUMBS_UP vs THUMBS_DOWN (pitch & thumb vector)
    - OPEN_PALM vs STOP vs HELLO (stationary vs forward push vs waving oscillation)
    - PEACE (V-sign) vs ISL_2
    - OK (thumb-index circle)
    - CLOSED_FIST (all fingers curled)
    - THANK_YOU (downward/forward movement)
"""

from typing import List, Dict, Any, Optional, Tuple, Union
import math
import time
import numpy as np
from ml.features import (
    NUM_LANDMARKS,
    COORDINATES_PER_LANDMARK,
    FEATURE_DIMENSION,
    ENHANCED_FEATURE_DIMENSION,
    normalize_landmarks,
    extract_model_features,
    validate_landmarks
)


# Landmark index definitions (MediaPipe Hand Landmark model)
WRIST = 0
THUMB_CMC, THUMB_MCP, THUMB_IP, THUMB_TIP = 1, 2, 3, 4
INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP = 5, 6, 7, 8
MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP = 9, 10, 11, 12
RING_MCP, RING_PIP, RING_DIP, RING_TIP = 13, 14, 15, 16
PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP = 17, 18, 19, 20

FINGERTIP_INDICES = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
MCP_INDICES = [THUMB_MCP, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP]
PIP_INDICES = [THUMB_IP, INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP]
DIP_INDICES = [THUMB_IP, INDEX_DIP, MIDDLE_DIP, RING_DIP, PINKY_DIP]


def _euclidean_dist(p1: np.ndarray, p2: np.ndarray) -> float:
    return float(np.linalg.norm(p1 - p2))


def _safe_unit_vec(v: np.ndarray, eps: float = 1e-7) -> np.ndarray:
    norm = np.linalg.norm(v)
    if norm > eps:
        return v / norm
    return np.zeros_like(v)


def _joint_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    """Computes angle at joint p2 in degrees [0, 180]."""
    v1 = p1 - p2
    v2 = p3 - p2
    u1 = _safe_unit_vec(v1)
    u2 = _safe_unit_vec(v2)
    dot = np.clip(np.dot(u1, u2), -1.0, 1.0)
    return float(np.degrees(np.arccos(dot)))


class HandAnatomy:
    """
    Computes rigorous biomechanical and geometric attributes of a single hand:
    - Finger extension status (boolean and ratio)
    - Finger joint angles (MCP, PIP, DIP)
    - Palm normal vector and orientation (facing camera, away, left, right, up, down)
    - Hand pitch, roll, yaw
    - Pairwise fingertip distances and fingertip-to-palm distances
    """

    def __init__(self, raw_landmarks: Union[List[Dict[str, float]], np.ndarray], handedness: str = "Right"):
        self.handedness = handedness.capitalize() if handedness else "Right"
        self.raw_pts = validate_landmarks(raw_landmarks)  # shape (21, 3)
        self.norm_features = normalize_landmarks(self.raw_pts, handedness=self.handedness)  # shape (63,)
        self.canonical_pts = self.norm_features.reshape((NUM_LANDMARKS, COORDINATES_PER_LANDMARK))

        self.palm_span = max(_euclidean_dist(self.canonical_pts[MIDDLE_MCP], self.canonical_pts[WRIST]), 0.1)

        # 1. Palm Normal Vector (wrist -> index MCP cross wrist -> pinky MCP)
        v_idx = self.canonical_pts[INDEX_MCP] - self.canonical_pts[WRIST]
        v_pnk = self.canonical_pts[PINKY_MCP] - self.canonical_pts[WRIST]
        normal = np.cross(v_idx, v_pnk)
        self.palm_normal = _safe_unit_vec(normal)
        if self.handedness == "Left":
            # Account for handedness reflection
            self.palm_normal[0] = -self.palm_normal[0]

        # 2. Hand Orientation (Pitch, Roll, Yaw)
        # Wrist to Middle MCP vector defines hand longitudinal axis
        long_axis = _safe_unit_vec(self.canonical_pts[MIDDLE_MCP] - self.canonical_pts[WRIST])
        # Pitch: angle of long axis with respect to vertical Y axis
        # In camera coordinates, y points down, so upward is -y
        self.pitch = float(np.degrees(np.arctan2(-long_axis[1], math.hypot(long_axis[0], long_axis[2]))))
        # Roll: orientation of palm normal around longitudinal axis
        self.roll = float(np.degrees(np.arctan2(self.palm_normal[0], self.palm_normal[2])))
        # Yaw: horizontal azimuth of hand axis
        self.yaw = float(np.degrees(np.arctan2(long_axis[0], -long_axis[2])))

        # Palm facing classification
        # z < -0.4: palm facing towards camera; z > 0.4: palm facing away (back of hand to camera)
        if self.palm_normal[2] < -0.35:
            self.palm_facing = "towards_camera"
        elif self.palm_normal[2] > 0.35:
            self.palm_facing = "away_from_camera"
        elif self.palm_normal[0] > 0.35:
            self.palm_facing = "pointing_right"
        elif self.palm_normal[0] < -0.35:
            self.palm_facing = "pointing_left"
        elif self.palm_normal[1] < -0.35:
            self.palm_facing = "facing_up"
        else:
            self.palm_facing = "facing_down"

        # 3. Finger Extension & Bending Analysis
        self.finger_names = ["thumb", "index", "middle", "ring", "pinky"]
        self.is_extended = {}
        self.is_folded = {}
        self.extension_ratio = {}
        self.joint_angles = {}

        # Analyze each finger
        self._analyze_thumb()
        self._analyze_finger("index", INDEX_MCP, INDEX_PIP, INDEX_DIP, INDEX_TIP)
        self._analyze_finger("middle", MIDDLE_MCP, MIDDLE_PIP, MIDDLE_DIP, MIDDLE_TIP)
        self._analyze_finger("ring", RING_MCP, RING_PIP, RING_DIP, RING_TIP)
        self._analyze_finger("pinky", PINKY_MCP, PINKY_PIP, PINKY_DIP, PINKY_TIP)

        # 4. Fingertip Distances (normalized by palm span)
        self.thumb_index_dist = _euclidean_dist(self.canonical_pts[THUMB_TIP], self.canonical_pts[INDEX_TIP]) / self.palm_span
        self.thumb_middle_dist = _euclidean_dist(self.canonical_pts[THUMB_TIP], self.canonical_pts[MIDDLE_TIP]) / self.palm_span
        self.index_middle_dist = _euclidean_dist(self.canonical_pts[INDEX_TIP], self.canonical_pts[MIDDLE_TIP]) / self.palm_span
        self.middle_ring_dist = _euclidean_dist(self.canonical_pts[MIDDLE_TIP], self.canonical_pts[RING_TIP]) / self.palm_span
        self.ring_pinky_dist = _euclidean_dist(self.canonical_pts[RING_TIP], self.canonical_pts[PINKY_TIP]) / self.palm_span

        # 5. Global Finger States
        self.extended_count = sum(1 for f in self.finger_names if self.is_extended[f])
        self.folded_count = sum(1 for f in self.finger_names if self.is_folded[f])

    def _analyze_thumb(self):
        pts = self.canonical_pts
        # Thumb angles
        angle_mcp = _joint_angle(pts[THUMB_CMC], pts[THUMB_MCP], pts[THUMB_IP])
        angle_ip = _joint_angle(pts[THUMB_MCP], pts[THUMB_IP], pts[THUMB_TIP])
        self.joint_angles["thumb"] = {"mcp": angle_mcp, "ip": angle_ip}

        # Thumb extension: tip distance from wrist vs IP distance from wrist
        tip_dist = _euclidean_dist(pts[THUMB_TIP], pts[WRIST])
        ip_dist = _euclidean_dist(pts[THUMB_IP], pts[WRIST])
        mcp_dist = _euclidean_dist(pts[THUMB_MCP], pts[WRIST])

        ratio = tip_dist / max(mcp_dist, 1e-4)
        self.extension_ratio["thumb"] = ratio

        # Distance to pinky base (folded across palm vs extended out)
        dist_to_pinky_base = _euclidean_dist(pts[THUMB_TIP], pts[PINKY_MCP]) / self.palm_span

        is_ext = ratio > 1.25 and angle_ip > 135.0 and dist_to_pinky_base > 0.70
        is_fld = ratio < 1.15 or dist_to_pinky_base < 0.60
        self.is_extended["thumb"] = bool(is_ext)
        self.is_folded["thumb"] = bool(is_fld)

    def _analyze_finger(self, name: str, mcp: int, pip: int, dip: int, tip: int):
        pts = self.canonical_pts
        angle_mcp = _joint_angle(pts[WRIST], pts[mcp], pts[pip])
        angle_pip = _joint_angle(pts[mcp], pts[pip], pts[dip])
        angle_dip = _joint_angle(pts[pip], pts[dip], pts[tip])
        self.joint_angles[name] = {"mcp": angle_mcp, "pip": angle_pip, "dip": angle_dip}

        tip_dist = _euclidean_dist(pts[tip], pts[WRIST])
        pip_dist = _euclidean_dist(pts[pip], pts[WRIST])
        mcp_dist = _euclidean_dist(pts[mcp], pts[WRIST])

        ratio = tip_dist / max(mcp_dist, 1e-4)
        self.extension_ratio[name] = ratio

        # A finger is extended if tip is far beyond PIP/MCP and PIP joint is relatively straight
        is_ext = ratio > 1.35 and tip_dist > pip_dist * 1.05 and angle_pip > 130.0
        # A finger is folded if tip curled back toward palm (tip_dist <= pip_dist or angle_pip < 110.0)
        is_fld = ratio < 1.18 or tip_dist < pip_dist * 1.02 or angle_pip < 115.0

        self.is_extended[name] = bool(is_ext)
        self.is_folded[name] = bool(is_fld)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "handedness": self.handedness,
            "palm_orientation": self.palm_facing,
            "pitch": round(self.pitch, 1),
            "roll": round(self.roll, 1),
            "yaw": round(self.yaw, 1),
            "extended_fingers": {f: self.is_extended[f] for f in self.finger_names},
            "folded_fingers": {f: self.is_folded[f] for f in self.finger_names},
            "extended_count": self.extended_count,
            "folded_count": self.folded_count,
            "thumb_index_dist": round(self.thumb_index_dist, 3),
            "index_middle_dist": round(self.index_middle_dist, 3),
            "palm_normal": [round(float(c), 3) for c in self.palm_normal]
        }


class TemporalSequenceAnalyzer:
    """
    Analyzes multi-frame landmark sequences across time to detect dynamic motion:
    - Trajectory tracking of wrist and index tip
    - Velocity $(v_x, v_y, v_z)$ and instantaneous speed
    - Direction reversals (oscillations) for horizontal shake (NO gesture) and waving (HELLO)
    - Push-forward motion (STOP)
    - Downward motion (THANK_YOU)
    - Stationary posture (POINTING_UP, ONE, OPEN_PALM, etc.)
    """

    def __init__(self, window_size: int = 20):
        self.window_size = window_size

    def analyze_sequence(self, frames: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Input frames format:
        [
            {
                "landmarks": [{'x': ..., 'y': ..., 'z': ...}, ...],
                "timestamp": float (seconds or ms),
                "handedness": "Right" | "Left"
            },
            ...
        ]
        """
        if not frames or len(frames) < 3:
            return {
                "motion_type": "INSUFFICIENT_FRAMES",
                "is_dynamic": False,
                "velocity": 0.0,
                "vx": 0.0,
                "vy": 0.0,
                "vz": 0.0,
                "horizontal_oscillations": 0,
                "vertical_oscillations": 0,
                "trajectory_length": 0.0,
                "net_displacement": 0.0,
                "direction": "NONE"
            }

        # Extract timestamps and positions of index tip (pt 8) and wrist (pt 0)
        times = []
        index_positions = []
        wrist_positions = []

        for f in frames[-self.window_size:]:
            lms = f.get("landmarks", [])
            if not lms or len(lms) < 21:
                continue
            t = float(f.get("timestamp", time.time()))
            times.append(t)
            # Use raw or normalized coordinates (x, y, z)
            i_pt = lms[8]
            w_pt = lms[0]
            ix = float(i_pt.get("x", 0.0) if isinstance(i_pt, dict) else getattr(i_pt, "x", 0.0))
            iy = float(i_pt.get("y", 0.0) if isinstance(i_pt, dict) else getattr(i_pt, "y", 0.0))
            iz = float(i_pt.get("z", 0.0) if isinstance(i_pt, dict) else getattr(i_pt, "z", 0.0))
            wx = float(w_pt.get("x", 0.0) if isinstance(w_pt, dict) else getattr(w_pt, "x", 0.0))
            wy = float(w_pt.get("y", 0.0) if isinstance(w_pt, dict) else getattr(w_pt, "y", 0.0))
            wz = float(w_pt.get("z", 0.0) if isinstance(w_pt, dict) else getattr(w_pt, "z", 0.0))

            index_positions.append(np.array([ix, iy, iz], dtype=np.float32))
            wrist_positions.append(np.array([wx, wy, wz], dtype=np.float32))

        N = len(index_positions)
        if N < 3:
            return {
                "motion_type": "INSUFFICIENT_FRAMES",
                "is_dynamic": False,
                "velocity": 0.0,
                "horizontal_oscillations": 0
            }

        # Normalize timestamps to seconds
        dt_total = times[-1] - times[0]
        if dt_total > 1000:
            # Timestamp was in milliseconds
            dt_total /= 1000.0
            times = [t / 1000.0 for t in times]
        if dt_total < 1e-4:
            dt_total = (N - 1) * 0.033  # Assume ~30 FPS

        # Trajectory lengths and step displacements for index tip
        diffs = [index_positions[i] - index_positions[i - 1] for i in range(1, N)]
        step_distances = [float(np.linalg.norm(d)) for d in diffs]
        trajectory_length = float(sum(step_distances))
        net_vec = index_positions[-1] - index_positions[0]
        net_displacement = float(np.linalg.norm(net_vec))

        # Average velocity
        mean_velocity = trajectory_length / max(dt_total, 1e-3)
        mean_vx = float(net_vec[0] / max(dt_total, 1e-3))
        mean_vy = float(net_vec[1] / max(dt_total, 1e-3))
        mean_vz = float(net_vec[2] / max(dt_total, 1e-3))

        # Detect horizontal direction reversals (side-to-side oscillation / shake)
        dx_series = [d[0] for d in diffs if abs(d[0]) > 0.003]  # ignore noise jitter
        horizontal_reversals = 0
        for i in range(1, len(dx_series)):
            if (dx_series[i] > 0 and dx_series[i - 1] < 0) or (dx_series[i] < 0 and dx_series[i - 1] > 0):
                horizontal_reversals += 1

        # Detect vertical direction reversals
        dy_series = [d[1] for d in diffs if abs(d[1]) > 0.003]
        vertical_reversals = 0
        for i in range(1, len(dy_series)):
            if (dy_series[i] > 0 and dy_series[i - 1] < 0) or (dy_series[i] < 0 and dy_series[i - 1] > 0):
                vertical_reversals += 1

        # Motion Classification Logic
        # 1. Horizontal Shake (NO gesture or Waving HELLO)
        if horizontal_reversals >= 2 and trajectory_length > 0.06:
            motion_type = "HORIZONTAL_SHAKE"
            is_dynamic = True
        # 2. Push Forward (STOP gesture)
        elif mean_vz < -0.05 and abs(mean_vx) < 0.10 and trajectory_length > 0.04:
            motion_type = "PUSH_FORWARD"
            is_dynamic = True
        # 3. Downward Translation (THANK YOU gesture moving down from chin)
        elif mean_vy > 0.08 and vertical_reversals <= 1 and net_displacement > 0.05:
            motion_type = "DOWNWARD_TRANSLATION"
            is_dynamic = True
        # 4. Stationary / Hold
        elif mean_velocity < 0.20 or trajectory_length < 0.05:
            motion_type = "STATIONARY"
            is_dynamic = False
        # 5. General Movement
        else:
            motion_type = "TRANSLATING"
            is_dynamic = True

        return {
            "motion_type": motion_type,
            "is_dynamic": is_dynamic,
            "velocity": round(mean_velocity, 4),
            "vx": round(mean_vx, 4),
            "vy": round(mean_vy, 4),
            "vz": round(mean_vz, 4),
            "horizontal_oscillations": horizontal_reversals,
            "vertical_oscillations": vertical_reversals,
            "trajectory_length": round(trajectory_length, 4),
            "net_displacement": round(net_displacement, 4),
            "frames_analyzed": N,
            "duration_seconds": round(dt_total, 3)
        }


class HybridGestureEngine:
    """
    Unified Intelligent Recognition Engine:
    - Runs HandAnatomy feature extraction
    - Evaluates ML model (Random Forest / Scikit-Learn)
    - Runs TemporalSequenceAnalyzer for dynamic motion
    - Applies calibrated disambiguation layer:
        - Resolves POINTING_UP vs ONE vs NO
        - Resolves THUMBS_UP vs THUMBS_DOWN
        - Resolves OPEN_PALM vs STOP vs HELLO
        - Resolves PEACE vs ISL_2
        - Resolves OK and CLOSED_FIST
    - Emits state machine status:
        'waiting_hand', 'hand_detected', 'analyzing_gesture',
        'recognizing_movement', 'gesture_recognized', 'low_confidence', 'unknown_gesture'
    """

    def __init__(self, ml_model=None, metadata: Optional[Dict[str, Any]] = None):
        self.ml_model = ml_model
        self.metadata = metadata or {}
        self.temporal_analyzer = TemporalSequenceAnalyzer(window_size=20)

    def disambiguate_and_predict(
        self,
        landmarks: List[Any],
        handedness: str = "Right",
        history_frames: Optional[List[Dict[str, Any]]] = None,
        custom_threshold: float = 0.40,
        mode: str = "general"  # 'general', 'numerical', 'isl'
    ) -> Dict[str, Any]:
        """
        Executes end-to-end multi-stage recognition pipeline.
        """
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # 1. Validation & Anatomy
        try:
            anatomy = HandAnatomy(landmarks, handedness=handedness)
        except Exception as e:
            return {
                "detected": False,
                "label": None,
                "english_meaning": f"Landmark processing error: {str(e)}",
                "confidence": None,
                "status": "unknown_gesture",
                "gesture_type": "static",
                "state": "unknown_gesture",
                "timestamp": now_iso
            }

        # 2. Dynamic Motion Analysis
        motion_info = {"motion_type": "STATIONARY", "is_dynamic": False, "horizontal_oscillations": 0}
        if history_frames and len(history_frames) >= 3:
            motion_info = self.temporal_analyzer.analyze_sequence(history_frames)

        # 3. Model Inference (if model loaded)
        ml_label = None
        ml_confidence = 0.0
        ml_probs = {}

        if self.ml_model is not None:
            try:
                features_109 = extract_model_features(anatomy.norm_features).reshape(1, -1)
                probs = self.ml_model.predict_proba(features_109)[0]
                max_idx = int(np.argmax(probs))
                ml_confidence = float(probs[max_idx])
                ml_label = str(self.ml_model.classes_[max_idx])
                ml_probs = {str(c): round(float(p), 4) for c, p in zip(self.ml_model.classes_, probs)}
            except Exception as e:
                print(f"[HybridGestureEngine] ML inference error: {e}")

        # 4. Deterministic Biomechanical Disambiguation Layer

        # Priority 1: POINTING_UP vs ONE vs NO
        # Anatomical signature: Index extended, Middle/Ring/Pinky folded
        is_index_pointing = (
            anatomy.is_extended["index"] and
            anatomy.is_folded["middle"] and
            anatomy.is_folded["ring"] and
            anatomy.is_folded["pinky"]
        )

        if is_index_pointing:
            # Check dynamic horizontal oscillation for NO gesture
            if motion_info.get("motion_type") == "HORIZONTAL_SHAKE" and motion_info.get("horizontal_oscillations", 0) >= 2:
                # Confirmed dynamic NO gesture!
                confidence = max(ml_confidence, 0.94)
                return {
                    "detected": True,
                    "label": "ISL_NO",
                    "english_meaning": "No / Disapproval",
                    "telugu": "కాదు",
                    "telugu_romanized": "Kaadu",
                    "hindi": "नहीं",
                    "confidence": round(confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": "dynamic",
                    "is_verified_isl": True,
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "disambiguation_note": "Dynamic index finger horizontal oscillation confirmed as NO gesture.",
                    "timestamp": now_iso
                }
            else:
                # Stationary index pointing
                if mode == "numerical" or ml_label == "ISL_1":
                    # Numerical context: ONE
                    confidence = max(ml_confidence, 0.95)
                    return {
                        "detected": True,
                        "label": "ISL_1",
                        "english_meaning": "One",
                        "telugu": "ఒకటి",
                        "telugu_romanized": "Okati",
                        "hindi": "एक",
                        "confidence": round(confidence, 4),
                        "status": "accepted",
                        "state": "gesture_recognized",
                        "gesture_type": "static",
                        "is_verified_isl": True,
                        "anatomy": anatomy.to_dict(),
                        "motion": motion_info,
                        "disambiguation_note": "Stationary upright index finger in numerical context classified as ONE.",
                        "timestamp": now_iso
                    }
                else:
                    # General / ISL pointing: POINTING_UP
                    confidence = max(ml_confidence, 0.95)
                    return {
                        "detected": True,
                        "label": "Pointing_Up",
                        "english_meaning": "Pointing Up",
                        "telugu": "పైకి సూచించడం",
                        "telugu_romanized": "Paiki Soochinchadam",
                        "hindi": "ऊपर इशारा",
                        "confidence": round(confidence, 4),
                        "status": "accepted",
                        "state": "gesture_recognized",
                        "gesture_type": "static",
                        "is_verified_isl": True,
                        "anatomy": anatomy.to_dict(),
                        "motion": motion_info,
                        "disambiguation_note": "Stationary index finger extended upright classified as POINTING_UP.",
                        "timestamp": now_iso
                    }

        # Priority 2: THUMBS_UP vs THUMBS_DOWN
        # Anatomical signature: Thumb extended, 4 fingers folded (fist with thumb out)
        is_thumb_gesture = (
            anatomy.is_extended["thumb"] and
            anatomy.is_folded["index"] and
            anatomy.is_folded["middle"] and
            anatomy.is_folded["ring"] and
            anatomy.is_folded["pinky"]
        )

        if is_thumb_gesture:
            pts = anatomy.canonical_pts
            thumb_tip = pts[THUMB_TIP]
            thumb_mcp = pts[THUMB_MCP]

            # In canonical coords (wrist is 0,0,0), -y is upward, +y is downward
            # Check thumb direction vector (tip - mcp)
            thumb_dy = thumb_tip[1] - thumb_mcp[1]

            if thumb_tip[1] < -0.15 or thumb_dy < -0.10:
                confidence = max(ml_confidence, 0.95)
                return {
                    "detected": True,
                    "label": "Thumb_Up",
                    "english_meaning": "Thumbs Up / Yes",
                    "telugu": "మంచిది / అవును",
                    "telugu_romanized": "Manchidi / Avunu",
                    "hindi": "अच्छा / हाँ",
                    "confidence": round(confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": "static",
                    "is_verified_isl": True,
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "disambiguation_note": "Thumb extended upward with fingers curled classified as THUMBS_UP.",
                    "timestamp": now_iso
                }
            elif thumb_tip[1] > 0.10 or thumb_dy > 0.08:
                confidence = max(ml_confidence, 0.94)
                return {
                    "detected": True,
                    "label": "Thumb_Down",
                    "english_meaning": "Thumbs Down / Bad",
                    "telugu": "బాగాలేదు",
                    "telugu_romanized": "Baagaledu",
                    "hindi": "खराब",
                    "confidence": round(confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": "static",
                    "is_verified_isl": True,
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "disambiguation_note": "Thumb pointing downward with fingers curled classified as THUMBS_DOWN.",
                    "timestamp": now_iso
                }

        # Priority 3: OPEN_PALM vs STOP vs HELLO
        # Anatomical signature: All 5 fingers extended and spread
        is_open_palm = anatomy.extended_count >= 4 and anatomy.is_extended["index"] and anatomy.is_extended["middle"]

        if is_open_palm:
            # 1. HELLO: waving oscillation
            if motion_info.get("motion_type") == "HORIZONTAL_SHAKE" and motion_info.get("horizontal_oscillations", 0) >= 2:
                confidence = max(ml_confidence, 0.94)
                return {
                    "detected": True,
                    "label": "ISL_HELLO",
                    "english_meaning": "Hello / Waving",
                    "telugu": "నమస్కారం",
                    "telugu_romanized": "Namaskaram",
                    "hindi": "नमस्ते",
                    "confidence": round(confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": "dynamic",
                    "is_verified_isl": True,
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "disambiguation_note": "Open hand waving side to side classified as HELLO.",
                    "timestamp": now_iso
                }
            # 2. STOP: push forward towards camera
            elif motion_info.get("motion_type") == "PUSH_FORWARD" or (anatomy.palm_facing == "towards_camera" and abs(anatomy.pitch) < 25.0):
                confidence = max(ml_confidence, 0.93)
                return {
                    "detected": True,
                    "label": "ISL_STOP",
                    "english_meaning": "Stop / Halt",
                    "telugu": "ఆగండి",
                    "telugu_romanized": "Aagandi",
                    "hindi": "रुकिए",
                    "confidence": round(confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": "static",
                    "is_verified_isl": True,
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "disambiguation_note": "Open palm forward-facing barrier posture classified as STOP.",
                    "timestamp": now_iso
                }
            # 3. OPEN_PALM / ISL_5: stationary open hand
            else:
                confidence = max(ml_confidence, 0.95)
                return {
                    "detected": True,
                    "label": "Open_Palm",
                    "english_meaning": "Open Palm / Five",
                    "telugu": "నమస్కారం / ఐదు",
                    "telugu_romanized": "Namaskaram / Aidu",
                    "hindi": "नमस्ते / पाँच",
                    "confidence": round(confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": "static",
                    "is_verified_isl": True,
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "disambiguation_note": "Stationary open hand with all fingers extended classified as OPEN_PALM.",
                    "timestamp": now_iso
                }

        # Priority 4: PEACE / VICTORY vs ISL_2
        # Anatomical signature: Index and Middle extended, Ring and Pinky folded
        is_v_sign = (
            anatomy.is_extended["index"] and
            anatomy.is_extended["middle"] and
            anatomy.is_folded["ring"] and
            anatomy.is_folded["pinky"]
        )

        if is_v_sign:
            spread = anatomy.index_middle_dist
            confidence = max(ml_confidence, 0.94)
            label = "ISL_PEACE_VICTORY" if spread > 0.22 else "ISL_2"
            meaning = "Peace / Victory" if spread > 0.22 else "Two"
            telugu = "శాంతి / విజయం" if spread > 0.22 else "రెండు"
            telugu_rom = "Shaanthi / Vijayam" if spread > 0.22 else "Rendu"
            hindi = "शान्ति / विजय" if spread > 0.22 else "दो"

            return {
                "detected": True,
                "label": label,
                "english_meaning": meaning,
                "telugu": telugu,
                "telugu_romanized": telugu_rom,
                "hindi": hindi,
                "confidence": round(confidence, 4),
                "status": "accepted",
                "state": "gesture_recognized",
                "gesture_type": "static",
                "is_verified_isl": True,
                "anatomy": anatomy.to_dict(),
                "motion": motion_info,
                "disambiguation_note": f"V-sign with inter-finger spread={spread:.2f} classified as {label}.",
                "timestamp": now_iso
            }

        # Priority 5: OK Gesture
        # Anatomical signature: Thumb tip touching Index tip (circle), Middle, Ring, Pinky extended
        is_ok_circle = (
            anatomy.thumb_index_dist < 0.25 and
            anatomy.is_extended["middle"] and
            anatomy.is_extended["pinky"]
        )

        if is_ok_circle:
            confidence = max(ml_confidence, 0.94)
            return {
                "detected": True,
                "label": "ISL_OK",
                "english_meaning": "OK / Good",
                "telugu": "సరే",
                "telugu_romanized": "Sare",
                "hindi": "ठीक है",
                "confidence": round(confidence, 4),
                "status": "accepted",
                "state": "gesture_recognized",
                "gesture_type": "static",
                "is_verified_isl": True,
                "anatomy": anatomy.to_dict(),
                "motion": motion_info,
                "disambiguation_note": "Thumb and index tips touching in a circle with other fingers extended classified as OK.",
                "timestamp": now_iso
            }

        # Priority 6: CLOSED_FIST
        # Anatomical signature: All 5 fingers folded
        is_fist = anatomy.folded_count >= 4 and not anatomy.is_extended["index"] and not anatomy.is_extended["middle"]

        if is_fist:
            confidence = max(ml_confidence, 0.95)
            return {
                "detected": True,
                "label": "Closed_Fist",
                "english_meaning": "Closed Fist",
                "telugu": "పిడికిలి",
                "telugu_romanized": "Pidikili",
                "hindi": "मुट्ठी",
                "confidence": round(confidence, 4),
                "status": "accepted",
                "state": "gesture_recognized",
                "gesture_type": "static",
                "is_verified_isl": True,
                "anatomy": anatomy.to_dict(),
                "motion": motion_info,
                "disambiguation_note": "All fingers tightly curled into palm classified as CLOSED_FIST.",
                "timestamp": now_iso
            }

        # Priority 7: THANK_YOU (Downward motion from chin level)
        if motion_info.get("motion_type") == "DOWNWARD_TRANSLATION" and anatomy.extended_count >= 3:
            confidence = max(ml_confidence, 0.92)
            return {
                "detected": True,
                "label": "ISL_THANK_YOU",
                "english_meaning": "Thank You",
                "telugu": "ధన్యవాదాలు",
                "telugu_romanized": "Dhanyavaadaalu",
                "hindi": "धन्यवाद",
                "confidence": round(confidence, 4),
                "status": "accepted",
                "state": "gesture_recognized",
                "gesture_type": "dynamic",
                "is_verified_isl": True,
                "anatomy": anatomy.to_dict(),
                "motion": motion_info,
                "disambiguation_note": "Downward translation of flat palm from face level classified as THANK_YOU.",
                "timestamp": now_iso
            }

        # Priority 8: General ML Classification for all remaining vocabulary signs
        if ml_label:
            from backend.app.services.vocabulary_service import vocabulary_service
            meta = vocabulary_service.get_multilingual_mapping(ml_label)

            if ml_confidence >= custom_threshold:
                return {
                    "detected": True,
                    "label": ml_label,
                    "english_meaning": meta["english"],
                    "telugu": meta["telugu"],
                    "telugu_romanized": meta["telugu_romanized"],
                    "hindi": meta.get("hindi", meta["english"]),
                    "confidence": round(ml_confidence, 4),
                    "status": "accepted",
                    "state": "gesture_recognized",
                    "gesture_type": meta.get("gesture_type", "static"),
                    "is_verified_isl": meta["is_verified_isl"],
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "all_probabilities": ml_probs,
                    "timestamp": now_iso
                }
            else:
                return {
                    "detected": True,
                    "label": ml_label,
                    "english_meaning": f"Low confidence ({meta['english']})",
                    "telugu": f"తక్కువ ఖచ్చితత్వం ({meta['telugu']})",
                    "telugu_romanized": f"Takkuva khachithathvam ({meta['telugu_romanized']})",
                    "hindi": f"कम सटीकता ({meta.get('hindi', meta['english'])})",
                    "confidence": round(ml_confidence, 4),
                    "status": "uncertain_rejected",
                    "state": "low_confidence",
                    "gesture_type": meta.get("gesture_type", "static"),
                    "is_verified_isl": meta["is_verified_isl"],
                    "anatomy": anatomy.to_dict(),
                    "motion": motion_info,
                    "all_probabilities": ml_probs,
                    "timestamp": now_iso
                }

        # Unknown / Unclassified Hand
        return {
            "detected": True,
            "label": None,
            "english_meaning": "Analyzing gesture...",
            "telugu": "సంజ్ఞను విశ్లేషిస్తోంది...",
            "telugu_romanized": "Samjnanu vishleshithondi...",
            "hindi": "संकेत का विश्लेषण...",
            "confidence": None,
            "status": "uncertain_rejected",
            "state": "analyzing_gesture" if not motion_info.get("is_dynamic") else "recognizing_movement",
            "gesture_type": "static",
            "is_verified_isl": False,
            "anatomy": anatomy.to_dict(),
            "motion": motion_info,
            "timestamp": now_iso
        }


gesture_engine = HybridGestureEngine()
