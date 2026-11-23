from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    SERVICE_KEY: Optional[str] = None
    TEMP_BASE_DIR: str = "/tmp/elio-ytdlp"
    MAX_CONCURRENT_EXTRACTIONS: int = 10
    DEFAULT_MAX_DURATION_SECONDS: int = 3600
    CORS_ORIGINS: List[str] = ["*"]
    ALLOW_PRIVATE_IPS_FOR_TESTING: bool = False


settings = Settings()
