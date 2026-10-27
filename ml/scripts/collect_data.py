"""
SignBridge AI - Dataset Collection Script (OpenCV + MediaPipe)
Allows interactive collection of 21-landmark hand gesture samples from webcam.
Saves normalized 63-dimensional feature vectors + metadata to CSV.
"""

import os
import sys
import time
import csv
import argparse
from typing import List
import cv2
import mediapipe as mp
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml.features import normalize_landmarks, FEATURE_DIMENSION

DEFAULT_DATASET_PATH = os.path.join("ml", "dataset", "isl_landmarks_dataset.csv")

VERIFIED_ISL_CLASSES = [
    "ISL_1",               # Index finger extended (Number 1)
    "ISL_2",               # Index + Middle extended (Number 2)
    "ISL_3",               # Index + Middle + Ring extended (Number 3)
    "ISL_4",               # Four fingers extended (Number 4)
    "ISL_5",               # All 5 fingers open/spread (Number 5 / Open Palm)
    "ISL_OK",              # Thumb + index touching circle, 3 fingers extended
    "ISL_YES_THUMBS_UP",   # Fist with thumb pointing upward (Affirmative/Good)
    "ISL_NO_INDEX",        # Single index extended firm stance (No/Stop)
    "ISL_PEACE_VICTORY",   # V-sign palm forward
    "ISL_FIST"             # Closed fist (ISL handshape S)
]


def init_dataset_file(filepath: str):
    """Creates the dataset CSV with header if it doesn't exist."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    if not os.path.exists(filepath):
        header = ["label", "handedness", "timestamp", "session_id"] + [f"f_{i}" for i in range(FEATURE_DIMENSION)]
        with open(filepath, mode="w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(header)
        print(f"[Dataset] Initialized new dataset file: {filepath}")


def count_samples_per_class(filepath: str):
    """Returns a dictionary with sample counts for each class."""
    if not os.path.exists(filepath):
        return {}
    counts = {}
    with open(filepath, mode="r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lbl = row.get("label", "unknown")
            counts[lbl] = counts.get(lbl, 0) + 1
    return counts


def main():
    parser = argparse.ArgumentParser(description="SignBridge AI - Landmark Dataset Collector")
    parser.add_argument("--output", type=str, default=DEFAULT_DATASET_PATH, help="Path to output CSV")
    parser.add_argument("--camera", type=int, default=0, help="Webcam device index")
    parser.add_argument("--session", type=str, default=f"session_{int(time.time())}", help="Session identifier")
    args = parser.parse_args()

    init_dataset_file(args.output)
    existing_counts = count_samples_per_class(args.output)

    print("=" * 60)
    print("SignBridge AI — Dataset Collector")
    print(f"Target CSV: {args.output}")
    print(f"Session ID: {args.session}")
    print("Available verified ISL gesture classes:")
    for idx, c in enumerate(VERIFIED_ISL_CLASSES):
        curr_count = existing_counts.get(c, 0)
        print(f"  [{idx}] {c} ({curr_count} samples collected)")
    print("=" * 60)

    selected_class_idx = 0
    selected_class = VERIFIED_ISL_CLASSES[selected_class_idx]

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"[Error] Could not open webcam index {args.camera}.")
        print("Note: In headless or non-GUI environments, use the SignBridge Web Studio Dataset Collector!")
        return

    mp_hands = mp.solutions.hands
    mp_draw = mp.solutions.drawing_utils

    with mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.6
    ) as hands:
        print("\nControls:")
        print("  - [0-9]: Select gesture class")
        print("  - [SPACE]: Save single frame sample")
        print("  - [C]: Toggle continuous recording (captures valid frames every 150ms)")
        print("  - [Q] or [ESC]: Quit\n")

        continuous_mode = False
        last_continuous_capture = 0.0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("[Warning] Failed to read frame from webcam.")
                break

            # Mirror for natural user interaction
            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            results = hands.process(rgb_frame)

            detected = False
            features = None
            handedness_str = "Right"

            if results.multi_hand_landmarks and results.multi_handedness:
                detected = True
                hand_landmarks = results.multi_hand_landmarks[0]
                handedness_info = results.multi_handedness[0]
                handedness_str = handedness_info.classification[0].label  # 'Left' or 'Right'

                # Draw skeleton
                mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

                # Convert to standard format
                lm_list = []
                for lm in hand_landmarks.landmark:
                    lm_list.append({"x": lm.x, "y": lm.y, "z": lm.z})

                try:
                    features = normalize_landmarks(lm_list, handedness=handedness_str)
                except Exception as e:
                    features = None

            # Overlay status
            status_color = (0, 255, 0) if detected else (0, 0, 255)
            status_text = f"Hand: {'DETECTED (' + handedness_str + ')' if detected else 'NO HAND'}"
            cv2.putText(frame, status_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)

            class_text = f"Target: [{selected_class_idx}] {selected_class} ({existing_counts.get(selected_class, 0)} samples)"
            cv2.putText(frame, class_text, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 0), 2)

            mode_text = f"Continuous Mode: {'RECORDING' if continuous_mode else 'OFF'} [Press C]"
            cv2.putText(frame, mode_text, (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

            cv2.imshow("SignBridge AI - Dataset Collection Studio", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == 27 or key == ord('q') or key == ord('Q'):
                break
            elif ord('0') <= key <= ord('9'):
                idx = key - ord('0')
                if idx < len(VERIFIED_ISL_CLASSES):
                    selected_class_idx = idx
                    selected_class = VERIFIED_ISL_CLASSES[selected_class_idx]
                    print(f"[Selection] Switched target class to: {selected_class}")
            elif key == ord('c') or key == ord('C'):
                continuous_mode = not continuous_mode
                print(f"[Mode] Continuous capture: {'ON' if continuous_mode else 'OFF'}")

            # Capture condition: Space pressed or Continuous mode timer
            now = time.time()
            should_save = False
            if key == 32:  # Space
                should_save = True
            elif continuous_mode and (now - last_continuous_capture > 0.15):
                should_save = True

            if should_save and detected and features is not None:
                last_continuous_capture = now
                with open(args.output, mode="a", newline="") as f:
                    writer = csv.writer(f)
                    row = [selected_class, handedness_str, now, args.session] + list(features)
                    writer.writerow(row)
                existing_counts[selected_class] = existing_counts.get(selected_class, 0) + 1
                print(f"[Captured] {selected_class} (Total: {existing_counts[selected_class]})")

    cap.release()
    cv2.destroyAllWindows()
    print("\nDataset collection session finished.")
    print("Final sample counts:")
    for k, v in existing_counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
