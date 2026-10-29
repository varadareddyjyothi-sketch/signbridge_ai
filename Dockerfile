# ==========================================
# SignBridge AI - Multi-Stage Production Dockerfile
# Stage 1: Build the Vite/React Single Page Application
# Stage 2: Python FastAPI & ML Inference Server
# ==========================================

# Stage 1: Frontend Build
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend & Static Asset Host
FROM python:3.11-slim AS runner

# Install essential runtime libraries for computer vision and headless execution
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python backend dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application and machine learning assets
COPY backend/ ./backend/
COPY ml/ ./ml/

# Copy built frontend distribution into static serving directory
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Production Environment Settings
ENV PORT=8000 \
    HOST=0.0.0.0 \
    ENVIRONMENT=production \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Start Uvicorn bound to DeployXa / Cloud PORT
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
