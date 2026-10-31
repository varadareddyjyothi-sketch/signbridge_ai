"""
SignBridge AI - Authentication and Profile Management Router
Supports secure registration, login, profile updates, and logout.
Uses MongoDB (with local SQLite fallback) for secure token and credential management.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator
from fastapi import APIRouter, HTTPException, Depends, Header, Request, Response
from backend.app.config import settings
from backend.app.database.history_service import history_service

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])


# =========================================================================
# Request & Response Schemas
# =========================================================================

class UserRegisterRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="Valid email address")
    password: str = Field(..., min_length=8, max_length=72, description="Password (8 to 72 characters)")
    display_name: str = Field(..., min_length=1, max_length=60, description="User's display name")
    preferred_language: str = Field(default="en", pattern="^(en|te|ro)$", description="Preferred output language ('en', 'te', 'ro')")

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return password

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, display_name: str) -> str:
        normalized = display_name.strip()
        if not normalized:
            raise ValueError("Display name is required")
        return normalized


class UserLoginRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(..., min_length=1)


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=60)
    preferred_language: Optional[str] = Field(None, pattern="^(en|te|ro)$")


class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str
    preferred_language: str
    created_at: str


class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: UserProfileResponse
    message: str = "Success"


class PasswordRecoveryRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# =========================================================================
# Auth Dependency Helper
# =========================================================================

def _session_token(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization:
        scheme, separator, credentials = authorization.partition(" ")
        if separator and scheme.lower() == "bearer" and credentials.strip():
            return credentials.strip()
    return request.cookies.get(settings.SESSION_COOKIE_NAME)


def _set_session_cookie(response: Response, token: str) -> None:
    production = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=production,
        samesite="none" if production else "lax",
        path="/"
    )


def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Optional[dict]:
    """Resolves the HttpOnly cookie session or a legacy bearer session."""
    token = _session_token(request, authorization)
    if not token:
        return None

    return history_service.get_user_by_token(token)


def get_current_user_required(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> dict:
    user = get_current_user_optional(request, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required or invalid session")
    return user


# =========================================================================
# Authentication Endpoints
# =========================================================================

@router.post("/register", response_model=AuthResponse)
async def register(request: UserRegisterRequest, response: Response):
    """
    Registers a new user with salted hashed password and returns an auth session.
    """
    try:
        history_service.create_user(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
            preferred_language=request.preferred_language
        )
        auth_data = history_service.authenticate_user(request.email, request.password)
        if not auth_data:
            raise HTTPException(status_code=500, detail="Failed to initialize session after registration")

        _set_session_cookie(response, auth_data["token"])
        return AuthResponse(
            token=auth_data["token"],
            user=UserProfileResponse(**auth_data["user"]),
            message="User registered successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.post("/login", response_model=AuthResponse)
async def login(request: UserLoginRequest, response: Response):
    """
    Authenticates email and password, returning user profile and session token.
    """
    auth_data = history_service.authenticate_user(request.email, request.password)
    if not auth_data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _set_session_cookie(response, auth_data["token"])
    return AuthResponse(
        token=auth_data["token"],
        user=UserProfileResponse(**auth_data["user"]),
        message="Login successful"
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_profile(current_user: dict = Depends(get_current_user_required)):
    """
    Returns the currently authenticated user's profile.
    """
    return UserProfileResponse(**current_user)


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user_required)
):
    """
    Updates the authenticated user's profile display name or preferred language.
    """
    updated = history_service.update_user_profile(
        user_id=current_user["id"],
        display_name=request.display_name,
        preferred_language=request.preferred_language
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User profile not found")

    return UserProfileResponse(**updated)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None)
):
    """
    Terminates the active session token.
    """
    token = _session_token(request, authorization)
    if token:
        history_service.delete_session(token)
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.ENVIRONMENT.lower() == "production",
        samesite="none" if settings.ENVIRONMENT.lower() == "production" else "lax"
    )
    return {"success": True, "message": "Logged out successfully"}


@router.post("/recovery")
def request_password_recovery(request: PasswordRecoveryRequest):
    """
    Processes a password recovery request for the provided email.
    """
    raise HTTPException(status_code=501, detail="Password recovery is not configured")


# =========================================================================
# MongoDB Data Migration Trigger
# =========================================================================

@router.post("/migrate-to-mongo")
def migrate_sqlite_data_to_mongo(current_user: dict = Depends(get_current_user_required)):
    """
    Administrative endpoint to copy all existing records from local SQLite into MongoDB Atlas.
    """
    result = history_service.migrate_all_to_mongodb()
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Migration failed"))
    return result
