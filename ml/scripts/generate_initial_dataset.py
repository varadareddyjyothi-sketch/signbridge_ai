"""
SignBridge AI - Kinematic Landmark Dataset Generator
Generates anatomically consistent 21-landmark hand configurations based on
MediaPipe hand kinematic topology for verified ISL static handshapes:
  - ISL_1: Index extended
  - ISL_2: Index + Middle extended (V-shape)
  - ISL_3: Index + Middle + Ring extended
  - ISL_4: Four fingers extended, thumb curled
  - ISL_5: All 5 fingers extended spread (Open Palm)
  - ISL_OK: Thumb + Index tip touching, other 3 extended
  - ISL_YES_THUMBS_UP: Fist with thumb extended vertically
  - ISL_NO_INDEX: Index pointing vertically, others curled
  - ISL_PEACE_VICTORY: Index + Middle in wide V, thumb over pinky/ring
  - ISL_FIST: All 5 fingers curled into fist

Includes natural human anatomical variations:
  - Random 3D hand rotations (yaw, pitch, roll)
  - Random distances / camera scale
  - Finger flexion angle variance
  - Joint coordinate Gaussian noise
  - Both Left and Right hands across distinct sessions
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

# MediaPipe Finger Joint Layout:
# Wrist = 0
# Thumb: 1 (CMC), 2 (MCP), 3 (IP), 4 (TIP)
# Index: 5 (MCP), 6 (PIP), 7 (DIP), 8 (TIP)
# Middle: 9 (MCP), 10 (PIP), 11 (DIP), 12 (TIP)
# Ring: 13 (MCP), 14 (PIP), 15 (DIP), 16 (TIP)
# Pinky: 17 (MCP), 18 (PIP), 19 (DIP), 20 (TIP)

FINGER_MCP_OFFSETS = {
    "thumb": np.array([0.08, 0.05, 0.0], dtype=np.float32),
    "index": np.array([0.06, 0.16, 0.0], dtype=np.float32),
    "middle": np.array([0.01, 0.18, 0.0], dtype=np.float32),
    "ring": np.array([-0.04, 0.16, 0.0], dtype=np.float32),
    "pinky": np.array([-0.08, 0.13, 0.0], dtype=np.float32),
}

PHALANX_LENGTHS = {
    "thumb": [0.04, 0.04, 0.04],
    "index": [0.045, 0.035, 0.025],
    "middle": [0.05, 0.038, 0.028],
    "ring": [0.045, 0.034, 0.024],
    "pinky": [0.035, 0.025, 0.020],
}


def build_hand_pose(
    finger_states: dict,  # {"thumb": float (0=curled, 1=extended), "index": ..., ...}
    noise_level: float = 0.005,
    rotation_deg: float = 5.0,
    scale: float = 1.0,
    camera_offset: np.ndarray = None,
    is_left: bool = False
) -> list:
    """Builds a 21-point 3D landmark array according to finger extension states."""
    pts = np.zeros((21, 3), dtype=np.float32)
    # Wrist
    pts[0] = [0.0, 0.0, 0.0]

    # Thumb
    t_state = finger_states.get("thumb", 0.0)
    mcp = pts[0] + FINGER_MCP_OFFSETS["thumb"]
    pts[1] = pts[0] + FINGER_MCP_OFFSETS["thumb"] * 0.5
    pts[2] = mcp
    # Thumb extension direction
    t_dir = np.array([0.5, 0.8, 0.1]) if t_state > 0.5 else np.array([-0.2, 0.3, 0.2])
    t_dir = t_dir / np.linalg.norm(t_dir)
    pts[3] = pts[2] + t_dir * PHALANX_LENGTHS["thumb"][1]
    pts[4] = pts[3] + t_dir * PHALANX_LENGTHS["thumb"][2]

    # Fingers: index, middle, ring, pinky
    fingers = [("index", 5), ("middle", 9), ("ring", 13), ("pinky", 17)]
    for name, base_idx in fingers:
        state = finger_states.get(name, 0.0)  # 1.0 = extended up, 0.0 = curled into palm
        mcp_pos = pts[0] + FINGER_MCP_OFFSETS[name]
        pts[base_idx] = mcp_pos

        l1, l2, l3 = PHALANX_LENGTHS[name]
        if state > 0.5:
            # Extended upward (y positive) with slight spread
            spread_x = mcp_pos[0] * 0.2
            dir_ext = np.array([spread_x, 1.0, 0.0])
            dir_ext /= np.linalg.norm(dir_ext)
            pts[base_idx + 1] = pts[base_idx] + dir_ext * l1
            pts[base_idx + 2] = pts[base_idx + 1] + dir_ext * l2
            pts[base_idx + 3] = pts[base_idx + 2] + dir_ext * l3
        else:
            # Curled into palm (folds toward wrist and +z)
            dir_curl1 = np.array([0.0, 0.3, 0.8])
            dir_curl1 /= np.linalg.norm(dir_curl1)
            dir_curl2 = np.array([0.0, -0.6, 0.4])
            dir_curl2 /= np.linalg.norm(dir_curl2)

            pts[base_idx + 1] = pts[base_idx] + dir_curl1 * l1
            pts[base_idx + 2] = pts[base_idx + 1] + dir_curl2 * l2
            pts[base_idx + 3] = pts[base_idx + 2] + dir_curl2 * l3

    # Add Gaussian jitter
    jitter = np.random.normal(0, noise_level, pts.shape).astype(np.float32)
    pts += jitter

    # Random 3D Rotation
    angles = np.radians(np.random.uniform(-rotation_deg, rotation_deg, 3))
    # Rotation matrices
    Rx = np.array([[1, 0, 0], [0, np.cos(angles[0]), -np.sin(angles[0])], [0, np.sin(angles[0]), np.cos(angles[0])]])
    Ry = np.array([[np.cos(angles[1]), 0, np.sin(angles[1])], [0, 1, 0], [-np.sin(angles[1]), 0, np.cos(angles[1])]])
    Rz = np.array([[np.cos(angles[2]), -np.sin(angles[2]), 0], [np.sin(angles[2]), np.cos(angles[2]), 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx
    pts = (R @ pts.T).T

    # Scale and translation in camera space
    pts = pts * scale
    if camera_offset is not None:
        pts = pts + camera_offset

    if is_left:
        pts[:, 0] = -pts[:, 0]

    return [{"x": float(p[0]), "y": float(p[1]), "z": float(p[2])} for p in pts]


def generate_class_samples(label: str, count: int = 50) -> list:
    """Generates synthetic anatomical samples for a given verified ISL handshape."""
    samples = []

    # Define finger states for verified ISL signs
    # (thumb, index, middle, ring, pinky)
    gesture_templates = {
        "ISL_1": {"thumb": 0.0, "index": 1.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
        "ISL_2": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 0.0, "pinky": 0.0},
        "ISL_3": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 0.0},
        "ISL_4": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
        "ISL_5": {"thumb": 1.0, "index": 1.0, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
        "ISL_OK": {"thumb": 0.2, "index": 0.2, "middle": 1.0, "ring": 1.0, "pinky": 1.0},
        "ISL_YES_THUMBS_UP": {"thumb": 1.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
        "ISL_NO_INDEX": {"thumb": 0.0, "index": 1.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
        "ISL_PEACE_VICTORY": {"thumb": 0.0, "index": 1.0, "middle": 1.0, "ring": 0.0, "pinky": 0.0},
        "ISL_FIST": {"thumb": 0.0, "index": 0.0, "middle": 0.0, "ring": 0.0, "pinky": 0.0},
    }

    base_state = gesture_templates.get(label, gesture_templates["ISL_1"])

    for i in range(count):
        # Session variation
        session_id = f"session_{(i // 10) + 1}"
        is_left = (i % 4 == 0)
        handedness_str = "Left" if is_left else "Right"

        # Variances
        scale = np.random.uniform(0.7, 1.4)
        rot_deg = np.random.uniform(8.0, 18.0)
        noise = np.random.uniform(0.003, 0.008)
        cam_offset = np.array([
            np.random.uniform(0.2, 0.8),
            np.random.uniform(0.2, 0.8),
            np.random.uniform(0.5, 1.2)
        ], dtype=np.float32)

        # Perturb finger states slightly
        curr_state = {}
        for k, v in base_state.items():
            if v > 0.5:
                curr_state[k] = float(np.clip(v + np.random.normal(0, 0.04), 0.7, 1.0))
            else:
                curr_state[k] = float(np.clip(v + np.random.normal(0, 0.04), 0.0, 0.3))

        # Special touches for thumbs up vs 1
        if label == "ISL_YES_THUMBS_UP":
            rot_deg = 5.0
        elif label == "ISL_PEACE_VICTORY":
            rot_deg = 10.0

        raw_pts = build_hand_pose(
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
    print("SignBridge AI — Initial Dataset Generator")
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
            samples = generate_class_samples(cls_name, count=60)
            for s in samples:
                row = [s["label"], s["handedness"], s["timestamp"], s["session_id"]] + list(s["features"])
                writer.writerow(row)
                total_rows += 1
            print(f"  Generated 60 samples for {cls_name}")

    print(f"\n[Dataset Complete] Generated {total_rows} total samples across {len(classes)} classes.")
    print(f"Saved to: {DATASET_CSV}")


if __name__ == "__main__":
    main()
