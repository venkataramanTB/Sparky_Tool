# FTP Service + VPN Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove VPN from every layer and add FTP/FTPS as a first-class retrieval method with file browser, mirroring the Windows Server pattern.

**Architecture:** New `ftp_client.py` using stdlib `ftplib`; 7 new DB columns + 7 dropped VPN columns via idempotent startup migrations; three new FastAPI endpoints; new `FtpBrowser.jsx` component; VPN section replaced by FTP section in `Settings.jsx`.

**Tech Stack:** Python `ftplib` (stdlib), SQLAlchemy, FastAPI/Pydantic, React/MUI

---

## File Map

| Action | File |
|--------|------|
| **Create** | `backend/ftp_client.py` |
| **Create** | `frontend/src/components/FtpBrowser.jsx` |
| **Modify** | `backend/models.py` |
| **Modify** | `backend/database.py` |
| **Modify** | `backend/routers/configs.py` |
| **Modify** | `backend/main.py` |
| **Modify** | `frontend/src/api.js` |
| **Modify** | `frontend/src/pages/Settings.jsx` |
| **Delete** | `backend/vpn_client.py` |

---

## Task 1: Create `backend/ftp_client.py`

**Files:**
- Create: `backend/ftp_client.py`

- [ ] **Step 1: Create the file**

```python
"""
ftp_client.py — FTP / FTPS file retrieval using stdlib ftplib.

Supports plain FTP (port 21) and explicit FTPS (AUTH TLS on port 21).
Passive mode is the default for NAT/firewall compatibility.
"""
from __future__ import annotations
import ftplib
import io
from logger import get_logger

log = get_logger("ftp_client")


def _connect(host: str, port: int, username: str, password: str,
             tls: bool, passive: bool) -> ftplib.FTP:
    """Open and authenticate an FTP(S) connection. Caller must call ftp.quit()."""
    ftp: ftplib.FTP = ftplib.FTP_TLS() if tls else ftplib.FTP()
    ftp.connect(host, port, timeout=15)
    ftp.login(username or "anonymous", password or "")
    if tls:
        ftp.prot_p()   # encrypt data channel — must come after login()
    ftp.set_pasv(passive)
    log.info("ftp:connect  %s:%d  user=%s  tls=%s  passive=%s",
             host, port, username or "anonymous", tls, passive)
    return ftp


def download_csv(remote_path: str | None = None, _settings=None) -> bytes:
    """Download a remote file and return raw bytes. Called by the run engine."""
    host     = _settings.ftp_host
    port     = _settings.ftp_port or 21
    username = _settings.ftp_username
    password = _settings.ftp_password   # decrypted by _config_to_ns in main.py
    tls      = getattr(_settings, "ftp_connection_type", "ftp") == "ftps"
    passive  = getattr(_settings, "ftp_passive", True)
    path     = remote_path or _settings.ftp_remote_path

    log.info("ftp:download_csv  %s:%d  path=%s  tls=%s", host, port, path, tls)
    ftp = _connect(host, port, username, password, tls, passive)
    try:
        buf = io.BytesIO()
        ftp.retrbinary(f"RETR {path}", buf.write)
        buf.seek(0)
        data = buf.read()
        log.info("ftp:download_csv OK  %d bytes", len(data))
        return data
    finally:
        ftp.quit()


def test_connection(host: str, port: int, username: str, password: str,
                    tls: bool = False, passive: bool = True) -> dict:
    """Test FTP connectivity. Returns ComputerName, Protocol, Welcome."""
    ftp = _connect(host, port, username, password, tls, passive)
    try:
        welcome = ftp.getwelcome()
        return {
            "ComputerName": host,
            "Protocol": "FTPS (Explicit TLS)" if tls else "FTP",
            "Welcome": welcome,
        }
    finally:
        ftp.quit()


def list_directory(host: str, port: int, username: str, password: str,
                   path: str, tls: bool = False, passive: bool = True) -> list[dict]:
    """List a directory. Returns [{name, type, size, modified}].
    Uses MLSD (RFC 3659) with NLST fallback for older servers."""
    ftp = _connect(host, port, username, password, tls, passive)
    try:
        items: list[dict] = []
        try:
            for name, facts in ftp.mlsd(path):
                if name in (".", ".."):
                    continue
                item_type = "dir" if facts.get("type") in ("dir", "cdir", "pdir") else "file"
                size = int(facts["size"]) if facts.get("size") else None
                raw_mod = facts.get("modify", "")
                modified = None
                if raw_mod and len(raw_mod) >= 14:
                    m = raw_mod
                    modified = f"{m[:4]}-{m[4:6]}-{m[6:8]}T{m[8:10]}:{m[10:12]}:{m[12:14]}"
                items.append({"name": name, "type": item_type, "size": size, "modified": modified})
        except ftplib.error_perm:
            log.debug("ftp:list_directory MLSD not supported, falling back to NLST  path=%s", path)
            for name in ftp.nlst(path):
                bare = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
                if bare not in (".", ".."):
                    items.append({"name": bare, "type": "file", "size": None, "modified": None})
        log.info("ftp:list_directory  path=%s  items=%d", path, len(items))
        return items
    finally:
        ftp.quit()


def read_file(host: str, port: int, username: str, password: str,
              path: str, tls: bool = False, passive: bool = True,
              max_kb: int = 256) -> str:
    """Download the first max_kb KB of a file and return it as UTF-8 text."""
    ftp = _connect(host, port, username, password, tls, passive)
    try:
        buf = io.BytesIO()
        ftp.retrbinary(f"RETR {path}", buf.write, blocksize=8192)
        buf.seek(0)
        data = buf.read(max_kb * 1024)
        log.info("ftp:read_file  path=%s  bytes_read=%d", path, len(data))
        return data.decode("utf-8", errors="replace")
    finally:
        ftp.quit()
```

- [ ] **Step 2: Verify the file is importable (no syntax errors)**

