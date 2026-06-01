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
