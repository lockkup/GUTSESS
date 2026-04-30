from __future__ import annotations

from typing import Literal
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "GUTS-ESS API"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    APP_ENV: str = "development"

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    DB_DRIVER: Literal["sqlite", "mysql"] = "sqlite"

    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_NAME: str = "guts_ess"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    SQLITE_DB_FILE: str = "guts_ess_attendance_dev.db"

    JWT_SECRET_KEY: str = "change_this_secret_key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_settings(self) -> "Settings":
        unsafe_jwt_secrets = {
            "",
            "change_this_secret_key",
            "your_super_secret_jwt_key_change_this_now_123456789",
        }

        if (
            self.APP_ENV.lower() == "production"
            and self.JWT_SECRET_KEY in unsafe_jwt_secrets
        ):
            raise ValueError("JWT_SECRET_KEY must be changed in production")

        return self

    @property
    def database_url(self) -> str:
        if self.DB_DRIVER == "sqlite":
            return f"sqlite:///./{self.SQLITE_DB_FILE}"

        encoded_password = quote_plus(self.DB_PASSWORD)
        return (
            f"mysql+pymysql://{self.DB_USER}:{encoded_password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )


settings = Settings()