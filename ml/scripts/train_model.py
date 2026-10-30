"""
SignBridge AI - Model Training Pipeline
Trains a scikit-learn Random Forest Classifier on normalized 63-dimensional landmark features.
Evaluates on a held-out test split, exports metrics, confusion matrix, and joblib model.
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from ml.features import FEATURE_DIMENSION, ENHANCED_FEATURE_DIMENSION, extract_model_features

DEFAULT_DATASET = os.path.join("ml", "dataset", "isl_landmarks_dataset.csv")
DEFAULT_MODEL_DIR = os.path.join("ml", "models")
DEFAULT_MODEL_PATH = os.path.join(DEFAULT_MODEL_DIR, "signbridge_rf_model.joblib")
DEFAULT_METADATA_PATH = os.path.join(DEFAULT_MODEL_DIR, "model_metadata.json")

MIN_RECOMMENDED_SAMPLES_PER_CLASS = 10


def train(
    dataset_path: str = DEFAULT_DATASET,
    output_model_path: str = DEFAULT_MODEL_PATH,
    output_metadata_path: str = DEFAULT_METADATA_PATH,
    test_size: float = 0.2,
    random_state: int = 42
):
    print("=" * 60)
    print("SignBridge AI — Advanced Model Training Pipeline")
    print(f"Dataset path: {dataset_path}")
    print(f"Output model: {output_model_path}")
    print(f"Output metadata: {output_metadata_path}")
    print("=" * 60)

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(
            f"Dataset not found at '{dataset_path}'. Please collect data first using ml/scripts/collect_data.py "
            f"or the web Dataset Collector studio."
        )

    df = pd.read_csv(dataset_path)
    if df.empty or len(df) < 5:
        raise ValueError(f"Dataset at '{dataset_path}' has insufficient rows ({len(df)} rows).")

    if "label" not in df.columns:
        raise ValueError("Dataset missing required 'label' column.")

    feature_cols = [c for c in df.columns if c.startswith("f_")]
    if len(feature_cols) != FEATURE_DIMENSION:
        # Check if all columns except label, handedness, timestamp, session_id are features
        feature_cols = [c for c in df.columns if c not in ["label", "handedness", "timestamp", "session_id"]]
        if len(feature_cols) != FEATURE_DIMENSION:
            raise ValueError(
                f"Expected {FEATURE_DIMENSION} feature columns, found {len(feature_cols)} in {dataset_path}"
            )

    # Class distribution analysis
    class_counts = df["label"].value_counts().to_dict()
    print("\nClass Sample Counts:")
    for lbl, cnt in class_counts.items():
        warn = " (WARNING: Low sample count!)" if cnt < MIN_RECOMMENDED_SAMPLES_PER_CLASS else ""
        print(f"  - {lbl}: {cnt} samples{warn}")

    unique_classes = sorted(list(class_counts.keys()))
    if len(unique_classes) < 2:
        raise ValueError(
            f"Classification requires at least 2 distinct classes. Found only: {unique_classes}"
        )

    raw_X = df[feature_cols].to_numpy(dtype=np.float32)
    y = df["label"].to_numpy()

    # Verify no NaN / inf values
    if not np.all(np.isfinite(raw_X)):
        raise ValueError("Dataset features contain NaN or Inf values! Cleaning invalid rows required.")

    # Compute enhanced kinematic geometric features (109-dimensional)
    print(f"\nComputing enhanced kinematic geometric features ({ENHANCED_FEATURE_DIMENSION} dimensions)...")
    X = np.array([extract_model_features(row) for row in raw_X], dtype=np.float32)

    # Stratified train/test split
    min_count = min(class_counts.values())
    stratify = y if min_count >= 2 else None
    if stratify is None:
        print("[Warning] Some classes have fewer than 2 samples; stratify disabled for train/test split.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify
    )

    print(f"Dataset Split: Train={len(X_train)} samples, Test={len(X_test)} samples")

    # Fit Enhanced Random Forest Classifier
    print("\nTraining Enhanced RandomForestClassifier (150 estimators, max_depth=18, balanced weights)...")
    clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=18,
        min_samples_split=2,
        min_samples_leaf=1,
        class_weight="balanced",
        random_state=random_state,
        n_jobs=-1
    )
    start_time = time.time()
    clf.fit(X_train, y_train)
    train_duration = time.time() - start_time
    print(f"Training completed in {train_duration:.2f} seconds.")

    # Evaluate on held-out test split
    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)

    test_acc = float(accuracy_score(y_test, y_pred))
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    report_text = classification_report(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=clf.classes_).tolist()

    print("\n" + "=" * 60)
    print("HELD-OUT TEST EVALUATION RESULTS:")
    print(f"Accuracy: {test_acc * 100:.2f}%\n")
    print(report_text)
    print("Confusion Matrix (Classes order: " + ", ".join(clf.classes_) + "):")
    print(np.array(cm))
    print("=" * 60)

    # Save model artifact
    os.makedirs(os.path.dirname(output_model_path), exist_ok=True)
    joblib.dump(clf, output_model_path)
    print(f"\n[Artifact Saved] Model written to: {output_model_path}")

    # Build metadata
    classes_list = [str(c) for c in clf.classes_]
    metadata = {
        "model_name": "EnhancedKinematicRandomForest",
        "model_file": os.path.basename(output_model_path),
        "status": "evaluated",
        "training_timestamp": datetime.utcnow().isoformat() + "Z",
        "training_duration_seconds": round(train_duration, 4),
        "feature_dimension": ENHANCED_FEATURE_DIMENSION,
        "raw_feature_dimension": FEATURE_DIMENSION,
        "classes": classes_list,
        "class_to_id": {cls_name: i for i, cls_name in enumerate(classes_list)},
        "total_samples": int(len(df)),
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "samples_per_class": class_counts,
        "test_accuracy": test_acc,
        "classification_report": report,
        "confusion_matrix": cm,
        "confidence_rejection_threshold": 0.40,
        "retrain_command": "python ml/scripts/train_model.py",
        "known_limitations": [
            "Trained strictly on validated ISL kinematic hand landmark feature vectors.",
            "Dynamic motion gestures (trajectory-dependent continuous signs) require steady hold at peak configuration.",
            "Requires clear lighting and visibility of hand landmarks."
        ]
    }

    os.makedirs(os.path.dirname(output_metadata_path), exist_ok=True)
    with open(output_metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"[Artifact Saved] Metadata written to: {output_metadata_path}")

    return metadata


def main():
    parser = argparse.ArgumentParser(description="Train SignBridge AI Random Forest Classifier")
    parser.add_argument("--dataset", type=str, default=DEFAULT_DATASET, help="Path to input dataset CSV")
    parser.add_argument("--output-model", type=str, default=DEFAULT_MODEL_PATH, help="Path to save joblib model")
    parser.add_argument("--output-metadata", type=str, default=DEFAULT_METADATA_PATH, help="Path to save metadata JSON")
    parser.add_argument("--test-size", type=float, default=0.2, help="Held-out test split ratio")
    args = parser.parse_args()

    train(
        dataset_path=args.dataset,
        output_model_path=args.output_model,
        output_metadata_path=args.output_metadata,
        test_size=args.test_size
    )


if __name__ == "__main__":
    main()
