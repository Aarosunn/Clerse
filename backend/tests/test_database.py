# tests/test_database.py
import inspect
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from app.core.database import engine, AsyncSessionLocal, get_db


def test_engine_is_async():
    assert isinstance(engine, AsyncEngine)


def test_async_session_local_type():
    assert isinstance(AsyncSessionLocal, async_sessionmaker)


def test_get_db_is_async_generator():
    assert inspect.isasyncgenfunction(get_db)
