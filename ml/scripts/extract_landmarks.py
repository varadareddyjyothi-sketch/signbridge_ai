"""
SignBridge AI - Landmark Extraction Utility
Extracts 21 MediaPipe hand landmarks from an image or video file and converts them to normalized features.
"""

import os
import sys
import json
import argparse
from typing import Optional, List, Dict
import cv2
import mediapipe as mp
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml.features import normalize_landmarks, FEATURE_DIMENSION


def extract_landmarks_from_image(image_path: str) -> Optional[Dict]:
    """Processes an image file, runs MediaPipe Hand Landmarker, and returns normalized 63-d features."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not load image: {image_path}")

    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_hands = mp.solutions.hands

    with mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=1,
        min_detection_confidence=0.5
    ) as hands:
        results = hands.process(rgb_image)
        if not results.multi_hand_landmarks:
            return None

        hand_landmarks = results.multi_hand_landmarks[0]
        handedness = "Right"
        if results.multi_handedness:
            handedness = results.multi_handedness[0].classification[0].label

        lm_list = [{"x": lm.x, "y": lm.y, "z": lm.z} for lm in hand_landmarks.landmark]
        features = normalize_landmarks(lm_list, handedness=handedness)

        return {
            "image_path": image_path,
            "handedness": handedness,
            "raw_landmarks": lm_list,
            "features": features.tolist()
        }


def main():
    parser = argparse.ArgumentParser(description="Extract landmarks from an image")
    parser.add_argument("image", type=str, help="Path to image file")
    parser.add_argument("--json-out", type=str, default=None, help="Save output JSON to file")
    args = parser.parse_args()

    result = extract_landmarks_from_image(args.image)
    if result is None:
        print(f"[No Hand Detected] Could not extract landmarks from {args.image}")
    else:
        print(f"[Success] Extracted {FEATURE_DIMENSION} normalized features from {args.image} (Handedness: {result['handedness']})")
        if args.json_out:
            with open(args.json_out, "w") as f:
                json.dump(result, f, indent=2)
            print(f"Saved to {args.json_out}")


if __name__ == "__main__":
    main()
