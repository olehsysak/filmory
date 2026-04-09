from fastapi import APIRouter, Depends, Response, Request, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from app.dependencies import get_auth_service, get_current_user
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse
from app.services.auth_service import AuthService


router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return current_user


@router.post("/register", response_model=UserResponse)
async def register_user(data: UserRegister, auth_service: AuthService = Depends(get_auth_service)):
    """Register a new user."""
    return await auth_service.register(data)


@router.post("/login")
async def login_user(data: UserLogin, response: Response, auth_service: AuthService = Depends(get_auth_service)):
    """Login user and set tokens in cookies."""
    result = await auth_service.login(data)

    # Set tokens in cookies
    response.set_cookie(
        key="access_token",
        value=result["access_token"],
        httponly=True,
        path="/",
        max_age=60 * 30  # 30 minutes
    )
    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        path="/",
        max_age=60 * 60 * 24 * 7  # 7 days
    )

    user_data = UserResponse.model_validate(result["user"])
    return {"message": "Login successful", "user": user_data}


@router.post("/refresh")
async def refresh(request: Request, auth_service: AuthService = Depends(get_auth_service)):
    """Refresh access token using refresh token from cookie."""
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
        )

    return await auth_service.refresh(refresh_token)


@router.post("/logout")
async def logout(response: Response):
    response.set_cookie(
        key="access_token",
        value="",
        httponly=True,
        path="/",
        max_age=0,
        expires=0
    )
    response.set_cookie(
        key="refresh_token",
        value="",
        httponly=True,
        path="/",
        max_age=0,
        expires=0
    )
    return {"message": "Logged out successfully"}


@router.post("/token")
async def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(get_auth_service)
):
    """OAuth2 token endpoint for Swagger UI authorization."""
    result = await auth_service.login(UserLogin(
        email=form_data.username,
        password=form_data.password
    ))
    return {
        "access_token": result["access_token"],
        "token_type": "bearer"
    }