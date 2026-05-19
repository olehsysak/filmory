from fastapi import APIRouter, Request, Depends, status, HTTPException, Query
from app.templates import templates
from fastapi.responses import RedirectResponse
from app.services.film_service import FilmService
from app.services.person_service import PersonService
from app.services.profile_service import ProfileService
from app.services.user_list_service import UserListService
from app.dependencies import get_film_service, get_async_db, get_person_service, get_profile_service
from app.repositories.genre_repo import GenreRepository
from app.repositories.profile_repo import ProfileRepository
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(tags=["pages"])


@router.get("/")
async def index(request: Request, service: FilmService = Depends(get_film_service)):
    """Renders homepage."""
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
    """Renders films browse page with genres."""
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
    """Renders current user's collection page."""
    if not request.state.user:
        return RedirectResponse(url="/login", status_code=302)

    valid_tabs = {"want_to_watch", "watching", "completed", "dropped", "favorites", "lists"}

    if tab not in valid_tabs:
        tab = "want_to_watch"

    return templates.TemplateResponse("collection.html", {
        "request": request,
        "active_tab": tab,
        "current_user": request.state.user,
        "profile_username": None,
        "is_owner": True,
        "privacy": {},
    })


@router.get("/users/{username}/collection")
async def user_collection_page(
    request: Request,
    username: str,
    tab: str = Query(default="want_to_watch"),
    db: AsyncSession = Depends(get_async_db),
):
    """Renders public collection page for a specific user."""
    viewer = request.state.user # current viewer

    repo = ProfileRepository(db)
    target_user = await repo.get_by_username(username) # target profile owner

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # redirect owner to personal collection page
    is_owner = viewer is not None and viewer.id == target_user.id
    if is_owner:
        return RedirectResponse(url=f"/collection?tab={tab}", status_code=302)

    # section visibility settings
    privacy = {
        "want_to_watch": target_user.want_to_watch_public,
        "watching": target_user.watching_public,
        "completed": target_user.completed_public,
        "dropped": target_user.dropped_public,
        "favorites": target_user.favorites_public,
        "lists": target_user.lists_public,
    }

    valid_tabs = {"want_to_watch", "watching", "completed", "dropped", "favorites", "lists"}
    if tab not in valid_tabs:
        tab = "want_to_watch" # fallback tab

    return templates.TemplateResponse("collection.html", {
        "request": request,
        "active_tab": tab,
        "current_user": viewer,
        "profile_username": username,
        "profile_display": target_user.username,
        "is_owner": False,
        "privacy": privacy,
    })


@router.get("/list/{list_id}")
async def list_detail_page(
    request: Request,
    list_id: int,
    db: AsyncSession = Depends(get_async_db),
):
    """Renders detailed page for a user list."""
    service = UserListService(db)

    user = request.state.user
    user_id = user.id if user else None

    try:
        list_data = await service.get_detail(list_id, user_id)
    except HTTPException as e:
        if e.status_code == 404:
            raise
        # redirect guests if login is required
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
    """Renders full cast + crew page for a film."""
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
    """Renders film detail page."""
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
    """Renders actor/director/person detail page."""
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
    """Renders search page."""
    return templates.TemplateResponse("search.html", {
        "request": request,
        "q": q,
        "current_user": request.state.user if hasattr(request.state, 'user') else None,
    })


@router.get("/login")
async def login(request: Request):
    """Renders login page."""
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/register")
async def register_page(request: Request):
    """Renders registration page."""
    return templates.TemplateResponse("register.html", {"request": request})


@router.get("/users/{username}")
async def profile_page(
    request: Request,
    username: str,
    service: ProfileService = Depends(get_profile_service),
):
    """Renders user profile page"""
    user = request.state.user  # current viewer
    viewer_id = user.id if user else None

    try:
        profile = await service.get_profile(username, viewer_id)
    except HTTPException as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        raise

    return templates.TemplateResponse("profile.html", {
        "request": request,
        "profile": profile,
        "current_user": user,
    })


@router.get("/profile/edit")
async def profile_edit_page(request: Request):
    """Renders profile edit page for authenticated user"""
    user = request.state.user

    if not user:
        return RedirectResponse(url="/login", status_code=302)

    return templates.TemplateResponse("profile_edit.html", {
        "request": request,
        "current_user": user,
    })