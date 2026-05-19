from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import uvicorn
from app.cache.redis_client import get_redis, close_redis
from app.routers.auth import router as auth_router
from app.routers.film import router as film_router
from app.routers.genre import router as genre_router
from app.routers.film_credits import router as credits_router
from app.routers.person import router as person_router
from app.routers.pages import router as pages_router
from app.routers.search import router as search_router
from app.routers.user_film import router as user_film_router
from app.routers.user_favorite import router as user_favorite_router
from app.routers.user_list import router as user_list_router
from app.routers.profile import router as profile_router
from app.routers.profile import router as users_router
from app.routers.user_collection import router as user_collection_router
from app.middleware.auth_middleware import AuthMiddleware
from app.database import async_session_maker
from app.utils.sync import sync_genres


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    await get_redis()
    async with async_session_maker() as db:
        await sync_genres(db)
    yield
    # shutdown
    await close_redis()


app = FastAPI(
    title="Filmory API",
    description="Filmory API",
    version="1.0",
    lifespan=lifespan,
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.add_middleware(AuthMiddleware)

# API routers
app.include_router(auth_router, prefix="/api")
app.include_router(film_router, prefix="/api")
app.include_router(genre_router, prefix="/api")
app.include_router(credits_router, prefix="/api")
app.include_router(person_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(user_film_router, prefix="/api")
app.include_router(user_favorite_router, prefix="/api")
app.include_router(user_list_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(user_collection_router, prefix="/api")

# Page routers
app.include_router(pages_router)


if __name__ == '__main__':
    uvicorn.run('app.main:app', reload=True)