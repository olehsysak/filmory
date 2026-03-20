from fastapi import FastAPI
import uvicorn
from app.routers.auth import router as auth_router
from app.middleware.auth_middleware import AuthMiddleware

from app.clients.tmdb_client import tmdb_client

# Connecting lifespan to FastAPI
app = FastAPI(
    title="Filmory API",
    description="Filmory API ",
    version="1.0",
)


# middleware
app.add_middleware(AuthMiddleware)


# connecting routers
app.include_router(auth_router)


# root endpoint
@app.get("/")
async def root():
    return {"status": "ok"}


if __name__ == '__main__':
    uvicorn.run('app.main:app', reload=True)