```bash
cd backend && python -c "import ftp_client; print('OK')"
```
Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/ftp_client.py
git commit -m "feat(ftp): add ftp_client with download/test/browse/read_file"
```

---

## Task 2: Update `backend/models.py`

**Files:**
- Modify: `backend/models.py`

Remove the 7 VPN columns from `UserConfig` and add 7 FTP columns.

- [ ] **Step 1: Remove VPN comment block and columns**

In `backend/models.py`, replace the VPN block (lines 42–49):
```python
    # VPN tunnel (optional — connects before Windows server access)
    vpn_enabled        = Column(Boolean, default=False)
    vpn_type           = Column(String, default="none")   # none|openconnect|openvpn|wireguard|ssh_tunnel
    vpn_host           = Column(String, default="")
    vpn_port           = Column(Integer, default=None)
    vpn_username       = Column(String, default="")
    vpn_password_enc   = Column(Text, default="")
    vpn_extra          = Column(Text, default="")         # group/realm (AnyConnect), OTP, etc.
```
with the FTP block:
```python
    # FTP / FTPS server access
    ftp_host            = Column(String,  default="")
    ftp_port            = Column(Integer, default=21)
    ftp_username        = Column(String,  default="")
    ftp_password_enc    = Column(Text,    default="")
    ftp_remote_path     = Column(Text,    default="")
    ftp_connection_type = Column(String,  default="ftp")   # ftp | ftps
    ftp_passive         = Column(Boolean, default=True)
```

- [ ] **Step 2: Verify no import errors**

```bash
cd backend && python -c "from models import UserConfig; print([c.key for c in UserConfig.__table__.columns if c.key.startswith('ftp')])"
```
Expected output: `['ftp_host', 'ftp_port', 'ftp_username', 'ftp_password_enc', 'ftp_remote_path', 'ftp_connection_type', 'ftp_passive']`

- [ ] **Step 3: Commit**

```bash
git add backend/models.py
git commit -m "feat(ftp): replace VPN columns with FTP columns in UserConfig model"
```

---

## Task 3: Update `backend/database.py`

**Files:**
- Modify: `backend/database.py`

Remove the 7 VPN `ADD COLUMN` statements. Add 7 `DROP COLUMN IF EXISTS` for VPN cleanup and 7 `ADD COLUMN IF NOT EXISTS` for FTP.

- [ ] **Step 1: Remove VPN ADD COLUMN lines**

In `backend/database.py`, in the `stmts` list, remove these 7 lines:
```python
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_type VARCHAR DEFAULT 'none'",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_host VARCHAR DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_port INTEGER",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_username VARCHAR DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_password_enc TEXT DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS vpn_extra TEXT DEFAULT ''",
```

- [ ] **Step 2: Add DROP VPN + ADD FTP migrations**

Immediately after the `win_domain` ADD COLUMN line (currently the last `user_configs` entry), add:
```python
        # ── Remove VPN columns (idempotent) ───────────────────────────────────
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_enabled",
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_type",
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_host",
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_port",
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_username",
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_password_enc",
        "ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_extra",
        # ── FTP / FTPS access ────────────────────────────────────────────────
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_host VARCHAR DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_port INTEGER DEFAULT 21",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_username VARCHAR DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_password_enc TEXT DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_remote_path TEXT DEFAULT ''",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_connection_type VARCHAR DEFAULT 'ftp'",
        "ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_passive BOOLEAN DEFAULT TRUE",
```

- [ ] **Step 3: Verify the module imports cleanly**

```bash
cd backend && python -c "import database; print('OK')"
```
Expected output: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/database.py
git commit -m "feat(ftp): add FTP migrations, drop VPN columns on startup"
```

---

## Task 4: Update `backend/routers/configs.py`

**Files:**
- Modify: `backend/routers/configs.py`

Remove VPN from `ConfigPayload`, `_serialize`, `create_config`, and `update_config`. Add FTP fields throughout.

- [ ] **Step 1: Update `ConfigPayload`**

Replace the VPN block in `ConfigPayload`:
```python
    # VPN tunnel
    vpn_enabled: bool = False
    vpn_type: str = "none"
    vpn_host: str = ""
    vpn_port: int | None = None
    vpn_username: str = ""
    vpn_password: str = ""
    vpn_extra: str = ""
```
with:
```python
    # FTP / FTPS server access
    ftp_host: str = ""
    ftp_port: int = 21
    ftp_username: str = ""
    ftp_password: str = ""
    ftp_remote_path: str = ""
    ftp_connection_type: str = "ftp"
    ftp_passive: bool = True
```

- [ ] **Step 2: Update `_serialize`**

Replace the VPN block in `_serialize`:
```python
        "vpn_enabled":        config.vpn_enabled or False,
        "vpn_type":           config.vpn_type or "none",
        "vpn_host":           config.vpn_host or "",
        "vpn_port":           config.vpn_port,
        "vpn_username":       config.vpn_username or "",
        "vpn_password":       "***" if config.vpn_password_enc else "",
        "vpn_extra":          config.vpn_extra or "",
```
with:
```python
        "ftp_host":            config.ftp_host or "",
        "ftp_port":            config.ftp_port or 21,
        "ftp_username":        config.ftp_username or "",
        "ftp_password":        "***" if config.ftp_password_enc else "",
        "ftp_remote_path":     config.ftp_remote_path or "",
        "ftp_connection_type": config.ftp_connection_type or "ftp",
        "ftp_passive":         config.ftp_passive if config.ftp_passive is not None else True,
```

- [ ] **Step 3: Update `create_config`**

Replace in the `UserConfig(...)` constructor call:
```python
        vpn_enabled=body.vpn_enabled,
        vpn_type=body.vpn_type,
        vpn_host=body.vpn_host,
        vpn_port=body.vpn_port,
        vpn_username=body.vpn_username,
        vpn_password_enc=encrypt(body.vpn_password) if body.vpn_password else "",
        vpn_extra=body.vpn_extra,
```
with:
```python
        ftp_host=body.ftp_host,
        ftp_port=body.ftp_port,
        ftp_username=body.ftp_username,
        ftp_password_enc=encrypt(body.ftp_password) if body.ftp_password else "",
        ftp_remote_path=body.ftp_remote_path,
        ftp_connection_type=body.ftp_connection_type,
        ftp_passive=body.ftp_passive,
```

- [ ] **Step 4: Update `update_config`**

