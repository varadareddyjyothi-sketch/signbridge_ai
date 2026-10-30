"""
SignBridge AI - Authentication and Profile Management Router
Supports secure registration, login, profile updates, and logout.
Uses MongoDB (with local SQLite fallback) for secure token and credential management.
"""

from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Header
from backend.app.database.history_service import history_service

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])


# =========================================================================
# Request & Response Schemas
# =========================================================================

class UserRegisterRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="Valid email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    display_name: str = Field(..., min_length=1, max_length=60, description="User's display name")
    preferred_language: str = Field(default="en", description="Preferred output language ('en', 'te', 'ro')")


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
    token: str
    user: UserProfileResponse
    message: str = "Success"


class PasswordRecoveryRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# =========================================================================
# Auth Dependency Helper
# =========================================================================

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Extracts bearer token and resolves the user if present, or returns None."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return None

    # Check MongoDB / SQLite session
    return history_service.get_user_by_token(token)


def get_current_user_required(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required or invalid session")
    return user


# =========================================================================
# Authentication Endpoints
# =========================================================================

@router.post("/register", response_model=AuthResponse)
async def register(request: UserRegisterRequest):
    """
    Registers a new user with salted hashed password and returns an auth session.
    """
    try:
        user = history_service.create_user(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
            preferred_language=request.preferred_language
        )
        auth_data = history_service.authenticate_user(request.email, request.password)
        if not auth_data:
            raise HTTPException(status_code=500, detail="Failed to initialize session after registration")

        return AuthResponse(
            token=auth_data["token"],
            user=UserProfileResponse(**auth_data["user"]),
            message="User registered successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/login", response_model=AuthResponse)
async def login(request: UserLoginRequest):
    """
    Authenticates email and password, returning user profile and session token.
    """
    auth_data = history_service.authenticate_user(request.email, request.password)
    if not auth_data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

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
async def logout(authorization: Optional[str] = Header(None)):
    """
    Terminates the active session token.
    """
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        history_service.delete_session(token)
    return {"success": True, "message": "Logged out successfully"}


@router.post("/recovery")
async def request_password_recovery(request: PasswordRecoveryRequest):
    """
    Processes a password recovery request for the provided email.
    """
    return {
        "success": True,
        "message": f"If an account exists for {request.email}, password reset instructions have been generated."
    }


# =========================================================================
# MongoDB Data Migration Trigger
# =========================================================================

@router.post("/migrate-to-mongo")
async def migrate_sqlite_data_to_mongo(current_user: dict = Depends(get_current_user_required)):
    """
    Administrative endpoint to copy all existing records from local SQLite into MongoDB Atlas.
    """
    result = history_service.migrate_all_to_mongodb()
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Migration failed"))
    return result
