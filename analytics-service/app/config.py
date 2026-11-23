import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "FinCore Analytics & Financial Calculation Service"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    INTERNAL_API_KEY: str = os.getenv("ANALYTICS_API_KEY", "fincore-internal-service-key-7890")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Financial Precision Settings
    ROUNDING_MODE: str = "ROUND_HALF_EVEN"
    DECIMAL_PLACES: int = 4
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
