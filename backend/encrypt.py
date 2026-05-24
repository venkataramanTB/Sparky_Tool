import os
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    # Prefer explicit env var; fall back to pydantic-settings (.env loader)
    key = os.environ.get("ENCRYPTION_KEY", "")
    if not key:
        from config import get_settings
        key = get_settings().encryption_key
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().decrypt(value.encode()).decode()
