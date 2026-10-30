"""
SignBridge AI - Landmark Feature Extraction & Normalization Module
Standardizes 21 MediaPipe hand landmarks into a translation-invariant,
scale-invariant, and handedness-consistent 63-dimensional feature vector.
"""

from typing import List, Dict, Any, Optional, Tuple, Union
import numpy as np

# Total MediaPipe hand landmarks
NUM_LANDMARKS = 21
COORDINATES_PER_LANDMARK = 3  # (x, y, z)
FEATURE_DIMENSION = NUM_LANDMARKS * COORDINATES_PER_LANDMARK  # 63


def validate_landmarks(landmarks: Union[List[Dict[str, float]], List[List[float]], np.ndarray]) -> np.ndarray:
    """
    Validates and standardizes input landmarks into an (N, 3) numpy array.
    Accepts:
      - List of dicts: [{'x': ..., 'y': ..., 'z': ...}, ...]
      - List of lists: [[x, y, z], ...]
      - Numpy array: shape (21, 3) or flattened (63,)
    Raises ValueError on invalid dimensions or non-finite values.
    """
    if landmarks is None:
        raise ValueError("Landmarks cannot be None")

    if isinstance(landmarks, list) and len(landmarks) > 0 and isinstance(landmarks[0], dict):
        coords = []
        for i, pt in enumerate(landmarks):
            if not isinstance(pt, dict) or 'x' not in pt or 'y' not in pt:
                raise ValueError(f"Landmark index {i} is missing 'x' or 'y' coordinates")
            x = float(pt.get('x', 0.0))
            y = float(pt.get('y', 0.0))
            z = float(pt.get('z', 0.0))
            coords.append([x, y, z])
        arr = np.array(coords, dtype=np.float32)
    else:
        arr = np.array(landmarks, dtype=np.float32)

    if arr.ndim == 1:
        if arr.shape[0] != FEATURE_DIMENSION:
            raise ValueError(f"Flattened landmark array must have {FEATURE_DIMENSION} elements, got {arr.shape[0]}")
        arr = arr.reshape((NUM_LANDMARKS, COORDINATES_PER_LANDMARK))

    if arr.shape != (NUM_LANDMARKS, COORDINATES_PER_LANDMARK):
        raise ValueError(
            f"Landmark array shape must be ({NUM_LANDMARKS}, {COORDINATES_PER_LANDMARK}), got {arr.shape}"
        )

    if not np.all(np.isfinite(arr)):
        raise ValueError("Landmarks contain NaN or Infinite values")

    return arr


def normalize_landmarks(
    landmarks: Union[List[Dict[str, float]], List[List[float]], np.ndarray],
    handedness: Optional[str] = None
) -> np.ndarray:
    """
    Normalizes 21 3D landmarks:
      1. Translation: shifts wrist landmark (index 0) to origin (0, 0, 0).
      2. Handedness: if Left hand, mirrors x-axis so left and right hands map to canonical space.
      3. Scale: divides by the maximum Euclidean distance from wrist to any landmark.
    Returns:
      Flattened 1D numpy array of shape (63,) with all coordinates normalized in [-1, 1].
    """
    arr = validate_landmarks(landmarks)

    # 1. Translation: wrist (index 0) as reference origin
    wrist = arr[0, :].copy()
    translated = arr - wrist

    # 2. Handedness normalization (mirror x if Left hand)
    if handedness and handedness.strip().lower() == "left":
        translated[:, 0] = -translated[:, 0]

    # 3. Scale normalization: max Euclidean distance from origin
    distances = np.linalg.norm(translated, axis=1)
    max_dist = float(np.max(distances))

    if max_dist > 1e-6:
        normalized = translated / max_dist
    else:
        normalized = translated

    return normalized.flatten()


def _safe_unit_vector(v: np.ndarray, eps: float = 1e-7) -> np.ndarray:
    norm = np.linalg.norm(v)
    if norm > eps:
        return v / norm
    return np.zeros_like(v)


def _compute_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    """Computes the angle at joint p2 between vectors (p1 - p2) and (p3 - p2) in radians."""
    v1 = p1 - p2
    v2 = p3 - p2
    u1 = _safe_unit_vector(v1)
    u2 = _safe_unit_vector(v2)
    dot = np.clip(np.dot(u1, u2), -1.0, 1.0)
    return float(np.arccos(dot) / np.pi)  # Normalized to [0, 1]


