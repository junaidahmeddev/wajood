"""Application configuration via environment variables."""

import os
from pathlib import Path
from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "WAJOOD"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = Field(
        "http://localhost,http://localhost:3000,http://localhost:8000",
        validation_alias=AliasChoices("CORS_ORIGINS", "ALLOWED_ORIGINS")
    )

    # Database (SQLite for local dev, PostgreSQL for Docker)
    DATABASE_URL: str = "sqlite+aiosqlite:///./wajood.db"
    SYNC_DATABASE_URL: str = "sqlite:///./wajood.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO / Object Storage
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "wajood"
    MINIO_SECRET_KEY: str = "wajood123"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = Field(
        "wajood-photos",
        validation_alias=AliasChoices("MINIO_BUCKET", "MINIO_BUCKET_NAME")
    )

    # JWT
    JWT_SECRET_KEY: str = Field(
        "wajood-super-secret-key-change-in-production-2024",
        validation_alias=AliasChoices("JWT_SECRET", "JWT_SECRET_KEY")
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        60 * 24,
        validation_alias=AliasChoices("JWT_EXPIRE_MINUTES", "JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    )

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # Notifications
    NOTIFICATION_BACKEND: str = "console"  # console | smtp | twilio

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
