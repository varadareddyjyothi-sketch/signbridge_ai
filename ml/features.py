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
