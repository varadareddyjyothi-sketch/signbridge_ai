"""
SignBridge AI - Model Evaluation Script
Evaluates a trained model on a specified evaluation/test dataset,
analyzes precision, recall, confusion matrix, and rejection threshold behavior.
"""

import os
import sys
import json
import argparse
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml.features import FEATURE_DIMENSION

DEFAULT_DATASET = os.path.join("ml", "dataset", "isl_landmarks_dataset.csv")
DEFAULT_MODEL_PATH = os.path.join("ml", "models", "signbridge_rf_model.joblib")
DEFAULT_METADATA_PATH = os.path.join("ml", "models", "model_metadata.json")


def evaluate(
    model_path: str = DEFAULT_MODEL_PATH,
    dataset_path: str = DEFAULT_DATASET,
    metadata_path: str = DEFAULT_METADATA_PATH,
    rejection_threshold: float = 0.65
):
    print("=" * 60)
    print("SignBridge AI — Model Evaluation Tool")
    print(f"Model path: {model_path}")
    print(f"Dataset path: {dataset_path}")
    print(f"Confidence rejection threshold: {rejection_threshold}")
    print("=" * 60)

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Trained model not found at '{model_path}'.")

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Evaluation dataset not found at '{dataset_path}'.")

    clf = joblib.load(model_path)
    print(f"Loaded model: {type(clf).__name__} with classes: {list(clf.classes_)}")

    df = pd.read_csv(dataset_path)
    feature_cols = [c for c in df.columns if c.startswith("f_")]
    if len(feature_cols) != FEATURE_DIMENSION:
        feature_cols = [c for c in df.columns if c not in ["label", "handedness", "timestamp", "session_id"]]

    X = df[feature_cols].to_numpy(dtype=np.float32)
    y_true = df["label"].to_numpy()

    # Probability predictions
    probs = clf.predict_proba(X)
    max_probs = np.max(probs, axis=1)
    preds = clf.classes_[np.argmax(probs, axis=1)]

    # Analysis with rejection threshold
    accepted_mask = max_probs >= rejection_threshold
    rejected_count = int(np.sum(~accepted_mask))
    accepted_count = int(np.sum(accepted_mask))

    print(f"\nTotal test samples: {len(X)}")
    print(f"Accepted (confidence >= {rejection_threshold}): {accepted_count} ({accepted_count/len(X)*100:.1f}%)")
    print(f"Rejected (confidence < {rejection_threshold}): {rejected_count} ({rejected_count/len(X)*100:.1f}%)")

    overall_acc = accuracy_score(y_true, preds)
    print(f"\nRaw Model Accuracy (without threshold): {overall_acc * 100:.2f}%")

    if accepted_count > 0:
        accepted_acc = accuracy_score(y_true[accepted_mask], preds[accepted_mask])
        print(f"Accepted Predictions Accuracy: {accepted_acc * 100:.2f}%")

    print("\nClassification Report (Raw):")
    print(classification_report(y_true, preds, zero_division=0))

    print("Confusion Matrix:")
    cm = confusion_matrix(y_true, preds, labels=clf.classes_)
    print(cm)

    return {
        "total_samples": len(X),
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "overall_accuracy": float(overall_acc),
        "classes": list(clf.classes_)
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate SignBridge AI Model")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--dataset", type=str, default=DEFAULT_DATASET)
    parser.add_argument("--threshold", type=float, default=0.65)
    args = parser.parse_args()

    evaluate(model_path=args.model, dataset_path=args.dataset, rejection_threshold=args.threshold)


if __name__ == "__main__":
    main()
