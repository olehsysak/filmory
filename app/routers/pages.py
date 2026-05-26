from fastapi import APIRouter, Request, Depends, status, HTTPException, Query
from app.templates import templates
from fastapi.responses import RedirectResponse
from app.clients.tmdb_client import tmdb_client
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
async def index(
        request: Request,
        service: FilmService = Depends(get_film_service),
        db: AsyncSession = Depends(get_async_db),
):
    """Renders homepage."""
    # Hero carousel: top 5 trending this week
    trending_week_raw = await tmdb_client.get_trending(period="week")

    hero_films = await service._get_or_create_from_tmdb_list(
        trending_week_raw.get("results", [])[:5]
    )

    # Generate backdrop image URLs for hero carousel slides
    for film in hero_films:
        film.backdrop_url = (
            tmdb_client.get_image_url(film.backdrop_path, size="w1280")
            if film.backdrop_path else None
        )

    # Trending rows
    trending_day_raw = await tmdb_client.get_trending(period="day")

    trending_day = await service._get_or_create_from_tmdb_list(
        trending_day_raw.get("results", [])[:18]
    )

    trending_week = await service._get_or_create_from_tmdb_list(
        trending_week_raw.get("results", [])[:18]
    )

    popular = await service.get_popular()

    new_releases = await service.get_new()

    genre_repo = GenreRepository(db)
    genres = await genre_repo.get_all()

    # Render homepage template with all required data
    return templates.TemplateResponse("index.html", {
        "request": request,
        "hero_films": hero_films,
        "trending_day": trending_day,
        "trending_week": trending_week,
        "popular": popular,
        "new_releases": new_releases[:18],
        "genres": genres,
        "current_user": request.state.user if hasattr(request.state, "user") else None,
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

    valid_tabs = {"want_to_watch", "watching", "completed", "dropped", "favorites", "lists", "liked_lists"}

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
async def film_detail(
    request: Request,
    tmdb_id: int,
    service: FilmService = Depends(get_film_service),
):
    """Renders film detail page."""
    film = await service.get_or_fetch_film(tmdb_id)
    if not film:
        raise HTTPException(status_code=404, detail="Film not found")

    similar = await service.get_similar(tmdb_id)
    tmdb_data = await tmdb_client.get_film(tmdb_id)
    stats = await service.get_film_stats(film.id)

    LANG_NAMES = {
        "en": "English", "fr": "French", "de": "German", "ja": "Japanese",
        "ko": "Korean", "es": "Spanish", "it": "Italian", "zh": "Chinese",
        "uk": "Ukrainian", "pt": "Portuguese", "hi": "Hindi", "ar": "Arabic",
        "tr": "Turkish", "pl": "Polish", "nl": "Dutch", "sv": "Swedish",
        "da": "Danish", "fi": "Finnish", "no": "Norwegian", "cs": "Czech",
        "th": "Thai", "id": "Indonesian", "vi": "Vietnamese", "he": "Hebrew",
        "ro": "Romanian", "hu": "Hungarian",
    }

    def fmt_money(val):
        if not val or val < 100_000:
            return None
        return f"${val:,}"

    companies = tmdb_data.get("production_companies", [])
    countries = tmdb_data.get("production_countries", [])
    spoken_languages = tmdb_data.get("spoken_languages", [])

    return templates.TemplateResponse("film.html", {
        "request": request,
        "film": film,
        "similar": similar,
        "film_studios": [c["name"] for c in companies if c.get("name")],
        "film_status": tmdb_data.get("status"),
        "film_countries": [c["name"] for c in countries if c.get("name")],
        "film_languages": [
            LANG_NAMES.get(l.get("iso_639_1"), l.get("english_name", l.get("name", "")))
            for l in spoken_languages if l.get("name")
        ],
        "film_budget": fmt_money(tmdb_data.get("budget")),
        "film_revenue": fmt_money(tmdb_data.get("revenue")),
        "film_budget_raw": tmdb_data.get("budget") or 0,
        "film_revenue_raw": tmdb_data.get("revenue") or 0,
        **stats,
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


@router.get("/community")
async def community_page(request: Request):
    """Renders community page with people and public lists."""
    return templates.TemplateResponse("community.html", {
        "request": request,
        "current_user": request.state.user if hasattr(request.state, "user") else None,
    })


@router.get("/login")
async def login(request: Request):
    """Renders login page."""
    return templates.TemplateResponse("login.html", {"request": request})


@router.get("/register")
async def register_page(request: Request):
    """Renders registration page."""
    return templates.TemplateResponse("register.html", {"request": request})


@router.get("/profile")
async def own_profile_page(request: Request):
    """Redirects authenticated user to their own profile page /users/{username}."""
    user = request.state.user

    if not user:
        return RedirectResponse(url="/login", status_code=302)

    return RedirectResponse(url=f"/users/{user.username}", status_code=302)


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