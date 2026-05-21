import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


SETTINGS_PAYLOAD = {
    "ps_base_url": "https://ps.new.com",
    "ps_auth_type": "basic",
    "ps_username": "newuser",
    "ps_password": "newpass",
    "ps_endpoint": "/api/new",
    "sftp_host": "sftp.new.com",
    "sftp_port": "22",
    "sftp_username": "sftpuser",
    "sftp_password": "sftppass",
    "sftp_remote_path": "/new.csv",
    "cors_origins": "http://localhost:3000",
}


@pytest.fixture()
def client():
    with patch("main.settings") as mock_settings:
        mock_settings.cors_origins = "http://localhost:3000"
        mock_settings.ps_base_url = "https://ps.example.com"
        mock_settings.ps_auth_type = "basic"
        mock_settings.ps_username = "user"
        mock_settings.ps_password = "secret"
        mock_settings.ps_endpoint = "/api/query"
        mock_settings.sftp_host = "sftp.example.com"
        mock_settings.sftp_port = 22
        mock_settings.sftp_username = "sftpuser"
        mock_settings.sftp_password = "sftppass"
        mock_settings.sftp_remote_path = "/output.csv"
        from main import app
        return TestClient(app)


def test_get_settings_returns_masked_passwords(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "ps_base_url" in data
    assert data["ps_password"] == "***"
    assert data["sftp_password"] == "***"


def test_post_settings_calls_update_env(client):
    with patch("main.update_env") as mock_update, \
         patch("main.get_settings") as mock_gs:
        mock_gs.return_value.cors_origins = "http://localhost:3000"
        response = client.post("/api/settings", json=SETTINGS_PAYLOAD)
    assert response.status_code == 200
    assert response.json()["status"] == "saved"
    mock_update.assert_called_once()
