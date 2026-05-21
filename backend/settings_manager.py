from pathlib import Path
from dotenv import set_key

ENV_PATH = Path(__file__).parent / ".env"

ALLOWED_KEYS = {
    "ps_base_url", "ps_auth_type", "ps_username", "ps_password", "ps_endpoint",
    "sftp_host", "sftp_port", "sftp_username", "sftp_password", "sftp_remote_path",
    "cors_origins",
}

def update_env(updates: dict) -> None:
    ENV_PATH.touch(exist_ok=True)
    for key, value in updates.items():
        if key.lower() in ALLOWED_KEYS:
            set_key(str(ENV_PATH), key.upper(), str(value))
