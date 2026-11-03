from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables / the repo-root .env file."""

    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "AI Tutor Dashboard"
    api_prefix: str = "/api/v1"
    # Comma-separated in env (CORS_ORIGINS=http://a,http://b); NoDecode skips JSON parsing.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )
    secret_key: str = "change-me"

    postgres_user: str = "aitutor"
    postgres_password: str = "aitutor_dev_password"
    postgres_db: str = "aitutor"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    redis_url: str = "redis://localhost:6379/0"

    health_check_timeout_seconds: float = 2.0

    # --- Auth ---
    frontend_url: str = "http://localhost:5173"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    password_reset_ttl_minutes: int = 30
    refresh_cookie_name: str = "aitutor_refresh"
    # Rate limits: attempts per window, keyed by client IP.
    auth_rate_limit: int = 10
    auth_rate_window_seconds: int = 60

    # --- LLM (AI tutor) ---
    # "auto" uses Anthropic when ANTHROPIC_API_KEY is set, otherwise the labelled mock provider.
    llm_provider: Literal["auto", "anthropic", "mock"] = "auto"
    anthropic_api_key: str = ""
    llm_model_tutor: str = "claude-opus-5-5"
    llm_model_structured: str = "claude-opus-5-5"
    llm_effort_tutor: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    llm_effort_structured: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
    llm_max_tokens: int = 16000
    llm_timeout_seconds: float = 120.0
    llm_max_retries: int = 2
    # How many earlier messages of a conversation are sent as memory.
    llm_history_messages: int = 30
    # Delay between mock stream chunks (0 in tests).
    mock_stream_delay_seconds: float = 0.02
    ai_rate_limit: int = 20
    ai_rate_window_seconds: int = 60

    # --- Speech (STT / TTS) ---
    stt_provider: Literal["mock", "gnani"] = "mock"
    tts_provider: Literal["mock", "gnani"] = "mock"
    # Gnani placeholders: read only by the disabled adapters, never sent to the frontend.
    gnani_api_key: str = ""
    gnani_api_base_url: str = ""
    gnani_stt_enabled: bool = False
    gnani_tts_enabled: bool = False
    speech_max_audio_bytes: int = 10 * 1024 * 1024
    speech_max_tts_chars: int = 2000
    speech_rate_limit: int = 30
    speech_rate_window_seconds: int = 60

    # --- Email (optional; console mailer is used when SMTP_HOST is empty) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    @property
    def cookie_secure(self) -> bool:
        return self.app_env == "production"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.app_env == "production" and settings.secret_key in ("change-me", ""):
        raise RuntimeError("SECRET_KEY must be set to a strong random value in production")
    return settings
