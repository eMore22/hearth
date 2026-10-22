from pydantic_settings import BaseSettings
from typing import List, Optional, Dict

class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    # Database
    DATABASE_URL: str

    # Anthropic
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"
    AI_ENABLED: bool = True

    # AWS
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # NVIDIA
    NVIDIA_API_KEY: str = ""
    NVIDIA_REASONING_MODEL: str = ""

    # Shared secret supplied only to trusted Home Assistant webhooks.
    HA_WEBHOOK_SECRET: str = ""
    # Separate application-side Fernet key for Home Assistant tokens. Never ship to mobile.
    HA_TOKEN_ENCRYPTION_KEY: str = ""
    # Backend-only operator approval for scoped account deletion; never mobile.
    DELETION_OPERATOR_SECRET: str = ""

    # Server-side RevenueCat key, NEVER EXPO_PUBLIC_. Gate is enabled only
    # after purchase/restore validation in Google Play Internal Testing.
    REVENUECAT_SECRET_API_KEY: str = ""
    BILLING_ENFORCEMENT_ENABLED: bool = False

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:19006", "http://localhost:8081", "http://localhost:3000"]

    # Feature flags
    ACTIVE_MODULES: Dict[str, bool] = {
        "documents": True,
        "bills": True,
        "grocery": True,
        "maintenance": True,
        "health": True,
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()