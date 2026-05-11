from sqlalchemy import extract
from app.models.film_genre import film_genre
from app.models.user_film import UserFilm


def apply_film_filters(
    query, Film,
    genre_id=None,
    year=None,
    year_from=None,
    year_to=None,
    runtime_min=None,
    runtime_max=None,
    rated_only=False,
    unrated_only=False,
    search=None,
    is_favorite=False,
):
    """Applies filtering conditions to the film query."""
    # Filter by genre using many-to-many relationship table
    if genre_id:
        query = query.join(
            film_genre, film_genre.c.film_id == Film.id
        ).where(film_genre.c.genre_id == genre_id)
    if year:
        query = query.where(extract('year', Film.release_date) == year)
    if year_from:
        query = query.where(extract('year', Film.release_date) >= year_from)
    if year_to:
        query = query.where(extract('year', Film.release_date) <= year_to)
    if runtime_min:
        query = query.where(Film.runtime >= runtime_min)
    if runtime_max:
        query = query.where(Film.runtime <= runtime_max)
    if rated_only:
        query = query.where(UserFilm.rating.isnot(None))
    if unrated_only:
        query = query.where(UserFilm.rating.is_(None))
    if search:
        query = query.where(Film.title.ilike(f'%{search}%'))
    return query


def apply_sort(query, model, Film, sort, is_favorite=False):
    """Applies sorting rules to the film query."""
    # Choose correct rating column depending on context
    user_rating_col = UserFilm.rating if is_favorite else model.rating

    # Mapping of sort options to SQLAlchemy ordering expressions
    sort_map = {
        'added_desc': model.added_at.desc(),
        'added_asc': model.added_at.asc(),
        'release_desc': Film.release_date.desc(),
        'release_asc': Film.release_date.asc(),
        'rating_desc': Film.vote_average.desc(),
        'rating_asc': Film.vote_average.asc(),
        'popularity_desc': Film.popularity.desc(),
        'runtime_desc': Film.runtime.desc(),
        'runtime_asc': Film.runtime.asc(),
        'user_rating_desc': user_rating_col.desc(),
        'user_rating_asc':  user_rating_col.asc(),
    }
    return query.order_by(sort_map.get(sort, model.added_at.desc()))