# FTP Service + VPN Removal — Design Spec
**Date:** 2026-06-01  
**Status:** Approved

## Overview

Two coordinated changes:
1. **Remove VPN** from every layer (UI, backend, database).
2. **Add FTP/FTPS** as a first-class retrieval method with a full file browser, mirroring the existing Windows Server (WinRM/SMB/SSH) pattern exactly.

---

## Architecture

```
Settings UI  →  api.js  →  FastAPI route  →  ftp_client.py (ftplib stdlib)
```

FTP slots into the existing retrieval-method system as value `ftp`. The `ftp_connection_type` field (`ftp` | `ftps`) drives TLS and default port. All run-dispatch, file-browser, and test-connection hooks follow the same patterns used by SMB/WinRM.

---

## VPN Removal Scope

### Files deleted
- `backend/vpn_client.py`

### `backend/models.py`
Remove 7 columns from `UserConfig`:
- `vpn_enabled`, `vpn_type`, `vpn_host`, `vpn_port`, `vpn_username`, `vpn_password_enc`, `vpn_extra`

### `backend/database.py`
- Remove the 7 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS vpn_*` migration statements.
- Add 7 `ALTER TABLE user_configs DROP COLUMN IF EXISTS vpn_*` statements so existing production databases are cleaned up on next startup.

### `backend/main.py`
- Remove `import vpn_client` (and `from vpn_client import ...`).
- Remove `POST /api/test-vpn` endpoint.
- Remove VPN pre-connect block and VPN disconnect in `_run_one_engine()` (the `if config.vpn_enabled` guard and the `vpn_disconnect` call in the `finally` block).

### `backend/routers/configs.py`
- Remove all `vpn_*` fields from config create, update, and read serialisation.

### `frontend/src/pages/Settings.jsx`
- Remove `VPN_TYPES` constant.
- Remove all `vpn_*` keys from `EMPTY` form state.
- Remove `VPN_KEYS` array and its usage in the `set()` handler.
- Remove `showVpnPass` and `vpnTestStatus` state.
- Remove Section 03 "VPN Tunnel" `SectionCard` and all its JSX.
- Remove `vpnTestStatus` result rendering.
- Remove `handleVpnTest` function.
- Renumber old Section 04 "Windows Server" → Section 03.
- Remove `VpnLockIcon` import.

### `frontend/src/api.js`
- Remove `testVpn` export.

---

## FTP — Backend

### New file: `backend/ftp_client.py`

Uses Python stdlib `ftplib` only — no new dependencies.

**Public interface:**

```python
def download_csv(remote_path: str, settings) -> bytes
def test_connection(host, port, username, password, tls, passive) -> dict
def list_directory(host, port, username, password, path, tls, passive) -> list[dict]
def read_file(host, port, username, password, path, tls, passive, max_kb) -> str
```

- `ftp` → `ftplib.FTP`, port default 21.
- `ftps` → `ftplib.FTP_TLS` (explicit TLS, `prot_p()` after login), port default 21.
- Passive mode controlled by `passive` bool (default `True`).
- `list_directory` returns list of `{name, type, size, modified}` dicts (same shape as SMB/WinRM).
- `read_file` reads up to `max_kb` kilobytes and returns text.

### `backend/models.py` — new columns

```python
ftp_host            = Column(String,  default='')
ftp_port            = Column(Integer, default=21)
ftp_username        = Column(String,  default='')
ftp_password_enc    = Column(Text,    default='')
ftp_remote_path     = Column(Text,    default='')
ftp_connection_type = Column(String,  default='ftp')   # 'ftp' | 'ftps'
ftp_passive         = Column(Boolean, default=True)
```

### `backend/database.py` — new migrations

Add 7 `ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS ftp_*` statements alongside the existing sftp_*/win_* ones.

### `backend/main.py` — new endpoints

```
POST /api/test-ftp        # test_connection wrapper
POST /api/ftp-browse      # list_directory wrapper
POST /api/ftp-read-file   # read_file wrapper
```

Request bodies follow the same shape as `/api/test-windows`, `/api/win-browse`, `/api/win-read-file`.

Add `ftp` to the `retrieval_method` dispatch table in `_run_one_engine()`.

### `backend/routers/configs.py`

Add `ftp_*` fields to config create, update, and read serialisation. Password field uses the same `encrypt` / `"***"` sentinel pattern as all other password fields.

---

## FTP — Frontend

### `frontend/src/pages/Settings.jsx`

**`EMPTY` form state additions:**
```js
ftp_host: '', ftp_port: '21', ftp_username: '',
ftp_password: '', ftp_remote_path: '',
ftp_connection_type: 'ftp', ftp_passive: true,
```

**`FTP_CONNECTION_TYPES` constant:**
```js
[
  { value: 'ftp',  label: 'Plain FTP (port 21)',          defaultPort: '21'  },
  { value: 'ftps', label: 'FTPS — Explicit TLS (port 21)', defaultPort: '21'  },
]
```

**`FTP_DEFAULT_PORTS`:** `{ ftp: '21', ftps: '21' }`

**`handleFtpConnectionTypeChange`:** auto-updates `ftp_port` when type changes (same pattern as `handleConnectionTypeChange` for Windows).

**`FTP_KEYS` array** used in `set()` to reset `ftpTestStatus`.

**New state:** `ftpTestStatus`, `showFtpPass`, `ftpBrowserOpen`.

**Section layout after changes:**
| # | Title | Notes |
|---|-------|-------|
| 01 | PeopleSoft | Unchanged |
| 02 | Data Retrieval | `ftp` added to retrieval_method options |
| 03 | Windows Server | Renumbered from 04 |
| 04 | FTP Server | New — mirrors Windows section |

**Section 04 "FTP Server" fields:**
- `ftp_connection_type` select (Plain FTP / FTPS)
- `ftp_host` text field
- `ftp_port` number field (auto-updated on type change)
- `ftp_username` text field
- `ftp_password` password field (masked, with show/hide toggle)
- `ftp_passive` switch (Passive mode)
- `ftp_remote_path` text field
- **Test Connection** button → `handleFtpTest()` → `testFtp()`
- **Browse Files** button → opens `FtpBrowser` dialog

**`sec04Complete`:** `!!(form.ftp_host && form.ftp_username)`

### New file: `frontend/src/components/FtpBrowser.jsx`

Mirrors `WinServerBrowser.jsx` exactly:
- Directory navigation breadcrumb
- File/folder listing with icons
- File preview panel (text content)
- Uses `ftpBrowse` / `ftpReadFile` from `api.js`
- Props: `open`, `onClose`, `host`, `port`, `username`, `password`, `tls`, `passive`, `token`

### `frontend/src/api.js`

```js
// Remove
export const testVpn = ...

// Add
export const testFtp       = (data, token) => client.post('/test-ftp',       data, { headers: auth(token) })
export const ftpBrowse     = (data, token) => client.post('/ftp-browse',     data, { headers: auth(token) })
export const ftpReadFile   = (data, token) => client.post('/ftp-read-file',  data, { headers: auth(token) })
```

---

## Testing

- `POST /api/test-ftp` verifiable by pointing at any public anonymous FTP server.
- File browser integration tested by navigating and previewing a file.
- Confirm existing SFTP/WinRM runs still work (no regression).
- Confirm VPN fields are absent from config API responses.
- Confirm `vpn_*` columns are dropped from the database on next startup.

---

## Non-Goals

- FTPS implicit mode (port 990) — explicit TLS on port 21 covers modern servers; implicit is legacy.
- FTP active mode as default — passive is the modern default and works through NAT/firewalls.
- Alembic migration tracking — the codebase uses idempotent startup migrations throughout.
