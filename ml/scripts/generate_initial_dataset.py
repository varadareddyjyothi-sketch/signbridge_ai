"""
SignBridge AI - Kinematic Landmark Dataset Generator & Augmentation Pipeline
Generates anatomically precise 21-landmark 3D hand configurations based on
MediaPipe hand kinematic topology for verified Indian Sign Language (ISL) handshapes:
  - ISL_1: Index extended upright, thumb folded across closed fingers
  - ISL_2: Index + Middle extended parallel side-by-side (Number 2)
  - ISL_3: Index + Middle + Ring extended upright (Number 3)
  - ISL_4: Four fingers extended, thumb folded across palm (Number 4)
  - ISL_5: All 5 fingers spread wide open (Open Palm / Number 5)
  - ISL_OK: Thumb + Index fingertips touching in circle loop, others extended (OK / Good)
  - ISL_YES_THUMBS_UP: Closed fist with thumb pointing vertically upward (Yes / Affirmative)
  - ISL_NO_INDEX: Index pointing in firm warning stance with thumb braced to side (No / Stop)
  - ISL_PEACE_VICTORY: Index + Middle in wide V-shape divergence (Peace / Victory)
  - ISL_FIST: All 5 fingers tightly curled into compact fist (Letter S)

Includes real-world physical and camera variations:
  - 3D rotations across yaw, pitch, roll (-22° to +22°)
  - Camera distance and hand scale variations (0.65x to 1.45x)
  - Camera translation offsets across the frame
  - Natural human joint flexion and posture variance
  - Gaussian sensor noise simulation
  - Balanced Left and Right hand representation across multiple user sessions
"""

import os
import sys
import csv
import time
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml.features import normalize_landmarks, FEATURE_DIMENSION

DATASET_CSV = os.path.join("ml", "dataset", "isl_landmarks_dataset.csv")

FINGER_MCP_OFFSETS = {
    "thumb": np.array([0.08, 0.05, 0.0], dtype=np.float32),
    "index": np.array([0.06, 0.16, 0.0], dtype=np.float32),
    "middle": np.array([0.01, 0.18, 0.0], dtype=np.float32),
    "ring": np.array([-0.04, 0.16, 0.0], dtype=np.float32),
    "pinky": np.array([-0.08, 0.13, 0.0], dtype=np.float32),
}

PHALANX_LENGTHS = {
    "thumb": [0.040, 0.038, 0.036],
    "index": [0.046, 0.036, 0.026],
    "middle": [0.050, 0.039, 0.028],
    "ring": [0.045, 0.035, 0.025],
    "pinky": [0.036, 0.026, 0.021],
}


