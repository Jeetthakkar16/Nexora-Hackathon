from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[1]

class Settings(BaseSettings):
    app_name: str = "LogiShield"
    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    database_path: str = "database/logishield.db"
    osrm_url: str = "https://router.project-osrm.org"
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    geocode_user_agent: str = "LogiShield-SIH/1.0"
    request_timeout_seconds: int = 15
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

def absolute_db_path() -> Path:
    p = Path(settings.database_path)
    return p if p.is_absolute() else ROOT_DIR / p