Replace the VPN block of attribute assignments:
```python
    config.vpn_enabled        = body.vpn_enabled
    config.vpn_type           = body.vpn_type
    config.vpn_host           = body.vpn_host
    config.vpn_port           = body.vpn_port
    config.vpn_username       = body.vpn_username
    config.vpn_extra          = body.vpn_extra
```
with:
```python
    config.ftp_host            = body.ftp_host
    config.ftp_port            = body.ftp_port
    config.ftp_username        = body.ftp_username
    config.ftp_remote_path     = body.ftp_remote_path
    config.ftp_connection_type = body.ftp_connection_type
    config.ftp_passive         = body.ftp_passive
```

And replace the VPN password sentinel check:
```python
    if body.vpn_password and body.vpn_password != "***":
        config.vpn_password_enc = encrypt(body.vpn_password)
```
with:
```python
    if body.ftp_password and body.ftp_password != "***":
        config.ftp_password_enc = encrypt(body.ftp_password)
```

- [ ] **Step 5: Verify**

```bash
cd backend && python -c "from routers.configs import ConfigPayload; p = ConfigPayload(); print(p.ftp_host, p.ftp_port, p.ftp_connection_type)"
```
Expected output: ` 21 ftp`

- [ ] **Step 6: Commit**

```bash
git add backend/routers/configs.py
git commit -m "feat(ftp): replace VPN with FTP fields in configs router"
```

---

## Task 5: Update `backend/main.py`

**Files:**
- Modify: `backend/main.py`

Five sub-changes: (a) remove VPN test endpoint, (b) remove VPN import, (c) update `_config_to_ns`, (d) update run dispatch, (e) add FTP endpoints.

- [ ] **Step 1: Remove `VpnTestPayload` class and `test_vpn` endpoint**

Delete the entire block (lines ~799–831):
```python
class VpnTestPayload(BaseModel):
    vpn_type: str = "none"
    vpn_host: str = ""
    vpn_port: int | None = None
    vpn_username: str = ""
    vpn_password: str = ""
    vpn_extra: str = ""


@app.post("/api/test-vpn")
def test_vpn(body: VpnTestPayload):
    from types import SimpleNamespace
    s = SimpleNamespace(
        vpn_enabled=True,
        vpn_type=body.vpn_type,
        vpn_host=body.vpn_host,
        vpn_port=body.vpn_port,
        vpn_username=body.vpn_username,
        vpn_password=body.vpn_password,
        vpn_extra=body.vpn_extra,
    )
    log.info("test_vpn  type=%s  host=%s", body.vpn_type, body.vpn_host)
    try:
        import vpn_client as _vpn
        result = _vpn.vpn_test(s)
        if result["ok"]:
            return {"status": "ok", "vpn_type": body.vpn_type}
        raise HTTPException(400, result.get("error", "VPN test failed"))
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("test_vpn error: %s", exc)
        raise HTTPException(400, str(exc))
```

- [ ] **Step 2: Update `_config_to_ns`**

Replace the VPN block in `_config_to_ns`:
```python
            # VPN tunnel
            vpn_enabled=config.vpn_enabled or False,
            vpn_type=config.vpn_type or "none",
            vpn_host=config.vpn_host or "",
            vpn_port=config.vpn_port,
            vpn_username=config.vpn_username or "",
            vpn_password=decrypt(config.vpn_password_enc) if config.vpn_password_enc else "",
            vpn_extra=config.vpn_extra or "",
```
with:
```python
            # FTP / FTPS
            ftp_host=config.ftp_host or "",
            ftp_port=config.ftp_port or 21,
            ftp_username=config.ftp_username or "",
            ftp_password=decrypt(config.ftp_password_enc) if config.ftp_password_enc else "",
            ftp_remote_path=config.ftp_remote_path or "",
            ftp_connection_type=config.ftp_connection_type or "ftp",
            ftp_passive=config.ftp_passive if config.ftp_passive is not None else True,
```

- [ ] **Step 3: Update `_run_one_engine` — remove VPN pre-connect block and dispatch**

Replace the entire VPN+download block:
```python
            t3 = _time.time()
            _vpn_ctx = None
            _is_windows_method = s_eng.retrieval_method in ("winrm", "smb", "win_ssh")
            try:
                if _is_windows_method and getattr(s_eng, "vpn_enabled", False):
                    try:
                        import vpn_client as _vpn
                        _vpn_ctx = _vpn.vpn_connect(s_eng)
                        log.info("Run %d  VPN connected  type=%s", run_log.id, s_eng.vpn_type)
                    except Exception as vpn_exc:
                        run_log.failed_step = "vpn"
                        raise HTTPException(503, f"VPN connection failed: {vpn_exc}")

                if s_eng.retrieval_method == "scp":
                    csv_bytes = scp_client.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "winrm":
                    import windows_client as _wc
                    csv_bytes = _wc.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "smb":
                    import smb_client as _smbcli
                    csv_bytes = _smbcli.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "win_ssh":
                    import win_ssh_client as _winssh
                    csv_bytes = _winssh.download_csv(remote_path=remote_path, _settings=s_eng)
                else:
                    csv_bytes = sftp_client.download_csv(remote_path=remote_path, _settings=s_eng)
            except Exception as exc:
                label = {"scp": "SSH/SCP", "winrm": "WinRM", "smb": "SMB", "win_ssh": "SSH"}.get(
                    s_eng.retrieval_method, "SFTP"
                )
                if not isinstance(exc, HTTPException):
                    run_log.failed_step = "download"
                raise exc if isinstance(exc, HTTPException) else HTTPException(503, f"{label} download error: {exc}")
            finally:
                if _vpn_ctx is not None:
                    try:
                        import vpn_client as _vpn
                        _vpn.vpn_disconnect(_vpn_ctx)
                    except Exception as vpn_disc_exc:
                        log.warning("Run %d  VPN disconnect error: %s", run_log.id, vpn_disc_exc)
```
with:
```python
            t3 = _time.time()
            try:
                if s_eng.retrieval_method == "scp":
                    csv_bytes = scp_client.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "winrm":
                    import windows_client as _wc
                    csv_bytes = _wc.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "smb":
                    import smb_client as _smbcli
                    csv_bytes = _smbcli.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "win_ssh":
                    import win_ssh_client as _winssh
                    csv_bytes = _winssh.download_csv(remote_path=remote_path, _settings=s_eng)
                elif s_eng.retrieval_method == "ftp":
                    import ftp_client as _ftpcli
                    csv_bytes = _ftpcli.download_csv(remote_path=remote_path, _settings=s_eng)
                else:
                    csv_bytes = sftp_client.download_csv(remote_path=remote_path, _settings=s_eng)
            except Exception as exc:
                label = {"scp": "SSH/SCP", "winrm": "WinRM", "smb": "SMB", "win_ssh": "SSH", "ftp": "FTP"}.get(
                    s_eng.retrieval_method, "SFTP"
                )
                if not isinstance(exc, HTTPException):
                    run_log.failed_step = "download"
                raise exc if isinstance(exc, HTTPException) else HTTPException(503, f"{label} download error: {exc}")
```