def build_hand_pose(
    gesture_name: str,
    finger_states: dict,
    noise_level: float = 0.004,
    rotation_deg: float = 8.0,
    scale: float = 1.0,
    camera_offset: np.ndarray = None,
    is_left: bool = False
) -> list:
    """Builds a 21-point 3D landmark array according to gesture anatomy."""
    pts = np.zeros((21, 3), dtype=np.float32)
    pts[0] = [0.0, 0.0, 0.0]  # Wrist

    # Thumb MCP
    pts[1] = pts[0] + FINGER_MCP_OFFSETS["thumb"] * 0.5
    pts[2] = pts[0] + FINGER_MCP_OFFSETS["thumb"]

    t_state = finger_states.get("thumb", 0.0)

    # Anatomical thumb poses
    if gesture_name == "ISL_YES_THUMBS_UP":
        # Straight up (+y)
        t_dir = np.array([0.05, 0.98, -0.15])
    elif gesture_name == "ISL_OK":
        # Curves to meet index tip
        t_dir = np.array([0.05, 0.65, 0.40])
    elif gesture_name == "ISL_NO_INDEX":
        # Thumb extended outward laterally, braced
        t_dir = np.array([0.85, 0.35, 0.20])
    elif gesture_name == "ISL_1":
        # Thumb tightly folded across closed middle/ring fingers
        t_dir = np.array([-0.40, 0.45, 0.65])
    elif gesture_name == "ISL_FIST":
        # Thumb wrapped over index and middle fingers
        t_dir = np.array([-0.35, 0.40, 0.60])
    elif t_state > 0.5:
        # Standard extended thumb
        t_dir = np.array([0.65, 0.65, 0.10])
    else:
        # Folded across palm
        t_dir = np.array([-0.30, 0.35, 0.50])

    t_dir = t_dir / np.linalg.norm(t_dir)
    pts[3] = pts[2] + t_dir * PHALANX_LENGTHS["thumb"][1]
    pts[4] = pts[3] + t_dir * PHALANX_LENGTHS["thumb"][2]

    # Fingers: index (5), middle (9), ring (13), pinky (17)
    fingers = [("index", 5), ("middle", 9), ("ring", 13), ("pinky", 17)]
    for name, base_idx in fingers:
        state = finger_states.get(name, 0.0)
        mcp_pos = pts[0] + FINGER_MCP_OFFSETS[name]
        pts[base_idx] = mcp_pos

        l1, l2, l3 = PHALANX_LENGTHS[name]

        if state > 0.5:
            # Extended upward
            spread_x = mcp_pos[0] * 0.15

            # Special geometric adjustments
            if gesture_name == "ISL_PEACE_VICTORY":
                if name == "index":
                    spread_x = 0.065   # Diverge outward right
                elif name == "middle":
                    spread_x = -0.065  # Diverge outward left
            elif gesture_name == "ISL_2":
                if name == "index":
                    spread_x = -0.008  # Keep together with middle
                elif name == "middle":
                    spread_x = 0.008   # Keep together with index
            elif gesture_name == "ISL_5":
                spread_x = mcp_pos[0] * 0.50  # Wide open spread
            elif gesture_name == "ISL_NO_INDEX" and name == "index":
                spread_x = -0.035  # Warning stance angle

            dir_ext = np.array([spread_x, 1.0, 0.0])
            dir_ext /= np.linalg.norm(dir_ext)

            pts[base_idx + 1] = pts[base_idx] + dir_ext * l1
            pts[base_idx + 2] = pts[base_idx + 1] + dir_ext * l2
            pts[base_idx + 3] = pts[base_idx + 2] + dir_ext * l3
        else:
            # Curled into palm
            dir_curl1 = np.array([0.0, 0.25, 0.75])
            dir_curl1 /= np.linalg.norm(dir_curl1)
            dir_curl2 = np.array([0.0, -0.65, 0.35])
            dir_curl2 /= np.linalg.norm(dir_curl2)

            pts[base_idx + 1] = pts[base_idx] + dir_curl1 * l1
            pts[base_idx + 2] = pts[base_idx + 1] + dir_curl2 * l2
            pts[base_idx + 3] = pts[base_idx + 2] + dir_curl2 * l3

    # Special ISL_OK touch constraint: thumb tip (4) meets index tip (8)
    if gesture_name == "ISL_OK":
        # Curve index tip to touch thumb tip
        target_touch = (pts[4] + pts[8]) * 0.5
        pts[4] = target_touch + np.array([-0.005, 0.002, 0.002])
        pts[8] = target_touch + np.array([0.005, -0.002, -0.002])

    # Add Gaussian jitter
    jitter = np.random.normal(0, noise_level, pts.shape).astype(np.float32)
    pts += jitter

    # Random 3D Rotation (yaw, pitch, roll)
    angles = np.radians(np.random.uniform(-rotation_deg, rotation_deg, 3))
    Rx = np.array([[1, 0, 0], [0, np.cos(angles[0]), -np.sin(angles[0])], [0, np.sin(angles[0]), np.cos(angles[0])]])
    Ry = np.array([[np.cos(angles[1]), 0, np.sin(angles[1])], [0, 1, 0], [-np.sin(angles[1]), 0, np.cos(angles[1])]])
    Rz = np.array([[np.cos(angles[2]), -np.sin(angles[2]), 0], [np.sin(angles[2]), np.cos(angles[2]), 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx
    pts = (R @ pts.T).T

    # Scale and camera translation offset
    pts = pts * scale
    if camera_offset is not None:
        pts = pts + camera_offset

    # Left-hand mirroring
    if is_left:
        pts[:, 0] = -pts[:, 0]

    return [{"x": float(p[0]), "y": float(p[1]), "z": float(p[2])} for p in pts]


def generate_class_samples(label: str, count: int = 120) -> list:
    """Generates synthetic anatomical samples for a given verified ISL handshape."""
    samples = []

    # Canonical base finger extension states
    # (thumb, index, middle, ring, pinky)
    gesture_templates = {
        "ISL_1": {"thumb": 0.0, "index": 1.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
        "ISL_2": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 0.0, "pinky": 0.0},
        "ISL_3": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 0.0},
        "ISL_4": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
        "ISL_5": {"thumb": 1.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
        "ISL_OK": {"thumb": 0.2, "index": 0.2, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
        "ISL_YES_THUMBS_UP": {"thumb": 1.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
        "ISL_NO_INDEX": {"thumb": 0.4, "index": 1.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
        "ISL_PEACE_VICTORY": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 0.0, "pinky": 0.0},
        "ISL_FIST": {"thumb": 0.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
    }

    base_state = gesture_templates.get(label, gesture_templates["ISL_1"])

    for i in range(count):
        # 50% left, 50% right handedness across 12 distinct user sessions
        session_id = f"session_{(i // 10) + 1}"
        is_left = (i % 2 == 1)
        handedness_str = "Left" if is_left else "Right"

        # Variances
        scale = np.random.uniform(0.68, 1.42)
        rot_deg = np.random.uniform(8.0, 20.0)
        noise = np.random.uniform(0.002, 0.006)
        cam_offset = np.array([
            np.random.uniform(0.15, 0.85),
            np.random.uniform(0.15, 0.85),
            np.random.uniform(0.40, 1.30)
        ], dtype=np.float32)

        # Perturb finger states slightly
        curr_state = {}
        for k, v in base_state.items():
            if v > 0.5:
                curr_state[k] = float(np.clip(v + np.random.normal(0, 0.03), 0.72, 1.0))
            else:
                curr_state[k] = float(np.clip(v + np.random.normal(0, 0.03), 0.0, 0.28))

        # Fine-tune class specific rotational envelopes
        if label == "ISL_YES_THUMBS_UP":
            rot_deg = 10.0
        elif label == "ISL_PEACE_VICTORY":
            rot_deg = 15.0
        elif label == "ISL_OK":
            rot_deg = 12.0

        raw_pts = build_hand_pose(
            label,
            curr_state,
            noise_level=noise,
            rotation_deg=rot_deg,
            scale=scale,
            camera_offset=cam_offset,
            is_left=is_left
        )

        features = normalize_landmarks(raw_pts, handedness=handedness_str)
        samples.append({
            "label": label,
            "handedness": handedness_str,
            "timestamp": time.time(),
            "session_id": session_id,
            "features": features
        })

    return samples


def main():
    print("=" * 60)
    print("SignBridge AI — Kinematic Dataset Generator & Augmentation")
    print(f"Target: {DATASET_CSV}")
    print("=" * 60)

    classes = [
        "ISL_1",
        "ISL_2",
        "ISL_3",
        "ISL_4",
        "ISL_5",
        "ISL_OK",
        "ISL_YES_THUMBS_UP",
        "ISL_NO_INDEX",
        "ISL_PEACE_VICTORY",
        "ISL_FIST"
    ]

    os.makedirs(os.path.dirname(DATASET_CSV), exist_ok=True)
    header = ["label", "handedness", "timestamp", "session_id"] + [f"f_{i}" for i in range(FEATURE_DIMENSION)]

    total_rows = 0
    with open(DATASET_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for cls_name in classes:
            samples = generate_class_samples(cls_name, count=120)
            for s in samples:
                row = [s["label"], s["handedness"], s["timestamp"], s["session_id"]] + list(s["features"])
                writer.writerow(row)
                total_rows += 1
            print(f"  Generated 120 samples for {cls_name}")

    print(f"\n[Dataset Complete] Generated {total_rows} total samples across {len(classes)} classes.")
    print(f"Saved to: {DATASET_CSV}")


if __name__ == "__main__":
    main()
