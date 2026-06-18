---
name: 3d-system-analytics-design
description: Design spec for the 3D immersive System Analytics tab in the Admin panel — abstract data space aesthetic built with React Three Fiber, showing Vercel projects and deployments as an interactive 3D scene with glassmorphism overlay panels.
metadata:
  type: project
---

# 3D System Analytics — Design Spec

**Date:** 2026-06-18  
**Status:** Implemented  
**Commit:** `7c180c3`

---

## Overview

Replaces the flat table-based Vercel analytics view (tab 9 of the Admin panel) with a full immersive 3D data visualisation. Vercel projects and their deployments are rendered as glowing geometric nodes floating in a dark void, connected by light-beam edges. Below the canvas, glassmorphism KPI cards and a deployment list provide readable detail.

---

## Design Decisions

### 1 · Data source: frontend-direct Vercel API

Vercel analytics are fetched directly from `https://api.vercel.com` by the browser using `VITE_VERCEL_TOKEN` (baked into the JS bundle at build time via Vite). The previous backend proxy (`GET /v2/admin/vercel/stats`) was removed in the same commit.

**Trade-off acknowledged:** `VITE_` env vars are bundle-visible. The user accepted this exposure, with the recommendation to use a read-only Vercel token to minimise blast radius.

**Env vars required:**

| Variable | Purpose |
|---|---|
| `VITE_VERCEL_TOKEN` | Bearer token for Vercel REST API |
| `VITE_VERCEL_TEAM_ID` | (Optional) team slug for org accounts |

### 2 · Visual theme: Abstract Data Space

- **Background:** near-black void `#030308`
- **Stars:** `@react-three/drei` `<Stars>` — 2 500 distant points, slow drift
- **Grid:** dim `gridHelper` at `y = -2.8` for spatial grounding
- **Accent colour:** inherited from MUI theme `palette.primary.main` (passed as `accent` prop)
- **Lighting:** low ambient + two coloured point lights (blue-purple tones) + per-project point lights

### 3 · Node geometry

| Entity | Shape | Animation |
|---|---|---|
| Project | Wireframe icosahedron (+ glow halo) | Slow self-rotation on Y axis |
| Deployment | Solid sphere (16 × 12 segments) | Scale pulse if BUILDING/QUEUED; scale-up on hover/highlight |
| Highlight ring | Torus around sphere | Spins on Z when highlighted |

### 4 · Spatial layout

**Project nodes** are placed on a regular polygon in the XZ plane (radius 3.8 units). A single project sits at the origin.

**Deployment nodes** orbit their parent project using a Fibonacci golden-angle spiral (`goldenAngle = π(3 − √5)`) in the XZ plane with a sinusoidal Y offset (`sin(i × 1.6) × 0.75`). Radii range from 1.4 to 3.4 units from the project centre. This distributes nodes naturally without clumping regardless of count.

### 5 · Connecting edges

`<Line>` from `@react-three/drei` draws a line from each project node to each of its deployment nodes. Highlighted edges use accent colour at full opacity; others are dim `#1a2233` at 28 % opacity.

### 6 · Deployment state colours

| State | Colour |
|---|---|
| READY | `#6b8f71` (muted green) |
| ERROR | `#b45050` (muted red) |
| BUILDING / QUEUED | `#c9a84c` (amber) |
| CANCELED | `#3a3a4a` (dark grey) |

### 7 · Interaction model

- **Hover node** → tooltip appears (HTML overlay via `<Html>`) showing name, state, target, branch
- **Click node** → sets `highlighted` state in `Admin.jsx`; scrolls the deployment list to `#deploy-row-{uid}`
- **Click list row** → toggles `highlighted`; scene reacts (ring appears, line brightens, sphere enlarges)
- **Orbit** → `<OrbitControls autoRotate autoRotateSpeed={0.4} enablePan={false}>` — user can drag to orbit, scroll to zoom; auto-rotate resumes when idle

### 8 · Overlay panels (below canvas)

Four glassmorphism KPI cards (`bgcolor: rgba(5,5,18,0.78)`, `backdropFilter: blur(14px)`) showing:
- Total deployments
- Prod successes
- Prod errors
- Avg build time

A deployment list card and a projects sidebar card use the same glassmorphism treatment.

---

## Component Architecture

```
Admin.jsx (tab 9)
├── fetchVercelStats()          # frontend/src/api.js — direct Vercel REST calls
├── VercelScene3D               # frontend/src/components/VercelScene3D.jsx
│   ├── <Canvas>                # R3F entry point; camera at [0, 5, 12], fov 55
│   └── SceneInner              # useFrame-capable child
│       ├── Stars, gridHelper, OrbitControls
│       ├── ProjectNode[]       # icosahedron + glow + pointLight
│       │   └── ProjectLabel[]  # Html label above each node
│       └── DeployNode[]        # sphere + torus ring + Html tooltip
│           └── <Line>          # connecting edge to parent project
├── KPI cards (MUI Box, glassmorphism)
├── Deployment list (scrollable, highlight-aware rows)
└── Projects sidebar
```

### R3F architecture rule

`useFrame` can only be called inside a `<Canvas>` descendant. The public `VercelScene3D` component is therefore split: the exported wrapper owns `<Canvas>`, while `SceneInner` holds all Three.js hooks and scene content. This pattern is standard R3F.

---

## Dependencies Added

```
@react-three/fiber   ^9.6.1
@react-three/drei    ^10.7.7
three                ^0.184.0
```

Installed with `--legacy-peer-deps` due to React 19 peer dep constraints in drei's package manifest.

**Bundle impact:** Three.js adds ~300 KB gzipped to the Admin chunk. Accepted — no lazy loading was added as the Admin panel is already gated.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/VercelScene3D.jsx` | New — ~270 lines, full 3D scene |
| `frontend/src/pages/Admin.jsx` | Tab 9 replaced; `VercelScene3D` integrated |
| `frontend/src/api.js` | `getVercelStats` → `fetchVercelStats` (direct browser fetch) |
| `frontend/.env.example` | Added `VITE_VERCEL_TOKEN` / `VITE_VERCEL_TEAM_ID` docs |
| `backend/config.py` | Removed `vercel_token` and `vercel_team_id` settings fields |
| `backend/routers/admin.py` | Removed `_vercel_headers`, `_vercel_params`, `get_vercel_stats` route |
