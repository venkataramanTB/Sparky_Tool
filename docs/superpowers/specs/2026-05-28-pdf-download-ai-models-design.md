# PDF Download + AI Models Admin Table

**Date:** 2026-05-28

## Feature 1 — PDF Download (AnalyzeDashboard)

### What
A "Download PDF" button appears in `AnalyzeDashboard.jsx` once chart results are loaded. It captures the full dashboard as a PDF and triggers a browser download.

### How
- Libraries: `html2canvas` + `jsPDF` (frontend only, no backend changes)
- PDF structure: filename/metadata header, Gemini summary paragraph, all chart cards rendered as images in a 2-column grid
- Each chart card rendered via `html2canvas` with `scale: 2` for retina quality
- Page breaks inserted automatically when cards overflow a page

---

## Feature 2 — AI Models Admin Table

### Database
New table `ai_models`:
- `id` SERIAL PRIMARY KEY
- `name` VARCHAR(255) — display name
- `provider` VARCHAR(50) — `gemini | openai | anthropic | grok | generic`
- `model_id` VARCHAR(255) — e.g. `gemini-2.0-flash`, `gpt-4o`, `claude-sonnet-4-6`
- `api_key_enc` TEXT — AES-encrypted same pattern as `sftp_password_enc`
- `base_url` TEXT — for generic/OpenAI-compatible providers
- `is_default` BOOLEAN — exactly one row should be true at a time
- `is_active` BOOLEAN — toggle without deleting
- `created_at`, `updated_at` TIMESTAMPTZ

### Backend
- New SQLAlchemy model `AiModel` in `models.py`
- New admin-only endpoints in `routers/admin.py`:
  - `GET  /api/v2/admin/ai-models` — list all
  - `POST /api/v2/admin/ai-models` — create
  - `PUT  /api/v2/admin/ai-models/{id}` — update
  - `DELETE /api/v2/admin/ai-models/{id}` — delete
  - `POST /api/v2/admin/ai-models/{id}/set-default` — atomically set as default
- `routers/insights.py` `analyze_file` queries the default active model from DB instead of `GEMINI_API_KEY` env var; falls back to env var if no DB model configured
- Provider routing: switch on `provider` to use correct SDK (google-generativeai, openai, anthropic)

### Frontend
- New Tab 4 "AI Models" in `Admin.jsx`
- DataGrid: name, provider chip (colour-coded), model_id, masked API key, default badge, active toggle, edit/delete actions
- "Add Model" button → dialog with: name, provider dropdown, model_id, api_key, base_url (shown only for generic)
- Set-as-default button per row
- Audit events logged for create/update/delete

### Security
- API keys never returned in GET responses (masked as `••••••••`)
- Encryption reuses existing `encrypt.py` utilities
- All endpoints require `require_admin` dependency
