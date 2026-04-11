from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Hearth"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-this-in-production"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8081"]

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Anthropic (Claude API)
    ANTHROPIC_API_KEY: str = ""

    # AWS (Textract for OCR)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # Redis (Celery background jobs)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Paddle (payments)
    PADDLE_API_KEY: str = ""
    PADDLE_WEBHOOK_SECRET: str = ""

    # Firebase (push notifications)
    FIREBASE_CREDENTIALS_PATH: str = ""

    # ─── FEATURE FLAGS ────────────────────────────────────────────────────
    # Flip to True as each module is ready to ship
    MODULE_DOCUMENTS:   bool = True    # Live — building now
    MODULE_BILLS:       bool = False   # Coming soon
    MODULE_GROCERY:     bool = False   # Coming soon
    MODULE_MAINTENANCE: bool = False   # Coming soon
    MODULE_HEALTH:      bool = False   # Coming soon

    class Config:
        env_file = ".env"


settings = Settings()
