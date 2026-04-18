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
    
    # Database
    DATABASE_URL: str
    
    # Anthropic
    ANTHROPIC_API_KEY: str
    
    # AWS
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
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