- [ ] **Step 4: Add FTP Pydantic models and endpoints**

Add the following after the `win_read_file` endpoint (after the `_win_error_msg` / `_winrm_error_msg` helper functions):

```python
# ── FTP / FTPS endpoints ──────────────────────────────────────────────────────

class FtpPayload(BaseModel):
    ftp_host: str
    ftp_port: int = 21
    ftp_username: str = ""
    ftp_password: str = ""
    ftp_connection_type: str = "ftp"   # ftp | ftps
    ftp_passive: bool = True


class FtpBrowsePayload(FtpPayload):
    path: str


class FtpReadFilePayload(FtpPayload):
    path: str


@app.post("/api/test-ftp")
def test_ftp(body: FtpPayload):
    import ftp_client as _ftp
    tls = body.ftp_connection_type == "ftps"
    log.info("test_ftp  %s:%d  user=%s  tls=%s", body.ftp_host, body.ftp_port, body.ftp_username, tls)
    try:
        info = _ftp.test_connection(
            body.ftp_host, body.ftp_port,
            body.ftp_username, body.ftp_password,
            tls=tls, passive=body.ftp_passive,
        )
        return {"status": "ok", **info}
    except Exception as exc:
        log.warning("test_ftp failed  %s: %s", body.ftp_host, exc)
        raise HTTPException(400, str(exc))


@app.post("/api/ftp-browse")
def ftp_browse(body: FtpBrowsePayload):
    import ftp_client as _ftp
    tls = body.ftp_connection_type == "ftps"
    log.info("ftp_browse  %s  path=%s  tls=%s", body.ftp_host, body.path, tls)
    try:
        items = _ftp.list_directory(
            body.ftp_host, body.ftp_port,
            body.ftp_username, body.ftp_password,
            body.path, tls=tls, passive=body.ftp_passive,
        )
        return {"path": body.path, "items": items}
    except Exception as exc:
        log.warning("ftp_browse failed  %s  path=%s: %s", body.ftp_host, body.path, exc)
        raise HTTPException(400, str(exc))


@app.post("/api/ftp-read-file")
def ftp_read_file(body: FtpReadFilePayload):
    import ftp_client as _ftp
    tls = body.ftp_connection_type == "ftps"
    log.info("ftp_read_file  %s  path=%s  tls=%s", body.ftp_host, body.path, tls)
    try:
        content = _ftp.read_file(
            body.ftp_host, body.ftp_port,
            body.ftp_username, body.ftp_password,
            body.path, tls=tls, passive=body.ftp_passive,
        )
        return {"path": body.path, "content": content}
    except Exception as exc:
        log.warning("ftp_read_file failed  %s  path=%s: %s", body.ftp_host, body.path, exc)
        raise HTTPException(400, str(exc))
```

- [ ] **Step 5: Delete `backend/vpn_client.py`**

```bash
del backend\vpn_client.py
```

- [ ] **Step 6: Verify backend starts without errors**

```bash
cd backend && python -c "
import os; os.environ.setdefault('DATABASE_URL','postgresql://x:x@localhost/x')
os.environ.setdefault('CLERK_JWKS_URL','https://example.com/.well-known/jwks.json')
os.environ.setdefault('ENCRYPTION_KEY','dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==')
from main import app; print('OK — routes:', [r.path for r in app.routes if '/api/ftp' in getattr(r,'path','') or '/api/test-vpn' in getattr(r,'path','')])"
```
Expected output includes `/api/test-ftp`, `/api/ftp-browse`, `/api/ftp-read-file` and does **not** include `/api/test-vpn`.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git rm backend/vpn_client.py
git commit -m "feat(ftp): add FTP endpoints, remove VPN endpoint and pre-connect logic"
```

---

## Task 6: Update `frontend/src/api.js`

**Files:**
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Remove `testVpn` and add three FTP functions**

In the imports line (line 18 in `Settings.jsx` references it), remove `testVpn` from the `api.js` exports. Find and delete:
```js
export const testVpn = ...
```
(if it's a one-liner) — check the file; it was added in the original SFTP / Windows section.

Actually locate `testVpn` in `api.js`. Based on the codebase pattern it is likely:
```js
export const testVpn        = (data, token) => client.post('/test-vpn',  data, { headers: auth(token) })
```
Delete that line.

Then add after `testWindows`, `winBrowse`, `winReadFile`:
```js
// FTP / FTPS
export const testFtp        = (data, token) => client.post('/test-ftp',       data, { headers: auth(token) })
export const ftpBrowse      = (data, token) => client.post('/ftp-browse',      data, { headers: auth(token) })
export const ftpReadFile    = (data, token) => client.post('/ftp-read-file',   data, { headers: auth(token) })
```

- [ ] **Step 2: Verify**

```bash
cd frontend && node -e "
const src = require('fs').readFileSync('src/api.js','utf8')
console.log('testFtp:', src.includes('testFtp'))
console.log('ftpBrowse:', src.includes('ftpBrowse'))
console.log('testVpn absent:', !src.includes('testVpn'))
"
```
Expected output:
```
testFtp: true
ftpBrowse: true
testVpn absent: true
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api.js
git commit -m "feat(ftp): add FTP api functions, remove testVpn"
```

---

## Task 7: Create `frontend/src/components/FtpBrowser.jsx`

**Files:**
- Create: `frontend/src/components/FtpBrowser.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect, useCallback } from 'react'
import {
  Dialog, DialogContent, Box, Typography, IconButton,
  CircularProgress, Tooltip, Breadcrumbs, Link,
} from '@mui/material'
import FolderIcon          from '@mui/icons-material/Folder'
import FolderOpenIcon      from '@mui/icons-material/FolderOpen'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import ArrowBackIcon       from '@mui/icons-material/ArrowBack'
import CloseIcon           from '@mui/icons-material/Close'
import RefreshIcon         from '@mui/icons-material/Refresh'
import HomeIcon            from '@mui/icons-material/Home'
import ArticleIcon         from '@mui/icons-material/Article'
import { useThemeContext } from '../ThemeContext'
import { ftpBrowse, ftpReadFile } from '../api'
import MythicsLoader from './MythicsLoader'

