from dotenv import load_dotenv
import os


load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET is not set in .env")


JWT_ALGORITHM = "HS256"
JWT_ACCESS_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", 30))
JWT_REFRESH_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", 7))


DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")


TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = os.getenv("TMDB_BASE_URL")
TMDB_IMAGE_URL = os.getenv("TMDB_IMAGE_URL")