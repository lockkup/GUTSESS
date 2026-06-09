from __future__ import annotations

from datetime import timedelta
from functools import lru_cache
from typing import Literal
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ============================================================
    # App
    # ============================================================

    APP_NAME: str = "GUTS-ESS API"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8009
    APP_ENV: str = "development"

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # Compatibility กับระบบ Login ของทีม
    FRONTEND_URL: str | None = None

    # ============================================================
    # Database
    # ============================================================
    # ของโปรเจกต์เราใช้ DB_DRIVER
    # ของทีมใช้ DB_ENGINE
    # รองรับทั้ง 2 แบบ

    DB_DRIVER: str = "sqlite"
    DB_ENGINE: str | None = None

    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_NAME: str = "guts_ess"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    SQLITE_DB_FILE: str = "guts_ess_attendance_dev.db"

    # Compatibility กับระบบ Login ของทีม
    SQLITE_PATH: str | None = None

    # ============================================================
    # JWT / Security
    # ============================================================
    # ของโปรเจกต์เราใช้ JWT_*
    # ของทีมใช้ SECRET_KEY / ALGORITHM / ACCESS_TOKEN_EXPIRE_MINUTES

    JWT_SECRET_KEY: str = "change_this_secret_key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Compatibility กับระบบ Login ของทีม
    SECRET_KEY: str | None = None
    ALGORITHM: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int | None = None

    # ============================================================
    # Email / Forgot Password
    # ============================================================

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    EMAIL_FROM: str = ""
    RESET_EXPIRE_MINUTES: int = 15

    # ============================================================
    # MFA / Compatibility
    # ============================================================

    MFA_ISSUER_NAME: str = "GUTS-ESS"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_settings(self) -> "Settings":
        # ------------------------------------------------------------
        # Normalize DB_DRIVER / DB_ENGINE
        # ------------------------------------------------------------
        driver = (self.DB_ENGINE or self.DB_DRIVER or "sqlite").lower().strip()

        if driver not in {"sqlite", "mysql"}:
            raise ValueError("DB_DRIVER / DB_ENGINE must be 'sqlite' or 'mysql'")

        self.DB_DRIVER = driver
        self.DB_ENGINE = driver

        # ------------------------------------------------------------
        # Normalize SQLITE_DB_FILE / SQLITE_PATH
        # ------------------------------------------------------------
        if self.SQLITE_PATH:
            self.SQLITE_DB_FILE = self.SQLITE_PATH
        else:
            self.SQLITE_PATH = self.SQLITE_DB_FILE

        # ------------------------------------------------------------
        # Normalize FRONTEND_ORIGIN / FRONTEND_URL
        # ------------------------------------------------------------
        if self.FRONTEND_URL:
            self.FRONTEND_ORIGIN = self.FRONTEND_URL
        else:
            self.FRONTEND_URL = self.FRONTEND_ORIGIN

        # ------------------------------------------------------------
        # Normalize JWT_* / SECRET_KEY
        # ------------------------------------------------------------
        unsafe_jwt_secrets = {
            "",
            "change_this_secret_key",
            "change-this-in-production",
            "your_super_secret_jwt_key_change_this_now_123456789",
        }

        if self.SECRET_KEY:
            if self.JWT_SECRET_KEY in unsafe_jwt_secrets:
                self.JWT_SECRET_KEY = self.SECRET_KEY
        else:
            self.SECRET_KEY = self.JWT_SECRET_KEY

        if self.ALGORITHM:
            self.JWT_ALGORITHM = self.ALGORITHM
        else:
            self.ALGORITHM = self.JWT_ALGORITHM

        if self.ACCESS_TOKEN_EXPIRE_MINUTES is not None:
            self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = self.ACCESS_TOKEN_EXPIRE_MINUTES
        else:
            self.ACCESS_TOKEN_EXPIRE_MINUTES = self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES

        if (
            self.APP_ENV.lower() == "production"
            and self.JWT_SECRET_KEY in unsafe_jwt_secrets
        ):
            raise ValueError("JWT_SECRET_KEY / SECRET_KEY must be changed in production")

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

    @property
    def database_url_masked(self) -> str:
        if self.DB_DRIVER == "sqlite":
            return f"sqlite:///./{self.SQLITE_DB_FILE}"

        masked_password = "***" if self.DB_PASSWORD else ""

        return (
            f"mysql+pymysql://{self.DB_USER}:{masked_password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def access_token_expire_timedelta(self) -> timedelta:
        return timedelta(minutes=self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    @property
    def reset_expire_timedelta(self) -> timedelta:
        return timedelta(minutes=self.RESET_EXPIRE_MINUTES)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


if settings.APP_ENV.lower() != "production":
    print("========== SETTINGS DEBUG ==========")
    print("APP_ENV =", repr(settings.APP_ENV))
    print("APP_HOST =", repr(settings.APP_HOST))
    print("APP_PORT =", repr(settings.APP_PORT))
    print("DB_DRIVER =", repr(settings.DB_DRIVER))
    print("DB_ENGINE =", repr(settings.DB_ENGINE))
    print("DB_HOST =", repr(settings.DB_HOST))
    print("DB_PORT =", repr(settings.DB_PORT))
    print("DB_NAME =", repr(settings.DB_NAME))
    print("DB_USER =", repr(settings.DB_USER))
    print("DATABASE_URL =", repr(settings.database_url_masked))
    print("SQLITE_DB_FILE =", repr(settings.SQLITE_DB_FILE))
    print("SQLITE_PATH =", repr(settings.SQLITE_PATH))
    print("FRONTEND_ORIGIN =", repr(settings.FRONTEND_ORIGIN))
    print("FRONTEND_URL =", repr(settings.FRONTEND_URL))
    print("SMTP_HOST =", repr(settings.SMTP_HOST))
    print("SMTP_PORT =", repr(settings.SMTP_PORT))
    print("EMAIL_FROM =", repr(settings.EMAIL_FROM))
    print("====================================")