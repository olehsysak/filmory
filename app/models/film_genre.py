from sqlalchemy import Table, Column, Integer, ForeignKey
from app.database import Base


# Intermediate table for a many-to-many relationship between movies and genres.
film_genre = Table(
    "film_genre", Base.metadata,
    Column("film_id", Integer, ForeignKey("films.id"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id"), primary_key=True),
)
