# SignBridge AI — System Architecture & Technical Specifications

## 1. High-Level Architecture Overview

SignBridge AI is designed with an edge-first computer vision philosophy. Rather than streaming high-bandwidth, privacy-sensitive webcam video feeds across the internet, all hand tracking and 21-point joint landmark extraction happens entirely inside the user's browser via WebAssembly (WASM). Only compact, normalized 63-dimensional coordinate arrays are transmitted to the backend inference engine or dataset collection pipelines.

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                     │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │   Webcam Video Feed   │──>│  MediaPipe Hands     │  │
│  └───────────────────────┘   │  (21 3D Landmarks)   │  │
│                              └──────────┬───────────┘  │
│                                         │              │
│                              ┌──────────▼───────────┐  │
│                              │ Landmark Normalizer  │  │
│                              │ (Translation, Scale, │  │
│                              │  Handedness Mirror)  │  │
│                              └──────────┬───────────┘  │
│                                         │              │
│                              ┌──────────▼───────────┐  │
│                              │  63-D Feature Array  │  │
└─────────────────────────────────────────┼──────────────┘
                                          │ HTTP POST /predict (JSON)
                                          ▼
┌────────────────────────────────────────────────────────┐
│                  BACKEND (FastAPI)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Inference Service                               │  │
│  │  - Load signbridge_rf_model.joblib               │  │
│  │  - Random Forest Classifier (100 Trees)          │  │
│  │  - Probability Estimation & Class Mapping        │  │
│  │  - Anti-Hallucination Rejection (Threshold 0.65) │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Unified History & Storage Service               │  │
│  │  - Primary: MongoDB Atlas Cloud (Users, History) │  │
│  │  - Local Fallback: Embedded SQLite               │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Landmark Feature Normalization Specification

MediaPipe returns 21 hand landmarks, each with $(x_i, y_i, z_i)$ coordinates. Raw coordinates vary wildly based on where the user holds their hand and how close they are to the camera lens.

To achieve translation and scale invariance:

1. **Translation Invariance**:
   The wrist landmark (index 0) is established as the origin:
   $$x'_i = x_i - x_0, \quad y'_i = y_i - y_0, \quad z'_i = z_i - z_0$$
   After translation, $(x'_0, y'_0, z'_0) = (0, 0, 0)$.

2. **Handedness Canonicalization**:
   If the hand is classified as `Left`, the horizontal axis is mirrored:
   $$x''_i = -x'_i$$
   This enables a single classifier to recognize right and left hands seamlessly without double training samples.

3. **Scale Invariance**:
   The maximum Euclidean distance $s$ from the origin to any landmark is computed:
   $$s = \max_{i \in [0, 20]} \sqrt{{x''_i}^2 + {y''_i}^2 + {z''_i}^2}$$
   Every coordinate is scaled:
   $$x'''_i = x''_i / s, \quad y'''_i = y''_i / s, \quad z'''_i = z''_i / s$$

4. **Output Feature Vector**:
   The normalized coordinates are flattened into a 1D vector of length $21 \times 3 = 63$:
   $$\mathbf{f} = [x'''_0, y'''_0, z'''_0, \dots, x'''_{20}, y'''_{20}, z'''_{20}]$$

Identical mathematical logic is implemented in both `ml/features.py` (Python) and `frontend/src/lib/landmarks.ts` (TypeScript).

---

## 3. Machine Learning Baseline & Quality Evaluation

- **Algorithm**: `RandomForestClassifier` (scikit-learn).
- **Hyperparameters**: 100 decision trees, max depth 15, balanced class weighting.
- **Decision Engine**:
  - `predict_proba()` calculates confidence across all supported classes.
  - If $\max(P) < \text{threshold}$ (default $0.65$), the model flags the gesture as `uncertain_rejected`.
  - This prevents fabricated predictions when arbitrary hand movements occur.
- **Current Model Status**: `evaluated` with held-out test accuracy of **78.33%** across 10 classes (and **99.27%** precision on accepted predictions above threshold).

---

## 4. Database & Cloud Architecture

- **MongoDB Atlas Cloud**:
  - Collections: `users`, `profiles`, `auth_sessions`, `recognition_history`, `sentence_history`.
  - Indexes: Unique indexes on `users.email`, `users.id`, `auth_sessions.token`, and compound/timestamp sorting indexes on `recognition_history` and `sentence_history`.
  - User Isolation: Queries filter strictly by authenticated `user_id`.
  - Guest/Demo Mode: Unauthenticated records with `user_id = NULL` are permitted and isolated.
- **Zero-Config Local Fallback**:
  - Embedded SQLite database `backend/app/database/signbridge_local.db`.
  - Automatically activates when `MONGODB_URI` is empty or connection fails.
  - Seamless migration utility (`POST /auth/migrate-to-mongo`) to copy all records into MongoDB Atlas without duplicates.
