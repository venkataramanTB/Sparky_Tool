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
    mock.ps_status_endpoint = "/api/status"
    mock.ps_process_name = "APPR_CLD_AE"
    monkeypatch.setattr("peoplesoft.get_settings", lambda: mock)
    return mock


def test_trigger_engine_basic_auth_success():
    mock_response = MagicMock()
    mock_response.is_redirect = False
    mock_response.json.return_value = {"status": "success"}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_response
        from peoplesoft import trigger_engine
        result = trigger_engine()
        assert result == {"status": "success"}


def test_trigger_engine_sends_json_body():
    mock_response = MagicMock()
    mock_response.is_redirect = False
    mock_response.json.return_value = {}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_post = mock_client_cls.return_value.__enter__.return_value.post
        mock_post.return_value = mock_response
        from peoplesoft import trigger_engine
        trigger_engine()
        _, kwargs = mock_post.call_args
        assert kwargs.get("json") == {"processname": "APPR_CLD_AE"}


def test_trigger_engine_raises_on_http_error():
    with patch("httpx.Client") as mock_client_cls:
        mock_response = MagicMock()
        mock_response.is_redirect = False
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=MagicMock()
        )
        mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_response
        from peoplesoft import trigger_engine
        with pytest.raises(httpx.HTTPStatusError):
            trigger_engine()


def test_trigger_engine_raises_on_redirect():
    """A 302 redirect means PeopleSoft rejected auth — should raise HTTPStatusError."""
    with patch("httpx.Client") as mock_client_cls:
        mock_response = MagicMock()
        mock_response.is_redirect = True
        mock_response.headers = {"location": "https://ps.test.com/psp/ps/?cmd=login"}
        mock_client_cls.return_value.__enter__.return_value.post.return_value = mock_response
        from peoplesoft import trigger_engine
        with pytest.raises(httpx.HTTPStatusError, match="Authentication failed"):
            trigger_engine()


def test_trigger_engine_bearer_auth(mock_settings):
    mock_settings.ps_auth_type = "bearer"
    mock_response = MagicMock()
    mock_response.is_redirect = False
    mock_response.json.return_value = {"status": "ok"}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_post = mock_client_cls.return_value.__enter__.return_value.post
        mock_post.return_value = mock_response
        from peoplesoft import trigger_engine
        trigger_engine()
        _, kwargs = mock_post.call_args
        assert "Authorization" in kwargs.get("headers", {})


def test_trigger_engine_full_url_endpoint(mock_settings):
    """When PS_ENDPOINT is a full URL it should be used directly, ignoring PS_BASE_URL."""
    mock_settings.ps_base_url = "https://ignored.example.com"
    mock_settings.ps_endpoint = "https://real-host.example.com/PSIGW/RESTListeningConnector/ZS_API.v1/API"
    mock_response = MagicMock()
    mock_response.is_redirect = False
    mock_response.json.return_value = {}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_post = mock_client_cls.return_value.__enter__.return_value.post
        mock_post.return_value = mock_response
        from peoplesoft import trigger_engine
        trigger_engine()
        args, _ = mock_post.call_args
        assert args[0] == "https://real-host.example.com/PSIGW/RESTListeningConnector/ZS_API.v1/API"


def test_trigger_engine_normalises_url(mock_settings):
    """Trailing slash on base_url + leading slash on endpoint should not double-slash."""
    mock_settings.ps_base_url = "https://ps.test.com/"
    mock_settings.ps_endpoint = "/api/query"
    mock_response = MagicMock()
    mock_response.is_redirect = False
    mock_response.json.return_value = {}
    mock_response.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_cls:
        mock_post = mock_client_cls.return_value.__enter__.return_value.post
        mock_post.return_value = mock_response
        from peoplesoft import trigger_engine
        trigger_engine()
        args, _ = mock_post.call_args
        assert args[0] == "https://ps.test.com/api/query"


# ── poll_status ───────────────────────────────────────────────────────────────

def test_poll_status_returns_on_success(mock_settings):
    mock_response = MagicMock()
    mock_response.json.return_value = {"STATUS": "Success", "ReportID": "87694", "InstanceID": 574586}
    mock_response.raise_for_status.return_value = None

    with patch("time.sleep"), patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response
        from peoplesoft import poll_status
        result = poll_status("574586")
    assert result["ReportID"] == "87694"
    assert result["STATUS"] == "Success"


def test_poll_status_raises_timeout(mock_settings):
    mock_response = MagicMock()
    mock_response.json.return_value = {"STATUS": "Running"}
    mock_response.raise_for_status.return_value = None

    with patch("time.sleep"), patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response
        from peoplesoft import poll_status
        with pytest.raises(TimeoutError, match="574586"):
            poll_status("574586", max_wait=10, poll_interval=5)


def test_poll_status_url_includes_instance_id(mock_settings):
    mock_settings.ps_base_url = "https://ps.test.com"
    mock_settings.ps_status_endpoint = "/api/status"

    mock_response = MagicMock()
    mock_response.json.return_value = {"STATUS": "Success", "ReportID": "111"}
    mock_response.raise_for_status.return_value = None

    with patch("time.sleep"), patch("httpx.Client") as mock_client_cls:
        mock_get = mock_client_cls.return_value.__enter__.return_value.get
        mock_get.return_value = mock_response
        from peoplesoft import poll_status
        poll_status("999")
        args, _ = mock_get.call_args
    assert args[0] == "https://ps.test.com/api/status/999"


def test_poll_status_case_insensitive_success(mock_settings):
    """STATUS comparison should be case-insensitive."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"STATUS": "SUCCESS", "ReportID": "42"}
    mock_response.raise_for_status.return_value = None

    with patch("time.sleep"), patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response
        from peoplesoft import poll_status
        result = poll_status("1")
    assert result["ReportID"] == "42"


def test_poll_status_stops_when_report_id_present(mock_settings):
    """ReportID being present is sufficient to stop polling, even if STATUS is 'Queued'."""
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "STATUS": "Queued",
        "processname": "SM_DISCOVERY",
        "InstanceID": 574609,
        "ReportID": "87717",
    }
    mock_response.raise_for_status.return_value = None

    with patch("time.sleep"), patch("httpx.Client") as mock_client_cls:
        mock_client_cls.return_value.__enter__.return_value.get.return_value = mock_response
        from peoplesoft import poll_status
        result = poll_status("574609")
    assert result["ReportID"] == "87717"
    assert result["STATUS"] == "Queued"
