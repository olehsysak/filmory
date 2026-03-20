from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.utils.jwt import verify_token
from app.database import async_session_maker
from app.repositories.user_repo import UserRepository


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware for JWT authentication."""

    async def dispatch(self, request: Request, call_next):
        request.state.user = None

        token = request.cookies.get("access_token")

        # If no cookie token, check Authorization header (for Swagger)
        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        # Verify token and get user
        if token:
            user_id = verify_token(token, token_type="access")
            if user_id:
                try:
                    async with async_session_maker() as db:
                        user_repo = UserRepository(db)
                        user = await user_repo.get_by_id(user_id)
                        if user and user.is_active:
                            request.state.user = user
                except Exception:
                    pass

        response = await call_next(request)
        return response