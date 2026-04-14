# Initialize models package and expose models
from .film_genre import film_genre
from .user import User
from .film import Film
from .genre import Genre
from .person import Person
from .film_credit import FilmCredit

__all__ = ["User", "film_genre", "Film", "Genre", "Person", "FilmCredit"]