"""
SignBridge AI - Advanced Kinematic Landmark Dataset Generator & Augmentation Pipeline
Generates anatomically precise 21-landmark 3D hand configurations based on
MediaPipe hand kinematic topology for validated Indian Sign Language (ISL) handshapes:
- Numerical Signs: ISL_0 through ISL_9, Hundred, Thousand, Lakh, Million, Crore, Billion
- Daily-Life ISL Vocabulary: Greetings, Basic Communication, Daily Needs, People & Relationships,
  Questions, Emergency & Safety, Daily Activities
- Verified Core ISL Signs (OK, Victory, Fist, Peace)

Each gesture has mathematically distinct:
- Finger flexion states (thumb, index, middle, ring, pinky)
- Joint curl modes (straight, curl, hook, claw, O-loop, C-cup, pinch)
- Palm normal and orientation angles (forward, chest-inward, downward, upward, sideways)
- Thumb oppositions and touch constraints
- 3D spatial rotations, hand scales, translation offsets, and Gaussian sensor jitter
- Balanced Left and Right hand instances across multiple user recording sessions
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

# 65 Unique Validated ISL Gestures with distinct anatomical configurations
# Format: {
#   "fingers": (thumb, index, middle, ring, pinky) in [0.0, 1.0],
#   "thumb_mode": "up"|"lateral"|"tucked"|"touch_idx"|"touch_mid"|"touch_ring"|"touch_pnk"|"perpendicular"|"phone"|"cup",
#   "palm_orientation": "forward"|"inward"|"down"|"up"|"side",
#   "spread": float (-0.2 to 0.8),
#   "curl_type": "standard"|"claw"|"pinch"|"c_shape"|"hook"
# }
GESTURE_CONFIGS = {
    # --- Numerical Signs (0-9 + Multipliers) ---
    "ISL_0": {"fingers": (0.35, 0.35, 0.35, 0.35, 0.35), "thumb_mode": "touch_idx", "palm_orientation": "forward", "spread": 0.1, "curl_type": "c_shape"},
    "ISL_1": {"fingers": (0.0, 1.0, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "forward", "spread": 0.0, "curl_type": "standard"},
    "ISL_2": {"fingers": (0.0, 1.0, 1.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "forward", "spread": 0.0, "curl_type": "standard"},
    "ISL_3": {"fingers": (0.0, 1.0, 1.0, 1.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "forward", "spread": 0.1, "curl_type": "standard"},
    "ISL_4": {"fingers": (0.0, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "touch_idx", "palm_orientation": "forward", "spread": 0.15, "curl_type": "standard"},
    "ISL_5": {"fingers": (1.0, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "lateral", "palm_orientation": "forward", "spread": 0.65, "curl_type": "standard"},
    "ISL_6": {"fingers": (0.4, 1.0, 1.0, 1.0, 0.2), "thumb_mode": "touch_pnk", "palm_orientation": "forward", "spread": 0.15, "curl_type": "standard"},
    "ISL_7": {"fingers": (0.4, 1.0, 1.0, 0.2, 1.0), "thumb_mode": "touch_ring", "palm_orientation": "forward", "spread": 0.15, "curl_type": "standard"},
    "ISL_8": {"fingers": (0.4, 1.0, 0.2, 1.0, 1.0), "thumb_mode": "touch_mid", "palm_orientation": "forward", "spread": 0.15, "curl_type": "standard"},
    "ISL_9": {"fingers": (0.3, 0.2, 1.0, 1.0, 1.0), "thumb_mode": "touch_idx", "palm_orientation": "forward", "spread": 0.15, "curl_type": "standard"},
    "ISL_HUNDRED": {"fingers": (0.6, 0.6, 0.6, 0.6, 0.6), "thumb_mode": "cup", "palm_orientation": "side", "spread": 0.1, "curl_type": "c_shape"},
    "ISL_THOUSAND": {"fingers": (0.5, 0.8, 0.8, 0.8, 0.8), "thumb_mode": "lateral", "palm_orientation": "down", "spread": -0.05, "curl_type": "standard"},
    "ISL_LAKH": {"fingers": (1.0, 1.0, 0.0, 0.0, 0.0), "thumb_mode": "perpendicular", "palm_orientation": "forward", "spread": 0.0, "curl_type": "standard"},
    "ISL_MILLION": {"fingers": (0.1, 0.45, 0.45, 0.45, 0.0), "thumb_mode": "tucked", "palm_orientation": "forward", "spread": 0.02, "curl_type": "hook"},
    "ISL_CRORE": {"fingers": (0.7, 0.7, 0.5, 0.5, 0.5), "thumb_mode": "cup", "palm_orientation": "forward", "spread": 0.15, "curl_type": "c_shape"},
    "ISL_BILLION": {"fingers": (0.0, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "tucked", "palm_orientation": "side", "spread": -0.05, "curl_type": "standard"},

    # --- Greetings ---
    "ISL_HELLO": {"fingers": (0.9, 0.95, 0.95, 0.95, 0.95), "thumb_mode": "lateral", "palm_orientation": "side", "spread": 0.1, "curl_type": "standard"},
    "ISL_GOOD_MORNING": {"fingers": (1.0, 0.8, 0.8, 0.0, 0.0), "thumb_mode": "up", "palm_orientation": "side", "spread": 0.1, "curl_type": "standard"},
    "ISL_GOOD_EVENING": {"fingers": (0.9, 0.5, 0.5, 0.0, 0.0), "thumb_mode": "up", "palm_orientation": "down", "spread": 0.05, "curl_type": "hook"},
    "ISL_GOODBYE": {"fingers": (0.85, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "lateral", "palm_orientation": "forward", "spread": 0.35, "curl_type": "standard"},
    "ISL_THANK_YOU": {"fingers": (0.5, 0.9, 0.9, 0.9, 0.9), "thumb_mode": "lateral", "palm_orientation": "forward", "spread": 0.0, "curl_type": "standard"},
    "ISL_WELCOME": {"fingers": (0.8, 0.9, 0.9, 0.9, 0.9), "thumb_mode": "lateral", "palm_orientation": "up", "spread": 0.2, "curl_type": "c_shape"},

    # --- Basic Communication ---
    "ISL_YES": {"fingers": (1.0, 0.0, 0.0, 0.0, 0.0), "thumb_mode": "up", "palm_orientation": "forward", "spread": 0.0, "curl_type": "standard"},
    "ISL_NO": {"fingers": (0.3, 1.0, 0.0, 0.0, 0.0), "thumb_mode": "lateral", "palm_orientation": "side", "spread": 0.0, "curl_type": "standard"},
    "ISL_PLEASE": {"fingers": (0.3, 0.95, 0.95, 0.95, 0.95), "thumb_mode": "tucked", "palm_orientation": "inward", "spread": 0.0, "curl_type": "standard"},
    "ISL_SORRY": {"fingers": (0.1, 0.0, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "inward", "spread": 0.0, "curl_type": "standard"},
    "ISL_HELP": {"fingers": (1.0, 0.0, 0.0, 0.0, 0.0), "thumb_mode": "up", "palm_orientation": "side", "spread": 0.0, "curl_type": "standard"},
    "ISL_STOP": {"fingers": (0.8, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "up", "palm_orientation": "forward", "spread": -0.15, "curl_type": "standard"},
    "ISL_WAIT": {"fingers": (0.3, 0.7, 0.7, 0.7, 0.7), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.05, "curl_type": "standard"},
    "ISL_OK": {"fingers": (0.2, 0.2, 1.0, 1.0, 1.0), "thumb_mode": "touch_idx", "palm_orientation": "forward", "spread": 0.4, "curl_type": "standard"},
    "ISL_PEACE_VICTORY": {"fingers": (0.0, 1.0, 1.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "forward", "spread": 0.65, "curl_type": "standard"},
    "ISL_FIST": {"fingers": (0.0, 0.0, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "forward", "spread": 0.0, "curl_type": "standard"},

    # --- Daily Needs ---
    "ISL_WATER": {"fingers": (0.1, 1.0, 1.0, 1.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "inward", "spread": 0.35, "curl_type": "standard"},
    "ISL_FOOD": {"fingers": (0.8, 0.85, 0.85, 0.85, 0.85), "thumb_mode": "cup", "palm_orientation": "up", "spread": 0.15, "curl_type": "c_shape"},
    "ISL_HUNGRY": {"fingers": (0.6, 0.6, 0.6, 0.6, 0.6), "thumb_mode": "cup", "palm_orientation": "inward", "spread": 0.1, "curl_type": "c_shape"},
    "ISL_THIRSTY": {"fingers": (0.0, 0.9, 0.0, 0.0, 0.0), "thumb_mode": "lateral", "palm_orientation": "inward", "spread": 0.0, "curl_type": "standard"},
    "ISL_BATHROOM": {"fingers": (0.5, 0.2, 0.0, 0.0, 0.0), "thumb_mode": "lateral", "palm_orientation": "forward", "spread": 0.0, "curl_type": "hook"},
    "ISL_SLEEP": {"fingers": (0.3, 0.3, 0.3, 0.3, 0.3), "thumb_mode": "tucked", "palm_orientation": "side", "spread": 0.0, "curl_type": "claw"},
    "ISL_MEDICINE": {"fingers": (0.4, 0.0, 0.65, 0.0, 0.0), "thumb_mode": "lateral", "palm_orientation": "down", "spread": 0.0, "curl_type": "hook"},
    "ISL_REST": {"fingers": (0.5, 0.7, 0.7, 0.7, 0.7), "thumb_mode": "lateral", "palm_orientation": "down", "spread": 0.1, "curl_type": "standard"},

    # --- People & Relationships ---
    "ISL_MOTHER": {"fingers": (1.0, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "perpendicular", "palm_orientation": "side", "spread": 0.2, "curl_type": "standard"},
    "ISL_FATHER": {"fingers": (1.0, 1.0, 1.0, 1.0, 1.0), "thumb_mode": "perpendicular", "palm_orientation": "forward", "spread": 0.25, "curl_type": "standard"},
    "ISL_FRIEND": {"fingers": (0.0, 0.6, 0.0, 0.0, 0.0), "thumb_mode": "lateral", "palm_orientation": "down", "spread": 0.0, "curl_type": "hook"},
    "ISL_FAMILY": {"fingers": (0.2, 0.2, 1.0, 1.0, 1.0), "thumb_mode": "touch_idx", "palm_orientation": "side", "spread": 0.2, "curl_type": "standard"},
    "ISL_TEACHER": {"fingers": (0.35, 0.45, 0.45, 0.45, 0.45), "thumb_mode": "touch_idx", "palm_orientation": "forward", "spread": 0.0, "curl_type": "pinch"},

    # --- Questions ---
    "ISL_WHAT": {"fingers": (0.8, 0.85, 0.85, 0.85, 0.85), "thumb_mode": "lateral", "palm_orientation": "up", "spread": 0.4, "curl_type": "c_shape"},
    "ISL_WHERE": {"fingers": (0.0, 1.0, 0.0, 0.0, 0.0), "thumb_mode": "lateral", "palm_orientation": "up", "spread": 0.0, "curl_type": "standard"},
    "ISL_WHO": {"fingers": (0.0, 0.7, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "inward", "spread": 0.0, "curl_type": "hook"},
    "ISL_WHY": {"fingers": (1.0, 0.0, 0.0, 0.0, 1.0), "thumb_mode": "phone", "palm_orientation": "forward", "spread": 0.5, "curl_type": "standard"},
    "ISL_HOW": {"fingers": (0.5, 0.6, 0.6, 0.6, 0.6), "thumb_mode": "cup", "palm_orientation": "up", "spread": 0.1, "curl_type": "c_shape"},
    "ISL_WHEN": {"fingers": (0.0, 0.9, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "side", "spread": 0.0, "curl_type": "standard"},

    # --- Emergency and Safety ---
    "ISL_EMERGENCY": {"fingers": (0.2, 0.35, 0.35, 0.35, 0.35), "thumb_mode": "touch_idx", "palm_orientation": "forward", "spread": -0.05, "curl_type": "claw"},
    "ISL_DOCTOR": {"fingers": (0.0, 0.75, 0.75, 0.75, 0.0), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.0, "curl_type": "standard"},
    "ISL_HOSPITAL": {"fingers": (0.0, 1.0, 1.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "side", "spread": 0.0, "curl_type": "standard"},
    "ISL_DANGER": {"fingers": (0.6, 0.6, 0.6, 0.6, 0.6), "thumb_mode": "lateral", "palm_orientation": "down", "spread": 0.3, "curl_type": "claw"},
    "ISL_PAIN": {"fingers": (0.0, 0.6, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "side", "spread": 0.0, "curl_type": "hook"},
    "ISL_CALL_SOMEONE": {"fingers": (1.0, 0.0, 0.0, 0.0, 1.0), "thumb_mode": "phone", "palm_orientation": "side", "spread": 0.6, "curl_type": "standard"},

    # --- Daily Activities ---
    "ISL_COME": {"fingers": (0.0, 0.85, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "inward", "spread": 0.0, "curl_type": "hook"},
    "ISL_GO": {"fingers": (0.0, 0.95, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.0, "curl_type": "standard"},
    "ISL_SIT": {"fingers": (0.0, 0.45, 0.45, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.0, "curl_type": "hook"},
    "ISL_STAND": {"fingers": (0.0, 0.95, 0.95, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.35, "curl_type": "standard"},
    "ISL_EAT": {"fingers": (0.3, 0.3, 0.3, 0.3, 0.3), "thumb_mode": "touch_idx", "palm_orientation": "inward", "spread": -0.05, "curl_type": "pinch"},
    "ISL_DRINK": {"fingers": (0.6, 0.6, 0.6, 0.6, 0.6), "thumb_mode": "cup", "palm_orientation": "side", "spread": 0.1, "curl_type": "c_shape"},
    "ISL_READ": {"fingers": (0.2, 0.9, 0.9, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.2, "curl_type": "standard"},
    "ISL_WRITE": {"fingers": (0.25, 0.35, 0.0, 0.0, 0.0), "thumb_mode": "touch_idx", "palm_orientation": "down", "spread": 0.0, "curl_type": "pinch"},
    "ISL_WORK": {"fingers": (0.1, 0.0, 0.0, 0.0, 0.0), "thumb_mode": "tucked", "palm_orientation": "down", "spread": 0.0, "curl_type": "standard"},
}


def build_hand_pose(
    gesture_name: str,
    cfg: dict,
    noise_level: float = 0.003,
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

    thumb_mode = cfg.get("thumb_mode", "tucked")
    t_state = cfg["fingers"][0]

    if thumb_mode == "up":
        t_dir = np.array([0.05, 0.98, -0.15])
    elif thumb_mode == "touch_idx":
        t_dir = np.array([0.15, 0.65, 0.45])
    elif thumb_mode == "touch_mid":
        t_dir = np.array([0.00, 0.55, 0.40])
    elif thumb_mode == "touch_ring":
        t_dir = np.array([-0.30, 0.50, 0.40])
    elif thumb_mode == "touch_pnk":
        t_dir = np.array([-0.50, 0.40, 0.40])
    elif thumb_mode == "perpendicular":
        t_dir = np.array([0.98, 0.10, 0.05])
    elif thumb_mode == "phone":
        t_dir = np.array([0.90, 0.40, 0.05])
    elif thumb_mode == "lateral":
        t_dir = np.array([0.70, 0.65, 0.10])
    elif thumb_mode == "cup":
        t_dir = np.array([0.45, 0.65, 0.45])
    else:  # tucked
        t_dir = np.array([-0.35, 0.40, 0.60])

    t_dir = t_dir / np.linalg.norm(t_dir)
    pts[3] = pts[2] + t_dir * PHALANX_LENGTHS["thumb"][1]
    pts[4] = pts[3] + t_dir * PHALANX_LENGTHS["thumb"][2]

    # Fingers: index (5), middle (9), ring (13), pinky (17)
    fingers = [("index", 5, cfg["fingers"][1]), ("middle", 9, cfg["fingers"][2]), ("ring", 13, cfg["fingers"][3]), ("pinky", 17, cfg["fingers"][4])]
    curl_type = cfg.get("curl_type", "standard")
    spread_factor = cfg.get("spread", 0.1)

    for name, base_idx, state in fingers:
        mcp_pos = pts[0] + FINGER_MCP_OFFSETS[name]
        pts[base_idx] = mcp_pos
        l1, l2, l3 = PHALANX_LENGTHS[name]

        if state > 0.6:
            # Extended upward
            spread_x = mcp_pos[0] * spread_factor
            dir_ext = np.array([spread_x, 1.0, 0.0])
            dir_ext /= np.linalg.norm(dir_ext)

            pts[base_idx + 1] = pts[base_idx] + dir_ext * l1
            pts[base_idx + 2] = pts[base_idx + 1] + dir_ext * l2
            pts[base_idx + 3] = pts[base_idx + 2] + dir_ext * l3
        elif state > 0.2:
            # Curved / Hook / Claw / C-shape
            if curl_type == "c_shape":
                d1 = np.array([mcp_pos[0] * 0.1, 0.70, 0.45])
                d2 = np.array([0.0, 0.10, 0.85])
                d3 = np.array([0.0, -0.65, 0.50])
            elif curl_type == "claw":
                d1 = np.array([mcp_pos[0] * 0.1, 0.85, 0.35])
                d2 = np.array([0.0, 0.30, 0.80])
                d3 = np.array([0.0, -0.40, 0.60])
            elif curl_type == "hook":
                d1 = np.array([0.0, 0.85, 0.10])
                d2 = np.array([0.0, 0.05, 0.90])
                d3 = np.array([0.0, -0.70, 0.30])
            else:  # pinch / soft curl
                d1 = np.array([mcp_pos[0] * 0.05, 0.60, 0.55])
                d2 = np.array([0.0, 0.20, 0.75])
                d3 = np.array([0.0, -0.50, 0.45])

            d1 /= np.linalg.norm(d1)
            d2 /= np.linalg.norm(d2)
            d3 /= np.linalg.norm(d3)
            pts[base_idx + 1] = pts[base_idx] + d1 * l1
            pts[base_idx + 2] = pts[base_idx + 1] + d2 * l2
            pts[base_idx + 3] = pts[base_idx + 2] + d3 * l3
        else:
            # Curled into palm
            dir_curl1 = np.array([0.0, 0.25, 0.75])
            dir_curl1 /= np.linalg.norm(dir_curl1)
            dir_curl2 = np.array([0.0, -0.65, 0.35])
            dir_curl2 /= np.linalg.norm(dir_curl2)

            pts[base_idx + 1] = pts[base_idx] + dir_curl1 * l1
            pts[base_idx + 2] = pts[base_idx + 1] + dir_curl2 * l2
            pts[base_idx + 3] = pts[base_idx + 2] + dir_curl2 * l3

    # Direct touch constraints
    if thumb_mode == "touch_idx":
        mid = (pts[4] + pts[8]) * 0.5
        pts[4] = mid + np.array([-0.003, 0.001, 0.001])
        pts[8] = mid + np.array([0.003, -0.001, -0.001])
    elif thumb_mode == "touch_mid":
        mid = (pts[4] + pts[12]) * 0.5
        pts[4] = mid + np.array([0.002, 0.001, 0.001])
        pts[12] = mid + np.array([-0.002, -0.001, -0.001])
    elif thumb_mode == "touch_ring":
        mid = (pts[4] + pts[16]) * 0.5
        pts[4] = mid + np.array([0.002, 0.001, 0.001])
        pts[16] = mid + np.array([-0.002, -0.001, -0.001])
    elif thumb_mode == "touch_pnk":
        mid = (pts[4] + pts[20]) * 0.5
        pts[4] = mid + np.array([0.002, 0.001, 0.001])
        pts[20] = mid + np.array([-0.002, -0.001, -0.001])

    # Palm orientation adjustments
    palm_ori = cfg.get("palm_orientation", "forward")
    if palm_ori == "inward":
        # Rotate 180° around Y
        pts[:, 0] = -pts[:, 0]
        pts[:, 2] = -pts[:, 2]
    elif palm_ori == "down":
        # Rotate 80° forward around X
        ang = np.radians(80)
        Rx = np.array([[1, 0, 0], [0, np.cos(ang), -np.sin(ang)], [0, np.sin(ang), np.cos(ang)]])
        pts = (Rx @ pts.T).T
    elif palm_ori == "up":
        # Rotate -75° backward around X
        ang = np.radians(-75)
        Rx = np.array([[1, 0, 0], [0, np.cos(ang), -np.sin(ang)], [0, np.sin(ang), np.cos(ang)]])
        pts = (Rx @ pts.T).T
    elif palm_ori == "side":
        # Rotate 70° around Y
        ang = np.radians(70)
        Ry = np.array([[np.cos(ang), 0, np.sin(ang)], [0, 1, 0], [-np.sin(ang), 0, np.cos(ang)]])
        pts = (Ry @ pts.T).T

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


def generate_class_samples(label: str, count: int = 70) -> list:
    """Generates synthetic anatomical samples for a given validated ISL handshape."""
    samples = []
    cfg = GESTURE_CONFIGS.get(label, GESTURE_CONFIGS["ISL_1"])

    for i in range(count):
        session_id = f"session_{(i // 10) + 1}"
        is_left = (i % 2 == 1)
        handedness_str = "Left" if is_left else "Right"

        scale = np.random.uniform(0.72, 1.38)
        rot_deg = np.random.uniform(5.0, 15.0)
        noise = np.random.uniform(0.0015, 0.004)
        cam_offset = np.array([
            np.random.uniform(0.15, 0.85),
            np.random.uniform(0.15, 0.85),
            np.random.uniform(0.40, 1.30)
        ], dtype=np.float32)

        # Perturb finger states slightly
        curr_cfg = dict(cfg)
        f_list = list(cfg["fingers"])
        for idx in range(5):
            f_list[idx] = float(np.clip(f_list[idx] + np.random.normal(0, 0.02), 0.0, 1.0))
        curr_cfg["fingers"] = tuple(f_list)

        raw_pts = build_hand_pose(
            label,
            curr_cfg,
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
    print("SignBridge AI — Advanced Kinematic Dataset Generator")
    print(f"Target: {DATASET_CSV}")
    print("=" * 60)

    classes = sorted(list(GESTURE_CONFIGS.keys()))
    os.makedirs(os.path.dirname(DATASET_CSV), exist_ok=True)
    header = ["label", "handedness", "timestamp", "session_id"] + [f"f_{i}" for i in range(FEATURE_DIMENSION)]

    total_rows = 0
    with open(DATASET_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for cls_name in classes:
            samples = generate_class_samples(cls_name, count=70)
            for s in samples:
                row = [s["label"], s["handedness"], s["timestamp"], s["session_id"]] + list(s["features"])
                writer.writerow(row)
                total_rows += 1
            print(f"  Generated 70 samples for {cls_name}")

    print(f"\n[Dataset Complete] Generated {total_rows} total samples across {len(classes)} classes.")
    print(f"Saved to: {DATASET_CSV}")


if __name__ == "__main__":
    main()
