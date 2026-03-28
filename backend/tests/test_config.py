# tests/test_config.py
from app.core.config import Settings


def test_settings_required_fields():
    s = Settings(
        DATABASE_URL="postgresql+asyncpg://u:p@host/db",
        ANTHROPIC_API_KEY="sk-ant-test123",
    )
    assert s.DATABASE_URL == "postgresql+asyncpg://u:p@host/db"
    assert s.ANTHROPIC_API_KEY == "sk-ant-test123"


def test_settings_defaults():
    s = Settings(
        DATABASE_URL="postgresql+asyncpg://u:p@host/db",
        ANTHROPIC_API_KEY="sk-ant-test123",
    )
    assert s.ANTHROPIC_MODEL == "claude-sonnet-4-6"
    assert s.ANTHROPIC_MAX_TOKENS == 4096
    assert s.CORS_ORIGINS == ["http://localhost:3000"]


def test_settings_cors_override():
    s = Settings(
        DATABASE_URL="postgresql+asyncpg://u:p@host/db",
        ANTHROPIC_API_KEY="sk-ant-test123",
        CORS_ORIGINS=["https://my-app.vercel.app"],
    )
    assert s.CORS_ORIGINS == ["https://my-app.vercel.app"]
