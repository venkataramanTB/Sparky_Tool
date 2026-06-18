# Sparky Tool

Enterprise-grade PeopleSoft automation, Windows server orchestration, VPN-aware remote retrieval, and intelligent configuration management — built with React, FastAPI, and modern infrastructure tooling.

---

## Overview

Sparky Tool is a modern enterprise utility platform designed to simplify:

- PeopleSoft process triggering
- Windows server connectivity
- Remote file retrieval
- VPN-aware infrastructure access
- SFTP / SMB / WinRM / SSH operations
- Configuration profile management
- Automated validation and orchestration

The platform acts as a bridge between legacy enterprise ecosystems and modern automation workflows.

---

# Features

## PeopleSoft Integration

- Trigger PeopleSoft APIs
- Poll status endpoints automatically
- Support for:
  - Basic Authentication
  - Bearer Token Authentication
- Configurable process names
- Full API response viewer

---

## Multi-Protocol Retrieval Engine

Supports:

| Method | Description |
|---|---|
| SFTP | Secure Linux/Unix file transfer |
| SCP | SSH-based file retrieval |
| WinRM | PowerShell remote execution |
| SMB | Native Windows file shares |
| SSH | OpenSSH access to Windows |

---

## Windows Server Management

- WinRM connectivity testing
- SMB share validation
- SSH connectivity
- Remote file browsing
- Server path navigation
- Credential validation
- SSL support for WinRM

---

## VPN Support

Supports enterprise VPN workflows:

- Fortinet SSL VPN
- OpenConnect / AnyConnect
- OpenVPN
- WireGuard
- SSH Tunnels

Features include:

- Dynamic VPN profile configuration
- Secure credential handling
- Fingerprint validation
- SOCKS5 tunnel support

---

## Smart UI System

- Elegant enterprise-themed interface
- Dynamic section completion indicators
- Password masking & visibility toggles
- Real-time validation
- Rich error handling
- Animated status indicators
- Sticky save actions

---

# Technology Stack

## Frontend

- React
- Material UI (MUI)
- Context API
- Axios
- React Three Fiber + Drei + Three.js (3D visualisations)

## Backend

- FastAPI
- Python
- Pydantic
- WinRM libraries
- Paramiko

## Infrastructure

- Windows Server
- Linux
- SSH
- SMB
- VPN tunneling

---

# Project Structure

```bash
src/
├── api/
├── components/
│   ├── WinServerBrowser.jsx
│   └── ...
├── pages/
│   ├── Settings.jsx
│   └── ...
├── AuthContext.jsx
├── ThemeContext.jsx
└── ...
```

---

## Admin Panel

The Admin panel is gated to admin-role users via Clerk and exposes the following tabs:

| Tab | Feature |
|---|---|
| 1–8 | User management, configuration, logs, etc. |
| 9 | **System Analytics** — 3D Vercel deployment visualisation |

### System Analytics (Tab 9)

An immersive 3D data-space scene built with **React Three Fiber**. Vercel projects appear as glowing wireframe icosahedra; each deployment orbits its project as a coloured sphere. Connecting light-beam edges update dynamically. Clicking a node highlights it and scrolls the deployment detail list below the canvas.

**Layout:** 3D hero canvas (480 px) + glassmorphism KPI strip + deployment list + projects sidebar.

**State colours:** green = READY, red = ERROR, amber = BUILDING/QUEUED, grey = CANCELED.

#### Environment variables required

Add to `frontend/.env` (see `frontend/.env.example`):

```env
VITE_VERCEL_TOKEN=       # Vercel personal/team token (read-only scope recommended)
VITE_VERCEL_TEAM_ID=     # Only needed for Vercel team/org accounts
```

> **Note:** `VITE_` variables are baked into the JS bundle at build time and are visible to anyone who downloads the page. Use a scoped, read-only token.

#### Dependencies

```bash
npm install three @react-three/fiber @react-three/drei --legacy-peer-deps
```