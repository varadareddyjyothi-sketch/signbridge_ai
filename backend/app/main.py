"""
SignBridge AI - FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.api import health, predict, history, dataset, vocabulary, models, sentence, auth
from backend.app.database.local_storage import init_local_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    init_local_db()
    print(f"[{settings.APP_NAME}] Startup complete. Server listening on {settings.HOST}:{settings.PORT}")
    yield
    # Shutdown actions if needed


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-stack Indian Sign Language (ISL) Recognition API powered by MediaPipe and Scikit-Learn.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(health.router)
app.include_router(predict.router)
app.include_router(history.router)
app.include_router(dataset.router)
app.include_router(vocabulary.router)
app.include_router(models.router)
app.include_router(sentence.router)



@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentation": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
