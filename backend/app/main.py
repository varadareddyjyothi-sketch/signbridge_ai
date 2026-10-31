import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.app.config import settings
from backend.app.api import health, predict, history, dataset, vocabulary, models, sentence, auth, gesture
from backend.app.database.local_storage import init_local_db
from backend.app.database.history_service import DatabaseUnavailableError
from backend.app.database.mongo_client import close_mongo_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    init_local_db()
    print(f"[{settings.APP_NAME}] Startup complete. Server listening on {settings.HOST}:{settings.PORT}")
    try:
        yield
    finally:
        close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-stack Indian Sign Language (ISL) Recognition API powered by MediaPipe and Scikit-Learn.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration - Supports Localhost, LAN IPs (Mobile WiFi), and Cloud Domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.onrender\.com|.*\.vercel\.app|.*\.netlify\.app|.*\.deployxa\.online|.*\.deployxa\.com)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(DatabaseUnavailableError)
async def database_unavailable_handler(request: Request, exc: DatabaseUnavailableError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})

# Include Routers
app.include_router(auth.router)
app.include_router(health.router)
app.include_router(predict.router)
app.include_router(history.router)
app.include_router(dataset.router)
app.include_router(vocabulary.router)
app.include_router(models.router)
app.include_router(sentence.router)
app.include_router(gesture.router)

# Aliases for /api routes so mobile, proxy, and direct /api calls never 404
app.include_router(auth.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(predict.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(dataset.router, prefix="/api")
app.include_router(vocabulary.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(sentence.router, prefix="/api")
app.include_router(gesture.router, prefix="/api")


# API Route Prefixes that must NEVER return HTML or SPA fallbacks
API_ROUTE_PREFIXES = (
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/auth",
    "/predict",
    "/history",
    "/model",
    "/models",
    "/dataset",
    "/vocabulary",
    "/translate",
    "/gesture",
    "/api"
)


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Ensures unknown API endpoints return structured JSON 404s, never HTML.
    For non-API browser navigation, falls back to SPA index.html when built.
    """
    if exc.status_code == 404:
        path = request.url.path
        if any(path == prefix or path.startswith(f"{prefix}/") for prefix in API_ROUTE_PREFIXES) or "application/json" in request.headers.get("accept", ""):
            return JSONResponse(
                status_code=404,
                content={"detail": f"API endpoint '{path}' not found", "status_code": 404}
            )

        index_file = os.path.join(settings.STATIC_DIR, "index.html")
        accept = request.headers.get("accept", "")
        if request.method == "GET" and os.path.isfile(index_file) and "text/html" in accept:
            return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/api", tags=["Root"])
async def api_root():
    """Returns core API metadata and health link."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentation": "/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/auth",
            "predict": "/predict",
            "history": "/history",
            "models": "/models",
            "dataset": "/dataset",
            "vocabulary": "/vocabulary",
            "translate": "/translate"
        }
    }


@app.get("/", tags=["Root"])
async def root(request: Request):
    """
    Root endpoint: Serves the single-page application index.html when available,
    or returns API metadata JSON when requested by API clients / tests.
    """
    index_path = os.path.join(settings.STATIC_DIR, "index.html")
    if not os.path.isfile(index_path):
        for candidate in [os.path.join(str(settings.BASE_DIR), "dist", "index.html"), "/app/dist/index.html"]:
            if os.path.isfile(candidate):
                index_path = candidate
                break

    accept = request.headers.get("accept", "")
    sec_dest = request.headers.get("sec-fetch-dest", "")
    is_browser_nav = "text/html" in accept or sec_dest == "document"
    
    # If frontend build exists and request is browser navigation
    if os.path.isfile(index_path) and is_browser_nav and "application/json" not in accept:
        return FileResponse(index_path, headers={"Cache-Control": "no-cache"})

    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentation": "/docs",
        "health": "/health",
        "environment": settings.ENVIRONMENT,
        "frontend_built": os.path.isfile(index_path)
    }


# Static Assets Mounting
static_dist = settings.STATIC_DIR
assets_dir = os.path.join(static_dist, "assets")
if os.path.exists(assets_dir) and os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

for static_sub in ["models", "wasm"]:
    sub_path = os.path.join(static_dist, static_sub)
    if os.path.exists(sub_path) and os.path.isdir(sub_path):
        app.mount(f"/{static_sub}", StaticFiles(directory=sub_path), name=static_sub)


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa_and_static(request: Request, full_path: str):
    """
    Handles SPA client-side routes and static files.
    Ensures API endpoints NEVER return HTML pages, providing clean JSON 404s.
    """
    normalized_path = f"/{full_path}"

    # 1. API Route Protection: Unknown API routes MUST return structured JSON 404, NEVER HTML
    if any(normalized_path == prefix or normalized_path.startswith(f"{prefix}/") for prefix in API_ROUTE_PREFIXES):
        accept = request.headers.get("accept", "")
        index_file = os.path.join(settings.STATIC_DIR, "index.html")
        if normalized_path == "/history" and request.method == "GET" and "text/html" in accept and "application/json" not in accept and os.path.isfile(index_file):
            return FileResponse(index_file, headers={"Cache-Control": "no-cache"})
        return JSONResponse(
            status_code=404,
            content={"detail": f"API endpoint '{normalized_path}' not found", "status_code": 404}
        )

    # 2. Check for physical static asset in dist directory (e.g. logo.png, favicon.ico, etc.)
    target_file = os.path.join(settings.STATIC_DIR, full_path)
    if os.path.isfile(target_file):
        return FileResponse(target_file)

    # 3. Check for index.html for SPA client-side routing fallback (e.g. /recognition, /history, /guide)
    index_file = os.path.join(settings.STATIC_DIR, "index.html")
    if os.path.isfile(index_file):
        # Only serve index.html for browser document navigations, not missing assets.
        accept = request.headers.get("accept", "")
        if "text/html" in accept:
            return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

    # 4. If neither physical asset nor SPA build exists, return structured JSON 404
    return JSONResponse(
        status_code=404,
        content={
            "detail": f"Path '{normalized_path}' not found.",
            "status_code": 404,
            "frontend_built": os.path.isfile(index_file)
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
