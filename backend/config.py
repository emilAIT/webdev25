import os
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost/dbname"))

    SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SECRET_KEY", "some_secret_key"))
    SESSION_SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SESSION_SECRET_KEY", "some_secret_key"))

    EMAIL: str = Field(default_factory=lambda: os.getenv("EMAIL"))
    EMAIL_PASSWORD: str = Field(default_factory=lambda: os.getenv("EMAIL_PASSWORD"))
    EMAIL_MINUTE: int = Field(default_factory=lambda: int(os.getenv("EMAIL_MINUTE", 3)))
    
    REDIS_SESSIONS_URL: str = Field(default_factory=lambda: os.getenv("REDIS_SESSIONS_URL", "redis://localhost:6379/3"))
    REDIS_CODES_URL: str = Field(default_factory=lambda: os.getenv("REDIS_CODES_URL", "redis://localhost:6379/2"))
    REDIS_BLACKLIST_URL: str = Field(default_factory=lambda: os.getenv("REDIS_BLACKLIST_URL", "redis://localhost:6379/5"))

    JWT_ALGORITHM: str = Field(default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)))
    REFRESH_TOKEN_EXPIRE_MINUTES: int = Field(default_factory=lambda: int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", 1440)))

    
    CELERY_BROKER_URL: str = Field(
        default_factory=lambda: os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    )
    CELERY_BACKEND_URL: str = Field(
        default_factory=lambda: os.getenv("CELERY_BACKEND_URL", "redis://localhost:6379/1")
    )
    CELERY_TOKENS_URL: str = Field(
        default_factory=lambda: os.getenv("CELERY_TOKENS_URL", "redis://localhost:6379/4")
    )

    PASSWORD_HASH_SCHEME: str = Field(default_factory=lambda: os.getenv("PASSWORD_HASH_SCHEME"))

    class Config:
        env_file = ".env"

settings = Settings()
