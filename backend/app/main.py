import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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


@app.get("/api", tags=["Root"])
@app.get("/", tags=["Root"])
async def root(request: Request):
    """
    Root endpoint: Returns API metadata JSON when requested by API clients / tests,
    or serves the single-page application index.html when visited from a web browser.
    """
    accept = request.headers.get("accept", "")
    index_path = os.path.join(settings.STATIC_DIR, "index.html")
    if "text/html" in accept and os.path.exists(index_path):
        return FileResponse(index_path)

    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentation": "/docs",
        "health": "/health"
    }


# Mount production frontend assets and SPA routes if built
static_dist = settings.STATIC_DIR
if os.path.exists(static_dist) and os.path.isdir(static_dist):
    assets_dir = os.path.join(static_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    for static_sub in ["models", "wasm"]:
        sub_path = os.path.join(static_dist, static_sub)
        if os.path.exists(sub_path):
            app.mount(f"/{static_sub}", StaticFiles(directory=sub_path), name=static_sub)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(request: Request, full_path: str):
        # Exclude reserved API/system endpoints from SPA catch-all
        if full_path in ["health", "docs", "redoc", "openapi.json"] or full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})

        target_file = os.path.join(static_dist, full_path)
        if os.path.isfile(target_file):
            return FileResponse(target_file)

        index_file = os.path.join(static_dist, "index.html")
        accept = request.headers.get("accept", "")
        if "text/html" in accept and os.path.isfile(index_file):
            return FileResponse(index_file)

        if os.path.isfile(index_file):
            return FileResponse(index_file)

        return JSONResponse(status_code=404, content={"detail": f"Path '{full_path}' not found"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