const TEXT_EXTS = new Set([
  'csv', 'txt', 'log', 'xml', 'json', 'yaml', 'yml',
  'cfg', 'conf', 'ini', 'env', 'sh', 'sql', 'html', 'htm',
  'properties', 'py', 'js', 'ts',
])

function isTextFile(name) {
  return TEXT_EXTS.has(name.split('.').pop()?.toLowerCase() || '')
}

function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

function ftpPathSegments(path) {
  // FTP paths are Unix-style: /pub/data/reports
  const clean = path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  const parts = clean.split('/').filter(Boolean)
  const segments = [{ label: '/', path: '/' }]
  for (let i = 0; i < parts.length; i++) {
    segments.push({ label: parts[i], path: '/' + parts.slice(0, i + 1).join('/') })
  }
  return segments
}

function joinFtpPath(base, name) {
  const b = base.replace(/\/$/, '')
  return `${b}/${name}`
}

export default function FtpBrowser({
  open, onClose,
  ftpHost, ftpPort = 21, ftpUsername = '', ftpPassword = '',
  ftpConnectionType = 'ftp', ftpPassive = true,
  token,
}) {
  const { accent, mode } = useThemeContext()
  const isDark = mode === 'dark'

  const [currentPath, setCurrentPath] = useState('/')
  const [history,     setHistory]     = useState([])
  const [items,       setItems]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  const [viewFile,    setViewFile]    = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError,   setFileError]   = useState(null)

  const creds = {
    ftp_host: ftpHost, ftp_port: ftpPort,
    ftp_username: ftpUsername, ftp_password: ftpPassword,
    ftp_connection_type: ftpConnectionType, ftp_passive: ftpPassive,
  }

  const browse = useCallback(async (path) => {
    setLoading(true)
    setError(null)
    setItems(null)
    setViewFile(null)
    setFileContent(null)
    try {
      const res = await ftpBrowse({ ...creds, path }, token)
      setItems(res.data.items || [])
      setCurrentPath(path)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to list directory')
    } finally {
      setLoading(false)
    }
  }, [ftpHost, ftpUsername, ftpPassword, ftpPort, ftpConnectionType, ftpPassive])

  useEffect(() => {
    if (open && ftpHost && ftpPassword) {
      setHistory([])
      setCurrentPath('/')
      browse('/')
    }
  }, [open])  // eslint-disable-line

  const navigateTo = (path) => {
    setHistory((h) => [...h, currentPath])
    browse(path)
  }

  const goBack = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    browse(prev)
  }

  const goHome = () => {
    setHistory([])
    browse('/')
  }

  const openFile = async (path, name) => {
    setViewFile({ path, name })
    setFileContent(null)
    setFileError(null)
    setFileLoading(true)
    try {
      const res = await ftpReadFile({ ...creds, path }, token)
      setFileContent(res.data.content)
    } catch (err) {
      setFileError(err.response?.data?.detail ?? 'Failed to read file')
    } finally {
      setFileLoading(false)
    }
  }

  const segments = ftpPathSegments(currentPath)
  const protocol = ftpConnectionType === 'ftps' ? 'FTPS' : 'FTP'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          border: `1px solid ${accent}33`,
          borderRadius: '2px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ height: 2, flexShrink: 0, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, borderBottom: `1px solid ${accent}1f`, bgcolor: `${accent}06`, flexShrink: 0 }}>
          <Tooltip title="Back" arrow>
            <span>
              <IconButton size="small" onClick={goBack} disabled={history.length === 0}
                sx={{ color: history.length ? accent : 'text.disabled' }}>
                <ArrowBackIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Home (/)" arrow>
            <IconButton size="small" onClick={goHome} sx={{ color: accent }}>
              <HomeIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh" arrow>
            <IconButton size="small" onClick={() => browse(currentPath)} sx={{ color: accent }}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {/* Breadcrumb */}
          <Breadcrumbs sx={{ flex: 1, '& .MuiBreadcrumbs-separator': { mx: 0.5 } }}>
            {segments.map((seg, i) => (
              i < segments.length - 1 ? (
                <Link key={seg.path} component="button" onClick={() => navigateTo(seg.path)}
                  underline="hover"
                  sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: accent, cursor: 'pointer' }}>
                  {seg.label}
                </Link>
              ) : (
                <Typography key={seg.path}
                  sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: 'text.primary' }}>
                  {seg.label}
                </Typography>
              )
            ))}
          </Breadcrumbs>

          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.58rem', color: 'text.disabled', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {protocol} · {ftpHost}
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.disabled', '&:hover': { color: accent } }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Body: file list + optional viewer */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* File list pane */}
          <Box sx={{ flex: viewFile ? '0 0 45%' : '1', overflow: 'auto', borderRight: viewFile ? `1px solid ${accent}1f` : 'none' }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                <MythicsLoader size={48} />
              </Box>
            )}
            {error && (
              <Box sx={{ px: 3, pt: 4 }}>
                <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem', color: '#c98f8f' }}>{error}</Typography>
              </Box>
            )}
            {!loading && !error && items !== null && (
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <Box component="thead">
                  <Box component="tr" sx={{ borderBottom: `1px solid ${accent}14` }}>
                    {['Name', 'Size', 'Modified'].map((h) => (
                      <Box key={h} component="th" sx={{ px: 2.5, py: 1, textAlign: 'left', fontFamily: '"Raleway", sans-serif', fontSize: '0.55rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.disabled', fontWeight: 700 }}>
                        {h}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {items.length === 0 && (
                    <Box component="tr">
                      <Box component="td" colSpan={3} sx={{ px: 2.5, py: 3, fontFamily: '"Raleway", sans-serif', fontSize: '0.7rem', color: 'text.disabled', textAlign: 'center' }}>
                        Empty directory
                      </Box>
                    </Box>
                  )}
                  {items.map((item) => {
                    const isDir = item.type === 'dir'
                    const itemPath = joinFtpPath(currentPath, item.name)
                    const canOpen = !isDir && isTextFile(item.name)
                    return (
                      <Box key={item.name} component="tr"
                        onClick={() => isDir ? navigateTo(itemPath) : canOpen ? openFile(itemPath, item.name) : undefined}
                        sx={{
                          cursor: isDir || canOpen ? 'pointer' : 'default',
                          borderBottom: `1px solid ${accent}0a`,
                          bgcolor: viewFile?.path === itemPath ? `${accent}10` : 'transparent',
                          '&:hover': { bgcolor: `${accent}09` },
                        }}>
                        <Box component="td" sx={{ px: 2.5, py: 1, display: 'flex', alignItems: 'center', gap: 1.2 }}>
                          {isDir
                            ? <FolderIcon sx={{ fontSize: 15, color: accent }} />
                            : canOpen
                              ? <ArticleIcon sx={{ fontSize: 15, color: accent }} />
                              : <InsertDriveFileIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                          }
                          <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: isDir ? accent : 'text.primary' }}>
                            {item.name}
                          </Typography>
                        </Box>
                        <Box component="td" sx={{ px: 2.5, py: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {isDir ? '—' : formatSize(item.size)}
                        </Box>
                        <Box component="td" sx={{ px: 2.5, py: 1, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.65rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                          {formatDate(item.modified)}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )}
          </Box>

          {/* File viewer pane */}
          {viewFile && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: `1px solid ${accent}1f`, bgcolor: `${accent}04`, flexShrink: 0 }}>
                <ArticleIcon sx={{ fontSize: 14, color: accent }} />
                <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: 'text.secondary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {viewFile.name}
                </Typography>
                <IconButton size="small" onClick={() => setViewFile(null)} sx={{ color: 'text.disabled', '&:hover': { color: accent } }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {fileLoading && <CircularProgress size={20} sx={{ color: accent }} />}
                {fileError && <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem', color: '#c98f8f' }}>{fileError}</Typography>}
                {fileContent != null && (
                  <Box component="pre" sx={{ m: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: isDark ? '#d4d4d4' : '#333', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {fileContent}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/FtpBrowser.jsx
git commit -m "feat(ftp): add FtpBrowser component mirroring WinServerBrowser"
```

---

## Task 8: Update `frontend/src/pages/Settings.jsx`

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

This is the largest change. Work top-to-bottom through the file.

- [ ] **Step 1: Update imports**

Replace:
```js
import VpnLockIcon    from '@mui/icons-material/VpnLock'
import { useAuth } from '../AuthContext'
import { useThemeContext } from '../ThemeContext'
import { listConfigs, createConfig, updateConfig, deleteConfig, testRetrieval, testPeoplesoft, testWindows, testVpn, listEngines } from '../api'
import WinServerBrowser from '../components/WinServerBrowser'
```
with:
```js
import StorageIcon    from '@mui/icons-material/Storage'
import { useAuth } from '../AuthContext'
import { useThemeContext } from '../ThemeContext'
import { listConfigs, createConfig, updateConfig, deleteConfig, testRetrieval, testPeoplesoft, testWindows, testFtp, listEngines } from '../api'
import WinServerBrowser from '../components/WinServerBrowser'
import FtpBrowser from '../components/FtpBrowser'
```

- [ ] **Step 2: Remove `VPN_TYPES` constant**

Delete the entire block:
```js
const VPN_TYPES = [
  { value: 'none',        label: 'None — no VPN required' },
  { value: 'fortinet',    label: 'Fortinet FortiGate SSL VPN (most common)' },
  { value: 'openconnect', label: 'Cisco AnyConnect / GlobalProtect / Pulse Secure' },
  { value: 'openvpn',     label: 'OpenVPN (.ovpn config)' },
  { value: 'wireguard',   label: 'WireGuard (wg-quick config)' },
  { value: 'ssh_tunnel',  label: 'SSH Tunnel — SOCKS5 proxy via jump host' },
]
```

Add in its place:
```js
const FTP_DEFAULT_PORTS = { ftp: '21', ftps: '21' }
```

- [ ] **Step 3: Update `EMPTY` form state**

Replace the VPN fields:
```js
  vpn_enabled: false, vpn_type: 'none', vpn_host: '', vpn_port: '',
  vpn_username: '', vpn_password: '', vpn_extra: '',
```
with FTP fields:
```js
  ftp_host: '', ftp_port: '21', ftp_username: '',
  ftp_password: '', ftp_remote_path: '', ftp_connection_type: 'ftp', ftp_passive: true,
```

- [ ] **Step 4: Update state declarations**

Replace:
```js
  const [showVpnPass, setShowVpnPass]       = useState(false)
  const [vpnTestStatus, setVpnTestStatus]   = useState(null)
```
with:
```js
  const [showFtpPass, setShowFtpPass]       = useState(false)
  const [ftpTestStatus, setFtpTestStatus]   = useState(null)
  const [ftpBrowserOpen, setFtpBrowserOpen] = useState(false)
```

- [ ] **Step 5: Update key arrays in `set()` handler**

Replace:
```js
  const VPN_KEYS = ['vpn_enabled', 'vpn_type', 'vpn_host', 'vpn_port', 'vpn_username', 'vpn_password', 'vpn_extra']
```
with:
```js
  const FTP_KEYS = ['ftp_host', 'ftp_port', 'ftp_username', 'ftp_password', 'ftp_remote_path', 'ftp_connection_type', 'ftp_passive']
```

In the `set()` function body, replace:
```js
    if (VPN_KEYS.includes(k)) setVpnTestStatus(null)
```
with:
```js
    if (FTP_KEYS.includes(k)) setFtpTestStatus(null)
```

- [ ] **Step 6: Replace `handleVpnTest` with `handleFtpTest`**

Delete:
```js
  const handleVpnTest = async () => {
    setVpnTestStatus('testing')
    try {
      await testVpn({
        ...
      })
      setVpnTestStatus({ ok: true })
    } catch (err) {
      setVpnTestStatus({ ok: false, message: err.response?.data?.detail ?? 'VPN connection failed' })
    }
  }
```

Add:
```js
  const handleFtpTest = async () => {
    setFtpTestStatus('testing')
    try {
      const res = await testFtp({
        ftp_host: form.ftp_host,
        ftp_port: parseInt(form.ftp_port, 10) || 21,
        ftp_username: form.ftp_username,
        ftp_password: livePass(form.ftp_password),
        ftp_connection_type: form.ftp_connection_type,
        ftp_passive: form.ftp_passive,
      }, token)
      setFtpTestStatus({ ok: true, ...res.data })
    } catch (err) {
      setFtpTestStatus({ ok: false, message: err.response?.data?.detail ?? 'FTP connection failed' })
    }
  }

  const handleFtpConnectionTypeChange = (e) => {
    const type = e.target.value
    setForm((prev) => ({ ...prev, ftp_connection_type: type, ftp_port: FTP_DEFAULT_PORTS[type] || prev.ftp_port }))
    setFtpTestStatus(null)
  }
```

- [ ] **Step 7: Update load form (`loadForm`)**

In the `loadForm` function, replace the VPN field assignments:
```js
      vpn_enabled:        config.vpn_enabled || false,
      vpn_type:           config.vpn_type || 'none',
      vpn_host:           config.vpn_host || '',
      vpn_port:           config.vpn_port ? String(config.vpn_port) : '',
      vpn_username:       config.vpn_username || '',
      vpn_password:       config.vpn_password || '',
      vpn_extra:          config.vpn_extra || '',
```
with:
```js
      ftp_host:           config.ftp_host || '',
      ftp_port:           config.ftp_port ? String(config.ftp_port) : '21',
      ftp_username:       config.ftp_username || '',
      ftp_password:       config.ftp_password || '',
      ftp_remote_path:    config.ftp_remote_path || '',
      ftp_connection_type: config.ftp_connection_type || 'ftp',
      ftp_passive:        config.ftp_passive !== undefined ? config.ftp_passive : true,
```

- [ ] **Step 8: Update section completion indicators**

Replace:
```js
  const sec03Complete = !!(form.vpn_enabled ? form.vpn_host && form.vpn_type !== 'none' : true)
  const sec04Complete = !!(form.win_host && form.win_username)
```
with:
```js
  const sec03Complete = !!(form.win_host && form.win_username)
  const sec04Complete = !!(form.ftp_host && form.ftp_username)
```

- [ ] **Step 9: Update retrieval method section (Section 02)**

In the `<Select>` for `retrieval_method`, add `ftp` as an option before the closing tag:
```jsx
                  <MenuItem value="sftp">SFTP — Secure File Transfer (Linux / Unix)</MenuItem>
                  <MenuItem value="scp">SSH / SCP — Server exec via SSH (Linux / Unix)</MenuItem>
                  <MenuItem value="winrm">Windows / WinRM — PowerShell remote execution</MenuItem>
                  <MenuItem value="smb">Windows / SMB — File sharing (no config needed)</MenuItem>
                  <MenuItem value="win_ssh">Windows / SSH — OpenSSH on Windows (port 22)</MenuItem>
                  <MenuItem value="ftp">FTP / FTPS — File Transfer Protocol</MenuItem>
```

In the Windows hint box condition, add `'ftp'` to show a similar note when FTP is selected:
```jsx
          {['winrm', 'smb', 'win_ssh', 'ftp'].includes(form.retrieval_method) && (
```
And inside that box, add an `ftp` branch:
```jsx
                {form.retrieval_method === 'ftp' && <><strong style={{ fontWeight: 700 }}>FTP / FTPS</strong> uses the FTP Server credentials from Section 04. Remote path should be Unix-style, e.g. <Box component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: accent }}>/reports/{'{'}{'}report_id{'}'}/output.csv</Box>.</>}
```

Also update the test-button area at the bottom of Section 02. Currently it shows the SFTP test button when method is sftp/scp, and a text note otherwise. Add `ftp` to the "use section 04" text:
```jsx
              <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.65rem', color: 'text.disabled', letterSpacing: '0.06em' }}>
                Use <strong style={{ fontWeight: 700 }}>Test {{ winrm: 'WinRM', smb: 'SMB', win_ssh: 'SSH', ftp: 'FTP' }[form.retrieval_method] || 'connection'}</strong> in Section {{'winrm': '03', 'smb': '03', 'win_ssh': '03', 'ftp': '04'}[form.retrieval_method] || '03'} below.
              </Typography>
```

- [ ] **Step 10: Replace Section 03 (VPN) with Windows section renumbered to 03**

Replace the entire Section 03 VPN `<SectionCard>` block:
```jsx
      {/* ── Section 03: VPN Tunnel ───────────────────────────────────────────── */}
      <SectionCard number="03" title="VPN Tunnel" subtitle="Optional — establish a VPN connection before reaching the Windows server" complete={sec03Complete}>
        ...all VPN JSX...
      </SectionCard>

      {/* ── Section 04: Windows server access ────────────────────────────────── */}
      <SectionCard number="04" title="Windows server access" subtitle="Browse and retrieve files from a Windows host — WinRM, SMB, or SSH" complete={sec04Complete}>
        ...Windows JSX...
      </SectionCard>
```
with the Windows section renumbered to 03 (change `number="04"` → `number="03"` and update `SectionCard` props), then add the new FTP section as 04.

The Windows section header change:
```jsx
      {/* ── Section 03: Windows server access ───────────────────────────────── */}
      <SectionCard number="03" title="Windows server access" subtitle="Browse and retrieve files from a Windows host — WinRM, SMB, or SSH" complete={sec03Complete}>
```
(All internal JSX stays identical — only `number` prop and comment change.)

- [ ] **Step 11: Add Section 04 (FTP Server)**

After the (now) Section 03 Windows `</SectionCard>` closing tag and before the sticky save footer, add:

```jsx
      {/* ── Section 04: FTP server access ────────────────────────────────────── */}
      <SectionCard number="04" title="FTP server access" subtitle="Browse and retrieve files via plain FTP or FTPS (explicit TLS)" complete={sec04Complete}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <Field label="Connection type">
              <FormControl fullWidth size="small">
                <Select value={form.ftp_connection_type} onChange={handleFtpConnectionTypeChange} sx={selectSx}>
                  <MenuItem value="ftp">Plain FTP (port 21)</MenuItem>
                  <MenuItem value="ftps">FTPS — Explicit TLS (port 21)</MenuItem>
                </Select>
              </FormControl>
            </Field>
          </Box>

          <Field label="Host / IP address">
            <TextField fullWidth size="small" value={form.ftp_host} onChange={set('ftp_host')} placeholder="ftp.example.com" sx={inputSx} />
          </Field>
          <Field label="Port">
            <TextField fullWidth size="small" type="number" value={form.ftp_port} onChange={set('ftp_port')} inputProps={{ min: 1, max: 65535 }} sx={inputSx} />
          </Field>
          <Field label="Username">
            <TextField fullWidth size="small" value={form.ftp_username} onChange={set('ftp_username')} placeholder="ftpuser" autoComplete="off" sx={inputSx} />
          </Field>
          <Field label="Password">
            <TextField fullWidth size="small" type={showFtpPass ? 'text' : 'password'} value={form.ftp_password} onChange={set('ftp_password')} autoComplete="new-password"
              InputProps={passAdornment(showFtpPass, () => setShowFtpPass((p) => !p))} sx={inputSx} />
          </Field>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <FormControlLabel
              control={<Switch checked={form.ftp_passive} onChange={set('ftp_passive')} size="small" sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: accent }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: accent } }} />}
              label={<Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.68rem', color: 'text.secondary' }}>Passive mode (recommended — works through NAT and firewalls)</Typography>}
            />
          </Box>

          {form.ftp_connection_type === 'ftps' && (
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.5, border: `1px solid ${accent}26`, bgcolor: `${accent}06`, borderRadius: '3px' }}>
              <StorageIcon sx={{ fontSize: 15, color: accent, mt: 0.15, flexShrink: 0 }} />
              <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.6 }}>
                <strong style={{ fontWeight: 700 }}>Explicit FTPS</strong> upgrades the control connection to TLS using AUTH TLS on port 21. The server must support RFC 4217. This is the modern standard — preferred over implicit FTPS (port 990).
              </Typography>
            </Box>
          )}

          {/* Test + Browse buttons */}
          <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button onClick={handleFtpTest} variant="outlined"
              disabled={ftpTestStatus === 'testing' || !form.ftp_host || !form.ftp_username}
              startIcon={ftpTestStatus === 'testing' ? <CircularProgress size={13} sx={{ color: accent }} /> : <StorageIcon sx={{ fontSize: 14 }} />}
              sx={btnSx}>
              {ftpTestStatus === 'testing' ? 'Connecting…' : `Test ${form.ftp_connection_type === 'ftps' ? 'FTPS' : 'FTP'}`}
            </Button>
            <Tooltip
              title={form.ftp_password === '***' ? 'Re-enter the password to browse the server' : ''}
              placement="top"
            >
              <span>
                <Button onClick={() => setFtpBrowserOpen(true)} variant="outlined"
                  disabled={!form.ftp_host || !form.ftp_username || !form.ftp_password || form.ftp_password === '***'}
                  startIcon={<FolderOpenIcon sx={{ fontSize: 14 }} />}
                  sx={btnSx}>
                  Browse Server
                </Button>
              </span>
            </Tooltip>

            {ftpTestStatus && ftpTestStatus !== 'testing' && (
              <Box sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.2, borderRadius: '3px', flex: 1, minWidth: 0,
                border: ftpTestStatus.ok ? '1px solid rgba(107,143,113,0.3)' : '1px solid rgba(143,74,74,0.3)',
                bgcolor: ftpTestStatus.ok ? 'rgba(107,143,113,0.06)' : 'rgba(143,74,74,0.06)',
                '@keyframes resultIn': { from: { opacity: 0, transform: 'translateX(-6px)' }, to: { opacity: 1, transform: 'none' } },
                animation: 'resultIn 0.25s ease both',
              }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', mt: 0.35, flexShrink: 0, bgcolor: ftpTestStatus.ok ? '#6b8f71' : '#8f4a4a', boxShadow: ftpTestStatus.ok ? '0 0 6px rgba(107,143,113,0.6)' : '0 0 6px rgba(143,74,74,0.6)' }} />
                <Box>
                  {ftpTestStatus.ok ? (
                    <Box>
                      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.68rem', color: '#8fc99a', letterSpacing: '0.06em', mb: 0.25 }}>
                        Connected — {ftpTestStatus.ComputerName}
                      </Typography>
                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.61rem', color: 'text.secondary' }}>
                        {ftpTestStatus.Protocol}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.68rem', color: '#c98f8f', letterSpacing: '0.04em', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {ftpTestStatus.message}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </SectionCard>
```

- [ ] **Step 12: Add `FtpBrowser` dialog at the bottom of the JSX (just before closing `</Box></Box>` of the return)**

```jsx
      {/* FTP browser dialog */}
      <FtpBrowser
        open={ftpBrowserOpen}
        onClose={() => setFtpBrowserOpen(false)}
        ftpHost={form.ftp_host}
        ftpPort={parseInt(form.ftp_port, 10) || 21}
        ftpUsername={form.ftp_username}
        ftpPassword={livePass(form.ftp_password)}
        ftpConnectionType={form.ftp_connection_type}
        ftpPassive={form.ftp_passive}
        token={token}
      />
```

- [ ] **Step 13: Verify the app compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors. Warnings about missing optional deps are OK.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "feat(ftp): add FTP section 04, remove VPN section from Settings"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `GET /api/health` returns 200
- [ ] `POST /api/test-vpn` returns 404
- [ ] `POST /api/test-ftp` with `{ ftp_host: "ftp.dlptest.com", ftp_port: 21, ftp_username: "dlpuser", ftp_password: "rNrKYTX9g7z3RgJRmxWuGHbeu", ftp_connection_type: "ftp", ftp_passive: true }` returns 200
- [ ] `GET /api/v2/configs/` response has no `vpn_*` keys
- [ ] `GET /api/v2/configs/` response has `ftp_host`, `ftp_port`, `ftp_connection_type`
- [ ] Settings UI shows Section 04 "FTP server access" with connection type selector, passive mode toggle, and Browse Server button
- [ ] Settings UI has no "VPN Tunnel" section
- [ ] Windows section is numbered 03
- [ ] Retrieval method dropdown includes "FTP / FTPS" option
- [ ] FTP browser opens and navigates directories when credentials are filled in
- [ ] Existing SFTP and WinRM configs still save and load correctly
