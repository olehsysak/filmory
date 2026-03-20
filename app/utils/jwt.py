from datetime import datetime, timezone, timedelta
import jwt
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_ACCESS_EXPIRE_MINUTES, JWT_REFRESH_EXPIRE_DAYS


def create_access_token(user_id: int) -> str:
    """Create short-lived access token."""
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """Create long-lived refresh token."""
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_EXPIRE_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str, token_type: str) -> int | None:
    """Verify token and return user_id or None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return int(payload.get("sub"))
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None