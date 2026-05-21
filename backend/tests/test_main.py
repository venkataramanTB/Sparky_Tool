import pytest
import httpx
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

CSV_BYTES = b"name,age\nAlice,30\nBob,25"


@pytest.fixture()
def client():
    with patch("main.settings") as mock_settings:
        mock_settings.cors_origins = "http://localhost:3000"
        from main import app
        return TestClient(app)


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_results_empty_before_run(client):
    with patch.dict("main._cache", {}, clear=True):
        response = client.get("/api/results")
    assert response.status_code == 404


def test_run_success(client):
    with patch("main.trigger_engine", return_value={"status": "ok"}), \
         patch("main.download_csv", return_value=CSV_BYTES), \
         patch.dict("main._cache", {}, clear=True):
        response = client.post("/api/run")
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 2
    assert "kpis" in data
    assert "rows" in data
    assert "columns" in data


def test_run_caches_result(client):
    with patch("main.trigger_engine", return_value={"status": "ok"}), \
         patch("main.download_csv", return_value=CSV_BYTES), \
         patch.dict("main._cache", {}, clear=True):
        client.post("/api/run")
        response = client.get("/api/results")
    assert response.status_code == 200
    assert response.json()["row_count"] == 2


def test_run_peoplesoft_502(client):
    with patch("main.trigger_engine", side_effect=httpx.HTTPStatusError(
        "Error", request=MagicMock(), response=MagicMock()
    )):
        response = client.post("/api/run")
    assert response.status_code == 502


def test_run_peoplesoft_timeout(client):
    with patch("main.trigger_engine", side_effect=httpx.TimeoutException("timeout")):
        response = client.post("/api/run")
    assert response.status_code == 504


def test_run_sftp_503(client):
    with patch("main.trigger_engine", return_value={"status": "ok"}), \
         patch("main.download_csv", side_effect=Exception("SFTP unreachable")):
        response = client.post("/api/run")
    assert response.status_code == 503
