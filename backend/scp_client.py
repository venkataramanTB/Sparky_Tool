import paramiko
from config import get_settings


def download_csv(remote_path: str | None = None, _settings=None) -> bytes:
    settings = _settings or get_settings()
    path = remote_path or settings.sftp_remote_path
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=settings.sftp_host,
            port=settings.sftp_port,
            username=settings.sftp_username,
            password=settings.sftp_password,
        )
        _, stdout, stderr = client.exec_command(f"cat {path}")
        data = stdout.read()
        err = stderr.read()
        if not data and err:
            raise RuntimeError(err.decode().strip())
        return data
    finally:
        client.close()
