import os
from unittest.mock import patch

def test_settings_load_required_fields():
    env = {
        "PS_BASE_URL": "https://ps.example.com",
        "PS_AUTH_TYPE": "basic",
        "PS_USERNAME": "user",
        "PS_PASSWORD": "pass",
        "PS_ENDPOINT": "/api/query",
        "SFTP_HOST": "sftp.example.com",
        "SFTP_PORT": "22",
        "SFTP_USERNAME": "sftpuser",
        "SFTP_PASSWORD": "sftppass",
        "SFTP_REMOTE_PATH": "/output.csv",
    }
    with patch.dict(os.environ, env, clear=True):
        from config import Settings
        s = Settings()
        assert s.ps_base_url == "https://ps.example.com"
        assert s.sftp_host == "sftp.example.com"
        assert s.sftp_port == 22

def test_settings_defaults():
    env = {
        "PS_BASE_URL": "https://ps.example.com",
        "PS_USERNAME": "user",
        "PS_PASSWORD": "pass",
        "PS_ENDPOINT": "/api/query",
        "SFTP_HOST": "sftp.example.com",
        "SFTP_USERNAME": "sftpuser",
        "SFTP_PASSWORD": "sftppass",
        "SFTP_REMOTE_PATH": "/output.csv",
    }
    with patch.dict(os.environ, env, clear=True):
        from config import Settings
        s = Settings()
        assert s.ps_auth_type == "basic"
        assert s.sftp_port == 22
        assert s.cors_origins == "http://localhost:3000"