def extract_kinematic_features(coords_21x3: np.ndarray) -> np.ndarray:
    """
    Extracts 46 geometric invariant features from 21 canonical 3D landmarks:
      - 14 joint flexion angles (normalized [0, 1])
      - 10 pairwise fingertip Euclidean distances
      - 5 fingertip-to-wrist Euclidean distances
      - 5 fingertip-to-MCP extension ratios
      - 4 inter-finger spread angles (normalized [0, 1])
      - 3 palm plane normal vector coordinates (Nx, Ny, Nz)
      - 5 relative vertical elevations (tip y - MCP y)
    """
    pts = coords_21x3.reshape((NUM_LANDMARKS, COORDINATES_PER_LANDMARK))

    features = []

    # 1. 14 Joint Flexion Angles
    # Thumb: angle at 2 (1-2-3), angle at 3 (2-3-4)
    features.append(_compute_angle(pts[1], pts[2], pts[3]))
    features.append(_compute_angle(pts[2], pts[3], pts[4]))

    # Index: angle at 5 (0-5-6), angle at 6 (5-6-7), angle at 7 (6-7-8)
    features.append(_compute_angle(pts[0], pts[5], pts[6]))
    features.append(_compute_angle(pts[5], pts[6], pts[7]))
    features.append(_compute_angle(pts[6], pts[7], pts[8]))

    # Middle: angle at 9 (0-9-10), angle at 10 (9-10-11), angle at 11 (10-11-12)
    features.append(_compute_angle(pts[0], pts[9], pts[10]))
    features.append(_compute_angle(pts[9], pts[10], pts[11]))
    features.append(_compute_angle(pts[10], pts[11], pts[12]))

    # Ring: angle at 13 (0-13-14), angle at 14 (13-14-15), angle at 15 (14-15-16)
    features.append(_compute_angle(pts[0], pts[13], pts[14]))
    features.append(_compute_angle(pts[13], pts[14], pts[15]))
    features.append(_compute_angle(pts[14], pts[15], pts[16]))

    # Pinky: angle at 17 (0-17-18), angle at 18 (17-18-19), angle at 19 (18-19-20)
    features.append(_compute_angle(pts[0], pts[17], pts[18]))
    features.append(_compute_angle(pts[17], pts[18], pts[19]))
    features.append(_compute_angle(pts[18], pts[19], pts[20]))

    # Reference palm scale (distance from wrist 0 to middle MCP 9)
    palm_span = max(float(np.linalg.norm(pts[9] - pts[0])), 0.1)

    # 2. 10 Pairwise Fingertip Distances (tips: 4, 8, 12, 16, 20)
    tips = [4, 8, 12, 16, 20]
    for i in range(len(tips)):
        for j in range(i + 1, len(tips)):
            d = float(np.linalg.norm(pts[tips[i]] - pts[tips[j]])) / palm_span
            features.append(d)

    # 3. 5 Fingertip-to-Wrist Distances
    for tip in tips:
        d = float(np.linalg.norm(pts[tip] - pts[0])) / palm_span
        features.append(d)

    # 4. 5 Fingertip-to-MCP Extension Ratios
    mcps = [2, 5, 9, 13, 17]
    for tip, mcp in zip(tips, mcps):
        d_tip = float(np.linalg.norm(pts[tip] - pts[0]))
        d_mcp = max(float(np.linalg.norm(pts[mcp] - pts[0])), 1e-4)
        features.append(d_tip / d_mcp)

    # 5. 4 Inter-finger Spread Angles (Rays from MCP to Tip)
    ray_thumb = pts[4] - pts[2]
    ray_index = pts[8] - pts[5]
    ray_middle = pts[12] - pts[9]
    ray_ring = pts[16] - pts[13]
    ray_pinky = pts[20] - pts[17]

    def _ray_angle(r1: np.ndarray, r2: np.ndarray) -> float:
        u1 = _safe_unit_vector(r1)
        u2 = _safe_unit_vector(r2)
        dot = np.clip(np.dot(u1, u2), -1.0, 1.0)
        return float(np.arccos(dot) / np.pi)

    features.append(_ray_angle(ray_thumb, ray_index))
    features.append(_ray_angle(ray_index, ray_middle))
    features.append(_ray_angle(ray_middle, ray_ring))
    features.append(_ray_angle(ray_ring, ray_pinky))

    # 6. Palm Plane Normal Vector (cross product of wrist->index MCP and wrist->pinky MCP)
    v_idx = pts[5] - pts[0]
    v_pnk = pts[17] - pts[0]
    normal = np.cross(v_idx, v_pnk)
    normal = _safe_unit_vector(normal)
    features.extend([float(normal[0]), float(normal[1]), float(normal[2])])

    # 7. Relative Fingertip Heights vs MCP (Tip y - MCP y)
    for tip, mcp in zip(tips, mcps):
        features.append(float(pts[tip, 1] - pts[mcp, 1]))

    return np.array(features, dtype=np.float32)


ENHANCED_FEATURE_DIMENSION = FEATURE_DIMENSION + 46  # 63 + 46 = 109


def extract_model_features(
    landmarks: Union[List[Dict[str, float]], List[List[float]], np.ndarray],
    handedness: Optional[str] = None
) -> np.ndarray:
    """
    Extracts the full 109-dimensional feature vector for machine learning classification:
      - 63 translation, scale, and handedness-normalized coordinates
      - 46 rotation, scale, and view-invariant kinematic geometric features
    """
    if isinstance(landmarks, np.ndarray) and landmarks.shape == (FEATURE_DIMENSION,):
        norm_63 = landmarks.astype(np.float32)
    elif isinstance(landmarks, (list, tuple)) and len(landmarks) == FEATURE_DIMENSION and isinstance(landmarks[0], (int, float)):
        norm_63 = np.array(landmarks, dtype=np.float32)
    else:
        norm_63 = normalize_landmarks(landmarks, handedness=handedness)

    kinematic = extract_kinematic_features(norm_63)
    return np.concatenate([norm_63, kinematic])


def extract_features_from_dict(raw_data: Dict[str, Any]) -> Tuple[np.ndarray, Optional[str]]:
    """
    Convenience function to extract features from a payload containing 'landmarks' and optional 'handedness'.
    """
    if "landmarks" not in raw_data:
        raise ValueError("Payload missing 'landmarks' key")
    
    landmarks = raw_data["landmarks"]
    handedness = raw_data.get("handedness")
    features = normalize_landmarks(landmarks, handedness=handedness)
    return features, handedness

