# SignBridge AI — Indian Sign Language (ISL) Recognition & Two-Way Bridge

[![Python](https://img.shields.io/badge/Python-3.13%2B-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-007acc.svg)](https://developers.google.com/mediapipe)
[![Scikit--Learn](https://img.shields.io/badge/scikit--learn-Random%20Forest-orange.svg)](https://scikit-learn.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SignBridge AI is a responsive, privacy-preserving web application designed to bridge communication between Indian Sign Language (ISL) users and hearing non-signers.

The application combines **in-browser edge hand tracking (MediaPipe)** with a custom **scikit-learn Random Forest classifier** to perform real-time static sign recognition, automatic **Text-to-Speech (TTS)** voice synthesis, and **two-way speech transcription**.

---

## 🚀 Key Features Implemented

1. **Private Client-Side Hand Detection**:
   - WebAssembly MediaPipe Hand landmark extractor running directly inside the user's browser.
   - Extracts 21 3D joint landmarks $(x, y, z)$ at 30+ FPS.
   - Live skeletal overlay rendered on canvas with glowing joints and colored bones.
   - **Zero continuous raw video streaming to the cloud** — only compact normalized numerical coordinates are processed.

2. **Translation & Scale-Invariant Preprocessing**:
   - Mathematical wrist centering: shifts wrist (joint 0) to $(0,0,0)$.
   - Scale normalization: scales hand by maximum Euclidean radius.
   - Handedness mirroring: left and right hands map to canonical orientation.
   - 63-dimensional normalized feature representation implemented identically in both Python (`ml/features.py`) and TypeScript (`frontend/src/lib/landmarks.ts`).

3. **Trainable Machine Learning Pipeline**:
   - Baseline `RandomForestClassifier` (100 estimators, max depth 15).
   - Trained and evaluated on 600 kinematic landmark samples across 10 static ISL classes.
   - Anti-hallucination confidence rejection threshold (default: 65%) to filter out ambiguous or transitional hand shapes.
   - Exported model artifact: `ml/models/signbridge_rf_model.joblib` and comprehensive `ml/models/model_metadata.json`.

4. **10 Verified Static ISL Vocabulary Classes**:
   - `ISL_1`: Number 1 (Index Finger Up)
   - `ISL_2`: Number 2 (Index & Middle V)
   - `ISL_3`: Number 3 (Three Fingers Extended)
   - `ISL_4`: Number 4 (Four Fingers Extended)
   - `ISL_5`: Number 5 / Open Palm
   - `ISL_OK`: OK / Good (Thumb & Index Circle)
   - `ISL_YES_THUMBS_UP`: Yes / Affirmative (Thumbs Up)
   - `ISL_NO_INDEX`: No / Stop (Index Point)
   - `ISL_PEACE_VICTORY`: Peace / Victory (Wide V)
   - `ISL_FIST`: Closed Fist (ISL Letter S)

5. **In-App Dataset Collection Studio**:
   - Dedicated Web Studio tab allowing developers and users to record new gesture samples directly from their webcam.
   - One-click sample capture and 5-sample burst capture.
   - In-app "Retrain Random Forest" button with instant model reload without restarting the server.

6. **Two-Way Communication Bridge**:
   - **Signer ➔ Hearing Person**: Automatic speech synthesis (TTS) speaks out recognized signs.
   - **Hearing Person ➔ Signer**: Speech-to-Text (STT) transcribes spoken words into large, high-contrast readable text for the ISL user.

7. **Dual-Mode Cloud & Local Persistence**:
   - **MongoDB Atlas Cloud**: Document database with indexed collections (`users`, `profiles`, `auth_sessions`, `recognition_history`, `sentence_history`).
   - **Local SQLite Fallback**: Automatic embedded SQLite database (`signbridge_local.db`) when cloud credentials are not supplied.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Vanilla Glassmorphic CSS, Lucide Icons |
| **Computer Vision** | MediaPipe Hands (WASM / Browser API) |
| **Speech APIs** | Web SpeechSynthesis API (TTS), Web SpeechRecognition API (STT) |
| **Backend** | Python 3.13+, FastAPI, Pydantic v2, Uvicorn |
| **Machine Learning** | Scikit-learn (RandomForestClassifier), NumPy, Pandas, Joblib |
| **Database** | MongoDB Atlas (Cloud) + Embedded SQLite fallback |

---

## 📁 Project Directory Structure

```
signbridge-ai/
├── backend/
│   ├── app/
│   │   ├── api/             # API route handlers (health, predict, history, dataset, auth)
│   │   ├── database/        # MongoDB client, SQLite fallback, history service
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   ├── services/        # Inference service & model management
│   │   ├── config.py        # Settings & environment configuration
│   │   └── main.py          # FastAPI application entry point
│   └── tests/               # Backend API integration tests (pytest + httpx)
├── frontend/
│   ├── src/
│   │   ├── components/      # Navbar, LandingHero, CameraPanel, TwoWaySpeech, DatasetStudio, HistoryLog, ISLGuide
│   │   ├── hooks/           # useWebcamHands (MediaPipe + skeleton canvas)
│   │   ├── lib/             # TypeScript landmark normalization (matches Python)
│   │   ├── services/        # API client, Speech services
│   │   ├── types/           # TypeScript data interfaces
│   │   ├── App.tsx          # Main React layout & tab router
│   │   └── index.css        # Glassmorphic dark design system
│   ├── index.html           # SEO meta tags, Google Fonts, CDN fallbacks
│   └── package.json
├── ml/
│   ├── dataset/             # isl_landmarks_dataset.csv (600 samples across 10 classes)
│   ├── models/              # signbridge_rf_model.joblib, model_metadata.json
│   ├── scripts/             # collect_data.py, train_model.py, evaluate_model.py, generate_initial_dataset.py
│   ├── features.py          # 63-d landmark normalization module
│   └── tests/               # Unit tests for translation/scale invariance
├── docs/                    # System architecture & database setup guides
├── .env.example             # Template for configuration
├── pytest.ini               # Pytest configuration
├── requirements.txt         # Python dependencies
└── README.md
```

---

## ⚡ Quickstart Guide (Windows PowerShell)

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v25)
- **Python** 3.10+ (tested on Python 3.13 & 3.14)
- **Webcam** and browser with WebRTC support (Google Chrome, Microsoft Edge, or Firefox)

---

### 2. Backend Setup & Startup

Open a PowerShell terminal in the project root:

```powershell
# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment configuration
Copy-Item .env.example .env

# 4. Start FastAPI server
.\venv\Scripts\uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The FastAPI backend will start at:
- **API Root**: `http://localhost:8000/`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **Health Endpoint**: `http://localhost:8000/health`

---

### 3. Frontend Setup & Startup

Open a second PowerShell terminal in `frontend/`:

```powershell
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Open your browser at `http://localhost:5173/`.

---

## 🧪 Running Tests

### Backend & ML Tests
Run the comprehensive pytest suite covering feature extraction, translation invariance, scale invariance, handedness mirroring, health checks, prediction responses, and history persistence:

```powershell
.\venv\Scripts\pytest
```
*Result: 12 tests passing (100% success rate).*

### Frontend Production Build Test
Verify TypeScript compilation and bundling:

```powershell
cd frontend
npm run build
```

---

## 📊 Dataset Collection & Model Training

### Interactive Web Studio (Recommended)
1. Navigate to the **Dataset Studio** tab in the web interface (`http://localhost:5173/`).
2. Select any gesture class from the list.
3. Start the camera and click **Capture Sample** or **Burst (5 Samples)**.
4. Click **Retrain Random Forest** to train on the new samples directly from the browser!

### Python CLI Tools
You can also collect samples or retrain using the dedicated scripts:

```powershell
# Interactive OpenCV + MediaPipe collection from webcam
.\venv\Scripts\python ml/scripts/collect_data.py --output ml/dataset/isl_landmarks_dataset.csv

# Train the Random Forest classifier
.\venv\Scripts\python ml/scripts/train_model.py

# Evaluate model performance on held-out test data
.\venv\Scripts\python ml/scripts/evaluate_model.py
```

### Actual Evaluation Results
```
Loaded model: RandomForestClassifier (100 estimators)
Total test samples: 600
Accepted (confidence >= 0.65): 549 (91.5%)
Rejected (confidence < 0.65): 51 (8.5%)
Raw Model Accuracy: 95.67%
Accepted Predictions Accuracy: 99.27%
```

---

## ☁️ MongoDB Atlas Cloud Database Configuration

SignBridge AI works out of the box with embedded SQLite. To connect MongoDB Atlas:

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Obtain your MongoDB connection string (Project: `69ba6bd5b08f2ff79b9aa170`).
3. Set your credentials in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/signbridge_ai?retryWrites=true&w=majority
   MONGODB_DB_NAME=signbridge_ai
   JWT_SECRET=your-secret-key-here
   ```
4. Restart the backend. The navbar and `/health` will reflect `Storage: MongoDB Atlas`.
5. Run `POST /auth/migrate-to-mongo` to copy any existing local SQLite records into MongoDB Atlas without duplicates.

---

## 🚀 Production Deployment on DeployXa

SignBridge AI is fully configured for production deployment on **[DeployXa](https://deployxa.com)**, supporting both **Single-Container Full-Stack Deployment** (recommended) and **Multi-Service Deployment**.

### Architecture Overview

```
                      DeployXa HTTPS Edge Router
                                   │
                                   ▼
                   FastAPI Production Service (Port $PORT)
                   ├── GET / ───────────────► React 19 SPA (frontend/dist)
                   ├── GET /assets/* ───────► Bundled JS / CSS
                   ├── GET /models, /wasm ──► MediaPipe Vision Edge Tasks
                   ├── GET /health ─────────► Health & Model Status
                   └── POST /predict/* ─────► Random Forest + Dual-Hand Classifier
```

### Option A: One-Click Container Deployment (Recommended)

DeployXa automatically detects the root `Dockerfile` and builds a secure multi-stage container that compiles the Vite/React frontend and runs the FastAPI inference server.

1. **Connect Repository**:
   - In DeployXa dashboard, select **New Project** and connect `https://github.com/varadareddyjyothi-sketch/signbridge_ai.git`.
2. **Environment Variables**:
   Configure the following in the DeployXa Dashboard:
   | Variable | Value | Description |
   |---|---|---|
   | `ENVIRONMENT` | `production` | Enables production security & logging |
   | `ALLOWED_ORIGINS` | `*` (or your DeployXa domain) | Configures CORS for browser clients |
   | `CONFIDENCE_THRESHOLD` | `0.65` | Anti-hallucination rejection threshold |
   | `MONGODB_URI` | *(optional)* | MongoDB Atlas connection string (falls back to SQLite) |
   | `MONGODB_DB_NAME` | `signbridge_ai` | MongoDB database name |
   | `JWT_SECRET` | `your-secret-key` | Secret key for JWT session hashing |
3. **Deploy**:
   - Click **Deploy**. DeployXa will automatically run the multi-stage Docker build, execute health checks on `/health`, and assign a secure HTTPS URL.

### Option B: Separate Frontend & Backend Services

If deploying frontend and backend as separate services on DeployXa:

#### 1. Backend Service:
- **Root Directory**: `.`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `HOST`: `0.0.0.0`
  - `ENVIRONMENT`: `production`
  - `ALLOWED_ORIGINS`: `https://your-frontend.deployxa.app`

#### 2. Frontend Service:
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://your-backend.deployxa.app`

---

## 🔒 Post-Deployment Verification & Smoke Tests

After deploying on DeployXa, verify the live deployment:

1. **Health Endpoint**:
   ```bash
   curl -s https://your-app.deployxa.app/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "app_name": "SignBridge AI",
     "version": "1.0.0",
     "environment": "production",
     "model_status": "evaluated",
     "model_classes_count": 15,
     "storage_mode": "local_sqlite",
     "mongodb_configured": false,
     "mongodb_connected": false,
     "timestamp": "..."
   }
   ```
2. **Swagger Documentation**:
   Visit `https://your-app.deployxa.app/docs` to inspect and test all 8 REST APIs interactively.
3. **Webcam & Camera Permissions**:
   Because DeployXa serves the site over HTTPS, the browser's WebRTC camera access API (`navigator.mediaDevices.getUserMedia`) is fully supported without security restrictions.

---

## ⚠️ Known Limitations & Scope Transparency

- **Static Handshape Classification**: Recognizes static single-hand and dual-hand shapes (15 verified classes). Does not translate continuous trajectory movements or multi-handed compound sentences.
- **Lighting & Camera Quality**: MediaPipe landmarks require reasonable hand visibility and contrast against the background.
- **ISL Regional Variations**: Handshapes are aligned with ISLRTC standard numbers and affirmations; regional ISL dialects may use alternative forms.

---

## 🗺️ Future Roadmap

- [ ] Sequence modeling using LSTM / Transformer on landmark trajectory windows for dynamic words.
- [ ] Two-handed gesture classification for compound ISL phrases.
- [ ] User profile customization for personal gesture shortcuts.
- [ ] Offline PWA deployment with WebAssembly model execution.


