"""Application configuration — loads from .env or defaults."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "O2C Context Graph"
    debug: bool = True

    # SQLite database path (relative to project root)
    db_path: str = "otc_graph.db"

    # CSV data directory
    data_dir: str = str(Path(__file__).resolve().parent.parent.parent / "data")

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path}"

    class Config:
        env_file = ".env"


settings = Settings()
