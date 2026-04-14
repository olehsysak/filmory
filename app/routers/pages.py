from fastapi import APIRouter, Request, Depends, status, HTTPException
from app.templates import templates
from app.services.film_service import FilmService
from app.dependencies import get_film_service, get_async_db
from app.repositories.genre_repo import GenreRepository
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(tags=["pages"])


@router.get("/")
async def index(request: Request, service: FilmService = Depends(get_film_service)):
    popular = await service.get_popular()
    coming_soon = await service.get_top_upcoming()
    return templates.TemplateResponse("index.html", {
        "request": request,
        "popular": popular,
        "coming_soon": coming_soon,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/films")
async def films_page(request: Request, db: AsyncSession = Depends(get_async_db)):
    genre_repo = GenreRepository(db)
    genres = await genre_repo.get_all()
    return templates.TemplateResponse("films.html", {
        "request": request,
        "genres": genres,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/film/{tmdb_id}")
async def film_detail(request: Request, tmdb_id: int, service: FilmService = Depends(get_film_service)):
    film = await service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")
    similar = await service.get_similar(tmdb_id)
    return templates.TemplateResponse("film.html", {
        "request": request,
        "film": film,
        "similar": similar,
    })


@router.get("/login")
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/register")
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})