from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    BOT_TOKEN: str = "CHANGEME"
    ADMIN_IDS: str = ""          # comma-separated telegram_ids
    WEBAPP_URL: str = "https://yxb.example.uz"
    DATABASE_URL: str = "sqlite+aiosqlite:///./yxb.db"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 50
    DEV_MODE: bool = False       # bypass Telegram auth in dev
    SECRET_KEY: str = "change-me-in-production-32bytes!!"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def admin_ids_list(self) -> List[int]:
        if not self.ADMIN_IDS:
            return []
        return [int(x.strip()) for x in self.ADMIN_IDS.split(",") if x.strip()]


settings = Settings()
