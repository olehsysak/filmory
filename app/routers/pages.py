from fastapi import APIRouter, Request, Depends, status, HTTPException, Query
from app.templates import templates
from fastapi.responses import RedirectResponse
from app.services.film_service import FilmService
from app.services.person_service import PersonService
from app.dependencies import get_film_service, get_async_db, get_person_service
from app.repositories.genre_repo import GenreRepository
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(tags=["pages"])


@router.get("/")
async def index(request: Request, service: FilmService = Depends(get_film_service)):
    """Home page with popular and upcoming films."""
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
    """Films catalog page with filtering and sorting options."""
    genre_repo = GenreRepository(db)
    genres = await genre_repo.get_all()
    return templates.TemplateResponse("films.html", {
        "request": request,
        "genres": genres,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/collection")
async def collection_page(
    request: Request,
    tab: str = Query(default="want_to_watch"),
):
    """User collection page with tab-based navigation."""
    if not request.state.user:
        return RedirectResponse(url="/login", status_code=302)

    valid_tabs = {"want_to_watch", "watching", "completed", "dropped", "favorites"}
    if tab not in valid_tabs:
        tab = "want_to_watch"

    return templates.TemplateResponse("collection.html", {
        "request": request,
        "active_tab": tab,
        "current_user": request.state.user,
    })


@router.get("/list/{list_id}")
async def list_detail_page(
        request: Request,
        list_id: int,
        db: AsyncSession = Depends(get_async_db),
):
    """User list detail page."""
    from app.services.user_list_service import UserListService
    from app.repositories.genre_repo import GenreRepository

    service = UserListService(db)
    user = request.state.user
    user_id = user.id if user else None

    try:
        list_data = await service.get_detail(list_id, user_id)
    except HTTPException as e:
        if e.status_code == 404:
            raise
        # Private list — redirect to login if not authenticated
        if not user:
            return RedirectResponse(url="/login", status_code=302)
        raise

    genre_repo = GenreRepository(db)
    genres = await genre_repo.get_all()

    return templates.TemplateResponse("list_detail.html", {
        "request": request,
        "list_data": list_data,
        "genres": genres,
        "current_user": user,
    })


@router.get("/film/{tmdb_id}/credits")
async def film_credits_page(request: Request, tmdb_id: int, service: FilmService = Depends(get_film_service)):
    """Film credits page."""
    film = await service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")
    return templates.TemplateResponse("film_credits.html", {
        "request": request,
        "film": film,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/film/{tmdb_id}")
async def film_detail(request: Request, tmdb_id: int, service: FilmService = Depends(get_film_service)):
    """Film detail page."""
    film = await service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Film not found")
    similar = await service.get_similar(tmdb_id)
    return templates.TemplateResponse("film.html", {
        "request": request,
        "film": film,
        "similar": similar,
    })


@router.get("/person/{tmdb_id}")
async def person_page(request: Request, tmdb_id: int, service: PersonService = Depends(get_person_service)):
    """Person detail page (actor/crew)."""
    person = await service.get_person_detail(tmdb_id)
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return templates.TemplateResponse("person.html", {
        "request": request,
        "person": person,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/search")
async def search_page(request: Request, q: str = Query(default="")):
    """Search page."""
    return templates.TemplateResponse("search.html", {
        "request": request,
        "q": q,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/login")
async def login(request: Request):
    """Login page."""
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/register")
async def register_page(request: Request):
    """Register page."""
    return templates.TemplateResponse("register.html", {"request": request})