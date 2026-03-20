from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status, HTTPException
from app.repositories.user_repo import UserRepository
from app.schemas.user import UserRegister, UserLogin
from app.utils.password import hash_password, verify_password
from app.utils.jwt import create_access_token, create_refresh_token, verify_token


class AuthService:
    """Service for authentication business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)


    async def register(self, data: UserRegister):
        """Register a new user."""

        # Check if email already exists
        if await self.user_repo.get_by_email(data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )

        # Check if username already exists
        if await self.user_repo.get_by_username(data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        # Hash password and create user
        hashed = hash_password(data.password)
        user = await self.user_repo.create(
            username=data.username,
            email=data.email,
            hashed_password=hashed
        )
        return user


    async def login(self, data: UserLogin):
        """Login user and return tokens."""

        # Find user by email
        user = await self.user_repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Check if account is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled"
            )

        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user
        }


    async def refresh(self, refresh_token: str):
        """Refresh access token."""

        # Verify refresh token
        user_id = verify_token(refresh_token, token_type="refresh")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

        # Find user
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # User is inactive
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")

        access_token = create_access_token(user.id)
        return {"access_token": access_token}