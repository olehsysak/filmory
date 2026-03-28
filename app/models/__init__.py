# Initialize models package and expose models
from .user import User
from .film import Film
from .genre import Genre, film_genre

__all__ = ["User", "Film", "Genre"]