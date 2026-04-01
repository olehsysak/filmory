from fastapi import FastAPI
from contextlib import asynccontextmanager
import uvicorn
from app.routers.auth import router as auth_router
from app.routers.film import router as film_router
from app.routers.genre import router as genre_router
from app.middleware.auth_middleware import AuthMiddleware
from app.database import async_session_maker
from app.utils.sync import sync_genres


# connecting lifespan to FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_maker() as db:
        await sync_genres(db)
    yield


# application
app = FastAPI(
    title="Filmory API",
    description="Filmory API",
    version="1.0",
    lifespan=lifespan,
)


# middleware
app.add_middleware(AuthMiddleware)


# connecting routers
app.include_router(auth_router)
app.include_router(film_router)
app.include_router(genre_router)


# root endpoint
@app.get("/")
async def root():
    return {"status": "ok"}


if __name__ == '__main__':
    uvicorn.run('app.main:app', reload=True)