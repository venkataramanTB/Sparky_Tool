import pytest
import httpx
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def mock_settings(monkeypatch):
    mock = MagicMock()
    mock.ps_base_url = "https://ps.test.com"
    mock.ps_auth_type = "basic"
    mock.ps_username = "user"
    mock.ps_password = "pass"
    mock.ps_endpoint = "/api/query"
    monkeypatch.setattr("peoplesoft.get_settings", lambda: mock)
    return mock


def test_trigger_engine_basic_auth_success():
    mock_response = MagicMock()
    mock_response.json.return_value = {"status": "success"}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_response
        from peoplesoft import trigger_engine
        result = trigger_engine()
        assert result == {"status": "success"}


def test_trigger_engine_raises_on_http_error():
    with patch("httpx.Client") as mock_client_cls:
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=MagicMock()
        )
        mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_response
        from peoplesoft import trigger_engine
        with pytest.raises(httpx.HTTPStatusError):
            trigger_engine()


def test_trigger_engine_bearer_auth(mock_settings):
    mock_settings.ps_auth_type = "bearer"
    mock_response = MagicMock()
    mock_response.json.return_value = {"status": "ok"}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_post = mock_client_cls.return_value.__enter__.return_value.post
        mock_post.return_value = mock_response
        from peoplesoft import trigger_engine
        trigger_engine()
        _, kwargs = mock_post.call_args
        assert "Authorization" in kwargs.get("headers", {})
