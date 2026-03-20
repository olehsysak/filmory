from fastapi import APIRouter, Depends, Response, Request, status, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_async_db
from app.schemas.user import UserRegister, UserLogin, UserResponse
from app.services.auth_service import AuthService


router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.post("/register", response_model=UserResponse)
async def register_user(data: UserRegister, db: AsyncSession = Depends(get_async_db)):
    """Register a new user."""
    auth_service = AuthService(db)
    return await auth_service.register(data)


@router.post("/login")
async def login_user(data: UserLogin, response: Response, db: AsyncSession = Depends(get_async_db)):
    """Login user and set tokens in cookies."""
    auth_service = AuthService(db)
    result = await auth_service.login(data)

    # Set tokens in cookies
    response.set_cookie(
        key="access_token",
        value=result["access_token"],
        httponly=True,
        max_age=60 * 30  # 30 minutes
    )
    response.set_cookie(
        key="refresh_token",
        value=result["refresh_token"],
        httponly=True,
        max_age=60 * 60 * 24 * 7  # 7 days
    )

    user_data = UserResponse.model_validate(result["user"])
    return {"message": "Login successful", "user": user_data}


@router.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_async_db)):
    """Refresh access token using refresh token from cookie."""
    auth_service = AuthService(db)
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
        )

    return await auth_service.refresh(refresh_token)


@router.post("/logout")
async def logout(response: Response):
    """Logout user by clearing cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@router.post("/token")
async def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_async_db)
):
    """OAuth2 token endpoint for Swagger UI authorization."""
    auth_service = AuthService(db)
    result = await auth_service.login(UserLogin(
        email=form_data.username,
        password=form_data.password
    ))
    return {
        "access_token": result["access_token"],
        "token_type": "bearer"
    }