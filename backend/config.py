from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ps_base_url: str
    ps_auth_type: str = "basic"
    ps_username: str = ""
    ps_password: str = ""
    ps_endpoint: str

    sftp_host: str
    sftp_port: int = 22
    sftp_username: str
    sftp_password: str
    sftp_remote_path: str

    cors_origins: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "case_sensitive": False}

@lru_cache
def get_settings() -> Settings:
    return Settings()
