from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://localhost:5432/journey_tracker"
    mapbox_token: str = ""
    upload_dir: str = "uploads"
    max_upload_size: int = 10 * 1024 * 1024  # 10 MB
    allowed_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
