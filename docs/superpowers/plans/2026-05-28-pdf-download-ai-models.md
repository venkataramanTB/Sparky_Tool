# PDF Download + AI Models Admin Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PDF export button to the chart analyser dashboard, and add an admin-only AI Models table that stores encrypted API keys for Gemini, OpenAI, Anthropic, Grok, and generic providers — replacing the hard-coded `GEMINI_API_KEY` env-var lookup.

**Architecture:** The AI models table (`ai_models`) lives in Postgres and is managed via new admin-only CRUD endpoints. The `analyze_file` endpoint queries the default active model from the DB and routes to the correct provider SDK. The PDF download is pure frontend: `html2canvas` captures the chart container to a canvas; `jsPDF` slices it into A4 pages.

**Tech Stack:** FastAPI · SQLAlchemy · Fernet encryption (`encrypt.py`) · React 18 · MUI v5 · Recharts · `html2canvas` · `jspdf` · `openai` SDK (also covers Grok) · `anthropic` SDK

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/models.py` | Modify | Add `AiModel` SQLAlchemy model |
| `backend/database.py` | Modify | Add `_migrate_ai_models` for runtime column safety |
| `backend/routers/admin.py` | Modify | Add 5 CRUD endpoints for ai_models |
| `backend/routers/insights.py` | Modify | `analyze_file` reads default model from DB, routes to correct SDK |
| `backend/requirements.txt` | Modify | Add `openai>=1.35.0`, `anthropic>=0.28.0` |
| `frontend/package.json` | Modify | Add `html2canvas`, `jspdf` |
| `frontend/src/api.js` | Modify | Fix duplicate `analyzeFile`; add 5 AI model admin API functions |
| `frontend/src/pages/AnalyzeDashboard.jsx` | Modify | Add PDF download button + capture logic |
| `frontend/src/pages/Admin.jsx` | Modify | Add Tab 4 "AI Models" with DataGrid + Add/Edit/Delete dialogs |

---

## Task 1: Add `AiModel` to the backend models

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Add the model class**

Open `backend/models.py` and append this class after the `AuditEvent` class at line 93:

```python
class AiModel(Base):
    __tablename__ = "ai_models"
    __table_args__ = (Index("idx_ai_models_provider", "provider"),)
    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(255), nullable=False)
    provider    = Column(String(50), nullable=False)   # gemini|openai|anthropic|grok|generic
    model_id    = Column(String(255), nullable=False)  # e.g. gemini-2.0-flash
    api_key_enc = Column(Text, default="")
    base_url    = Column(Text, default="")             # for generic/OpenAI-compatible
    is_default  = Column(Boolean, default=False)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(TIMESTAMP(timezone=True), default=_now)
    updated_at  = Column(TIMESTAMP(timezone=True), default=_now)
```

- [ ] **Step 2: Verify the import list already covers all types used**

The top of `models.py` already imports `Column, String, Integer, Boolean, Text, TIMESTAMP, JSON, ForeignKey, Index` — `AiModel` uses only `Column, String, Integer, Boolean, Text, TIMESTAMP, Index` which are all present. No import changes needed.

- [ ] **Step 3: Commit**

```
git add backend/models.py
git commit -m "feat: add AiModel SQLAlchemy model for AI provider credentials"
```

---

## Task 2: Add backend Python dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add openai and anthropic**

Append these two lines to `backend/requirements.txt`:

```
openai>=1.35.0
anthropic>=0.28.0
```

- [ ] **Step 2: Install locally (if running backend locally)**

```
cd backend
pip install openai anthropic
```

Expected: Both packages install without conflict.

- [ ] **Step 3: Commit**

```
git add backend/requirements.txt
git commit -m "chore: add openai and anthropic SDK dependencies"
```

---

## Task 3: Add admin CRUD endpoints for AI models

**Files:**
- Modify: `backend/routers/admin.py`

- [ ] **Step 1: Add the import for AiModel at the top of admin.py**

Find the existing import line:
```python
from models import User, RunLog, AuditEvent
```
Replace it with:
```python
from models import User, RunLog, AuditEvent, AiModel
```

Also add to the existing imports block:
```python
from datetime import datetime, timezone
from encrypt import encrypt, decrypt
```

(Check: `datetime` is already imported — only add `encrypt` if not present. The `encrypt` import is new.)

- [ ] **Step 2: Add the Pydantic schemas for AI models (after the existing `InviteUserPayload` class)**

Add these after line ~158 (after `InviteUserPayload`):

```python
# ── AI model payloads ─────────────────────────────────────────────────────────

VALID_PROVIDERS = {"gemini", "openai", "anthropic", "grok", "generic"}


class AiModelCreatePayload(BaseModel):
    name:       str
    provider:   str
    model_id:   str
    api_key:    str = ""
    base_url:   str = ""
    is_default: bool = False
    is_active:  bool = True


class AiModelUpdatePayload(BaseModel):
    name:       str | None = None
    provider:   str | None = None
    model_id:   str | None = None
    api_key:    str | None = None   # if None, key is unchanged
    base_url:   str | None = None
    is_default: bool | None = None
    is_active:  bool | None = None
```

- [ ] **Step 3: Add the helper serialiser (after `_serialize_user`)**

```python
def _serialize_model(m: AiModel) -> dict:
    return {
        "id":         m.id,
        "name":       m.name,
        "provider":   m.provider,
        "model_id":   m.model_id,
        "api_key":    "••••••••" if m.api_key_enc else "",
        "base_url":   m.base_url or "",
        "is_default": m.is_default,
        "is_active":  m.is_active,
        "created_at": m.created_at,
        "updated_at": m.updated_at,
    }
```

- [ ] **Step 4: Add the 5 CRUD endpoints (append at the end of admin.py)**

```python
# ── AI Models ─────────────────────────────────────────────────────────────────

@router.get("/ai-models")
def list_ai_models(
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    models = db.query(AiModel).order_by(AiModel.created_at.asc()).all()
    return {"items": [_serialize_model(m) for m in models]}


@router.post("/ai-models", status_code=201)
def create_ai_model(
    body:  AiModelCreatePayload,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    if body.provider not in VALID_PROVIDERS:
        raise HTTPException(400, f"provider must be one of {sorted(VALID_PROVIDERS)}")
    if not body.name.strip():
        raise HTTPException(400, "name is required")
    if not body.model_id.strip():
        raise HTTPException(400, "model_id is required")

    now = datetime.now(timezone.utc)

    if body.is_default:
        db.query(AiModel).update({"is_default": False})

    m = AiModel(
        name=body.name.strip(),
        provider=body.provider,
        model_id=body.model_id.strip(),
        api_key_enc=encrypt(body.api_key) if body.api_key else "",
        base_url=body.base_url.strip(),
        is_default=body.is_default,
        is_active=body.is_active,
        created_at=now,
        updated_at=now,
    )
    db.add(m)
    db.add(AuditEvent(user_id=admin.id, event_type="ai_model_created",
                      detail={"name": m.name, "provider": m.provider}))
    db.commit()
    db.refresh(m)
    log.info("AI model created  id=%d  name=%s  by=%s", m.id, m.name, admin.id[:8])
    return _serialize_model(m)


@router.put("/ai-models/{model_id_pk}")
def update_ai_model(
    model_id_pk: int,
    body:  AiModelUpdatePayload,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    m = db.query(AiModel).filter(AiModel.id == model_id_pk).first()
    if not m:
        raise HTTPException(404, "AI model not found")

    if body.provider is not None and body.provider not in VALID_PROVIDERS:
        raise HTTPException(400, f"provider must be one of {sorted(VALID_PROVIDERS)}")

    if body.name       is not None: m.name       = body.name.strip()
    if body.provider   is not None: m.provider   = body.provider
    if body.model_id   is not None: m.model_id   = body.model_id.strip()
    if body.base_url   is not None: m.base_url   = body.base_url.strip()
    if body.is_active  is not None: m.is_active  = body.is_active
    if body.api_key    is not None: m.api_key_enc = encrypt(body.api_key) if body.api_key else ""

    if body.is_default is True:
        db.query(AiModel).filter(AiModel.id != model_id_pk).update({"is_default": False})
        m.is_default = True
    elif body.is_default is False:
        m.is_default = False

    m.updated_at = datetime.now(timezone.utc)
    db.add(AuditEvent(user_id=admin.id, event_type="ai_model_updated",
                      detail={"id": model_id_pk, "name": m.name}))
    db.commit()
    log.info("AI model updated  id=%d  by=%s", model_id_pk, admin.id[:8])
    return _serialize_model(m)


@router.delete("/ai-models/{model_id_pk}", status_code=204)
def delete_ai_model(
    model_id_pk: int,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    m = db.query(AiModel).filter(AiModel.id == model_id_pk).first()
    if not m:
        raise HTTPException(404, "AI model not found")
    name = m.name
    db.delete(m)
    db.add(AuditEvent(user_id=admin.id, event_type="ai_model_deleted",
                      detail={"id": model_id_pk, "name": name}))
    db.commit()
    log.info("AI model deleted  id=%d  name=%s  by=%s", model_id_pk, name, admin.id[:8])


@router.post("/ai-models/{model_id_pk}/set-default")
def set_default_ai_model(
    model_id_pk: int,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    m = db.query(AiModel).filter(AiModel.id == model_id_pk).first()
    if not m:
        raise HTTPException(404, "AI model not found")
    db.query(AiModel).update({"is_default": False})
    m.is_default = True
    m.updated_at = datetime.now(timezone.utc)
    db.add(AuditEvent(user_id=admin.id, event_type="ai_model_set_default",
                      detail={"id": model_id_pk, "name": m.name}))
    db.commit()
    log.info("Default AI model set  id=%d  by=%s", model_id_pk, admin.id[:8])
    return _serialize_model(m)
```

- [ ] **Step 5: Commit**

```
git add backend/routers/admin.py
git commit -m "feat: add admin CRUD endpoints for AI model credentials"
```

---

## Task 4: Wire `analyze_file` to read from the DB model

**Files:**
- Modify: `backend/routers/insights.py`

- [ ] **Step 1: Add new imports at the top of insights.py**

Find the existing import block (lines 1-18). Add after the existing imports:

```python
from openai import OpenAI
import anthropic as _anthropic_sdk
from models import AiModel
```

(The `get_db` import is already present; `Session` is already imported.)

- [ ] **Step 2: Replace the provider routing in `analyze_file`**

Find the current Gemini call block in `analyze_file` (starts at `genai.configure(api_key=api_key)`). Replace **from the `api_key = os.environ.get(...)` line through the end of the try/except that calls `_extract_json`** with:

```python
    # ── resolve the active AI model ──────────────────────────────────────────
    db_model = db.query(AiModel).filter(
        AiModel.is_default == True, AiModel.is_active == True  # noqa: E712
    ).first()

    if db_model:
        provider  = db_model.provider
        model_id  = db_model.model_id
        api_key   = decrypt(db_model.api_key_enc) if db_model.api_key_enc else ""
        base_url  = db_model.base_url or ""
    else:
        # fall back to environment variable (backwards-compat)
        provider  = "gemini"
        model_id  = "gemini-1.5-flash"
        api_key   = os.environ.get("GEMINI_API_KEY", "").strip()
        base_url  = ""

    if not api_key:
        raise HTTPException(503, "No AI model API key configured. Add one in Admin → AI Models.")

    # ── call the provider ────────────────────────────────────────────────────
    prompt = _CHART_PROMPT.format(
        profile=json.dumps(profile, indent=2, default=str),
        colors=", ".join(_GEMINI_COLORS),
    )

    try:
        if provider == "gemini":
            genai.configure(api_key=api_key)
            gm = genai.GenerativeModel(
                model_name=model_id,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )
            response = gm.generate_content(prompt)
            chart_spec = _extract_json(response.text)

        elif provider in ("openai", "grok", "generic"):
            client_kwargs = {"api_key": api_key}
            if base_url:
                client_kwargs["base_url"] = base_url
            elif provider == "grok":
                client_kwargs["base_url"] = "https://api.x.ai/v1"
            oai = OpenAI(**client_kwargs)
            resp = oai.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            chart_spec = json.loads(resp.choices[0].message.content)

        elif provider == "anthropic":
            ant = _anthropic_sdk.Anthropic(api_key=api_key)
            msg = ant.messages.create(
                model=model_id,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text
            chart_spec = _extract_json(raw)

        else:
            raise HTTPException(400, f"Unknown provider: {provider}")

    except HTTPException:
        raise
    except json.JSONDecodeError as exc:
        log.error("AI provider returned non-JSON for provider=%s", provider)
        raise HTTPException(502, f"AI provider returned invalid JSON: {exc}") from exc
    except Exception as exc:
        log.error("AI provider call failed provider=%s: %s", provider, exc)
        raise HTTPException(502, f"AI provider error: {exc}") from exc
```

- [ ] **Step 3: Add `db: Session = Depends(get_db)` to the `analyze_file` signature**

Find:
```python
async def analyze_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
```
Replace with:
```python
async def analyze_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db),
):
```

- [ ] **Step 4: Commit**

```
git add backend/routers/insights.py
git commit -m "feat: analyze_file reads AI model from DB, supports Gemini/OpenAI/Anthropic/Grok"
```

---

## Task 5: Add AI model API calls to frontend api.js

**Files:**
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Fix the duplicate `analyzeFile` export**

`api.js` currently has two `export const analyzeFile` declarations (lines ~85 and ~98). Remove lines 85–94 (the first declaration that uses `transformRequest`) and keep only the second one (which passes `auth(token)`).

The correct single declaration to keep is:
```javascript
export const analyzeFile = (file, token) => {
  const form = new FormData()
  form.append('file', file)
  return client.post('/v2/insights/analyze-file', form, {
    headers: { ...auth(token), 'Content-Type': 'multipart/form-data' },
  })
}
```

- [ ] **Step 2: Add AI model admin API calls at the end of api.js**

```javascript
// AI Models admin (v2)
export const listAiModels      = (token)                => client.get('/v2/admin/ai-models',                    { headers: auth(token) })
export const createAiModel     = (payload, token)       => client.post('/v2/admin/ai-models',         payload,  { headers: auth(token) })
export const updateAiModel     = (id, payload, token)   => client.put(`/v2/admin/ai-models/${id}`,    payload,  { headers: auth(token) })
export const deleteAiModel     = (id, token)            => client.delete(`/v2/admin/ai-models/${id}`,           { headers: auth(token) })
export const setDefaultAiModel = (id, token)            => client.post(`/v2/admin/ai-models/${id}/set-default`, null, { headers: auth(token) })
```

- [ ] **Step 3: Commit**

```
git add frontend/src/api.js
git commit -m "fix: remove duplicate analyzeFile export; add AI model admin API calls"
```

---

## Task 6: Install frontend PDF dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install html2canvas and jspdf**

```
cd frontend
npm install html2canvas jspdf
```

Expected output: both packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Commit**

```
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add html2canvas and jspdf for PDF export"
```

---

## Task 7: Add PDF download to AnalyzeDashboard

**Files:**
- Modify: `frontend/src/pages/AnalyzeDashboard.jsx`

- [ ] **Step 1: Add imports at the top of AnalyzeDashboard.jsx**

Find:
```javascript
import UploadFileIcon  from '@mui/icons-material/UploadFile'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TableChartIcon  from '@mui/icons-material/TableChart'
import { analyzeFile } from '../api'
```
Replace with:
```javascript
import UploadFileIcon    from '@mui/icons-material/UploadFile'
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome'
import TableChartIcon    from '@mui/icons-material/TableChart'
import PictureAsPdfIcon  from '@mui/icons-material/PictureAsPdf'
import { analyzeFile }   from '../api'
```

- [ ] **Step 2: Add a `chartsRef` and `pdfLoading` state to `AnalyzeDashboard`**

Find:
```javascript
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [result,   setResult]   = useState(null)
  const [filename, setFilename] = useState('')
```
Replace with:
```javascript
  const chartsRef = useRef(null)
  const [loading,     setLoading]     = useState(false)
  const [pdfLoading,  setPdfLoading]  = useState(false)
  const [error,       setError]       = useState(null)
  const [result,      setResult]      = useState(null)
  const [filename,    setFilename]    = useState('')
```

- [ ] **Step 3: Add the `downloadPdf` function inside `AnalyzeDashboard` (after `handleFile`)**

```javascript
  const downloadPdf = useCallback(async () => {
    if (!chartsRef.current || !result) return
    setPdfLoading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF }                = await import('jspdf')

      const el      = chartsRef.current
      const canvas  = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#121212',
        logging: false,
      })

      const imgData   = canvas.toDataURL('image/png')
      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW     = pdf.internal.pageSize.getWidth()
      const pageH     = pdf.internal.pageSize.getHeight()
      const margin    = 32
      const printW    = pageW - margin * 2
      const imgH      = (canvas.height / canvas.width) * printW
      const totalPages = Math.ceil(imgH / pageH)

      let yOffset = 0
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage()
        pdf.addImage(
          imgData, 'PNG',
          margin,
          margin - yOffset,
          printW,
          imgH,
        )
        yOffset += pageH - margin
      }

      const safeName = (filename || 'report').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_')
      pdf.save(`${safeName}_charts.pdf`)
    } catch (err) {
      console.error('PDF generation failed', err)
    } finally {
      setPdfLoading(false)
    }
  }, [result, filename])
```

- [ ] **Step 4: Add the `ref` to the results container and the download button**

Find the `{result && (` block and its `<Box>` wrapper. Replace the opening of that block:

```javascript
      {result && (
        <Box>
          <SummaryBar result={result} filename={filename} />
```

With:

```javascript
      {result && (
        <Box>
          {/* PDF download toolbar */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={downloadPdf}
              disabled={pdfLoading}
              startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderColor: `${accent}44`, color: accent,
                fontFamily: '"Raleway", sans-serif', fontSize: '0.68rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                '&:hover': { borderColor: accent, bgcolor: `${accent}08` },
              }}
            >
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </Button>
          </Box>

          {/* Captured area */}
          <Box ref={chartsRef}>
            <SummaryBar result={result} filename={filename} />
```

Then find the closing `</Box>` that wraps the `<Grid container>` and the "upload another" button, and close the new `chartsRef` div before the "upload another" section:

Find:
```javascript
          {/* upload another */}
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
```
Replace with:
```javascript
          </Box>{/* end chartsRef */}

          {/* upload another */}
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
```

- [ ] **Step 5: Commit**

```
git add frontend/src/pages/AnalyzeDashboard.jsx
git commit -m "feat: add PDF download button to AI chart analyser dashboard"
```

---

## Task 8: Add AI Models tab to Admin.jsx

**Files:**
- Modify: `frontend/src/pages/Admin.jsx`

- [ ] **Step 1: Add new imports to the Admin.jsx import block**

Find:
```javascript
import {
  listAdminStats, listAdminLogs, listAdminUsers, listAdminRuns,
  inviteAdminUser, setUserRole, updateAdminUser, deleteAdminUser,
} from '../api'
```
Replace with:
```javascript
import {
  listAdminStats, listAdminLogs, listAdminUsers, listAdminRuns,
  inviteAdminUser, setUserRole, updateAdminUser, deleteAdminUser,
  listAiModels, createAiModel, updateAiModel, deleteAiModel, setDefaultAiModel,
} from '../api'
```

Also add these icon imports to the MUI icons block:
```javascript
import SmartToyIcon    from '@mui/icons-material/SmartToy'
import AddIcon         from '@mui/icons-material/Add'
import KeyIcon         from '@mui/icons-material/Key'
import StarIcon        from '@mui/icons-material/Star'
import StarOutlineIcon from '@mui/icons-material/StarOutline'
import ToggleOnIcon    from '@mui/icons-material/ToggleOn'
import ToggleOffIcon   from '@mui/icons-material/ToggleOff'
import LinkIcon        from '@mui/icons-material/Link'
```

- [ ] **Step 2: Add state for AI models inside the `Admin` component**

Find:
```javascript
  // per-row role loading
  const [roleLoadingId, setRoleLoadingId] = useState(null)
```
Add before it:
```javascript
  const [aiModels,      setAiModels]      = useState([])
  const [aiModelDialog, setAiModelDialog] = useState(null) // null | 'add' | model-object
  const [aiModelForm,   setAiModelForm]   = useState({
    name: '', provider: 'gemini', model_id: '', api_key: '', base_url: '', is_default: false, is_active: true,
  })
  const [aiModelLoading, setAiModelLoading] = useState(false)
  const [deleteAiDialog, setDeleteAiDialog] = useState(null) // null | { id, name }
```

- [ ] **Step 3: Load AI models in the `load` callback**

Find:
```javascript
    Promise.all([
      listAdminStats(token),
      listAdminLogs(token,  { limit: 200 }),
      listAdminUsers(token, { limit: 200 }),
      listAdminRuns(token,  { limit: 200 }),
    ])
      .then(([statsRes, logsRes, usersRes, runsRes]) => {
        setStats(statsRes.data)
        setLogs(logsRes.data.items ?? [])
        setUsers(usersRes.data.items ?? [])
        setRuns(runsRes.data.items ?? [])
        setError(null)
      })
```
Replace with:
```javascript
    Promise.all([
      listAdminStats(token),
      listAdminLogs(token,  { limit: 200 }),
      listAdminUsers(token, { limit: 200 }),
      listAdminRuns(token,  { limit: 200 }),
      listAiModels(token),
    ])
      .then(([statsRes, logsRes, usersRes, runsRes, aiRes]) => {
        setStats(statsRes.data)
        setLogs(logsRes.data.items ?? [])
        setUsers(usersRes.data.items ?? [])
        setRuns(runsRes.data.items ?? [])
        setAiModels(aiRes.data.items ?? [])
        setError(null)
      })
```

- [ ] **Step 4: Add the AI model action handlers inside the `Admin` component (before the return)**

Add these after `handleInvited`:

```javascript
  // ── AI model actions ──────────────────────────────────────────────────────

  const openAddModel = () => {
    setAiModelForm({ name: '', provider: 'gemini', model_id: '', api_key: '', base_url: '', is_default: false, is_active: true })
    setAiModelDialog('add')
  }

  const openEditModel = (m) => {
    setAiModelForm({ name: m.name, provider: m.provider, model_id: m.model_id, api_key: '', base_url: m.base_url, is_default: m.is_default, is_active: m.is_active })
    setAiModelDialog(m)
  }

  const handleSaveAiModel = async () => {
    setAiModelLoading(true)
    try {
      if (aiModelDialog === 'add') {
        const res = await createAiModel(aiModelForm, token)
        setAiModels((prev) => [...prev, res.data])
      } else {
        const payload = { ...aiModelForm }
        if (!payload.api_key) delete payload.api_key
        const res = await updateAiModel(aiModelDialog.id, payload, token)
        setAiModels((prev) => prev.map((m) => m.id === res.data.id ? res.data : m))
      }
      setAiModelDialog(null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save model')
    } finally {
      setAiModelLoading(false)
    }
  }

  const handleDeleteAiModel = async () => {
    if (!deleteAiDialog) return
    setAiModelLoading(true)
    try {
      await deleteAiModel(deleteAiDialog.id, token)
      setAiModels((prev) => prev.filter((m) => m.id !== deleteAiDialog.id))
      setDeleteAiDialog(null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to delete model')
    } finally {
      setAiModelLoading(false)
    }
  }

  const handleSetDefault = async (id) => {
    try {
      const res = await setDefaultAiModel(id, token)
      setAiModels((prev) => prev.map((m) => ({ ...m, is_default: m.id === res.data.id })))
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to set default')
    }
  }
```

- [ ] **Step 5: Add Tab 5 to the Tabs bar**

Find the existing `<Tabs>` block that ends with:
```javascript
        <Tab label={tabLabel('Audit Log')}           icon={<AdminPanelSettingsIcon sx={{ fontSize: 14 }} />}  iconPosition="start" />
```
Add after it:
```javascript
        <Tab label={tabLabel('AI Models', aiModels.length)} icon={<SmartToyIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
```

- [ ] **Step 6: Add the AI Models tab panel — paste this block after the closing `{/* ═══ TAB 3 ═══ */}` block, before the InviteDialog**

```javascript
      {/* ═══ TAB 4: AI MODELS ══════════════════════════════════════════════ */}
      {tab === 4 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={openAddModel}
              sx={{
                bgcolor: 'primary.main', color: 'background.default',
                fontFamily: '"Raleway", sans-serif', fontWeight: 700,
                fontSize: '0.7rem', letterSpacing: '0.1em',
                px: 2.5, py: 0.9, borderRadius: '1px',
                boxShadow: `0 2px 12px ${accent}30`,
                '&:hover': { bgcolor: 'primary.light' },
              }}
            >
              Add Model
            </Button>
          </Box>

          <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider' }}>
            <DataGrid
              rows={aiModels}
              getRowId={(r) => r.id}
              autoHeight
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              sx={{ ...getDataGridSx(accent, dark ? 'dark' : 'light'), border: 'none', borderRadius: 0 }}
              columns={[
                {
                  field: 'name', headerName: 'Name', flex: 1, minWidth: 160,
                  renderCell: (p) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <SmartToyIcon sx={{ fontSize: 14, color: 'primary.main', opacity: 0.7 }} />
                      <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.74rem', color: 'text.primary' }}>
                        {p.value}
                      </Typography>
                      {p.row.is_default && (
                        <Chip label="default" size="small" sx={{ height: 16, fontSize: '0.52rem', bgcolor: `${accent}20`, color: 'primary.main', px: 0 }} />
                      )}
                    </Box>
                  ),
                },
                {
                  field: 'provider', headerName: 'Provider', width: 110,
                  renderCell: (p) => {
                    const colors = { gemini: '#4285f4', openai: '#10a37f', anthropic: '#d4a84b', grok: '#1da1f2', generic: '#888' }
                    const col = colors[p.value] || '#888'
                    return (
                      <Chip
                        label={p.value}
                        size="small"
                        sx={{ bgcolor: `${col}18`, color: col, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.6rem', height: 20 }}
                      />
                    )
                  },
                },
                {
                  field: 'model_id', headerName: 'Model ID', flex: 1, minWidth: 160,
                  renderCell: (p) => (
                    <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                      {p.value}
                    </Typography>
                  ),
                },
                {
                  field: 'api_key', headerName: 'API Key', width: 130,
                  renderCell: (p) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <KeyIcon sx={{ fontSize: 12, color: p.value ? 'text.disabled' : '#b45050' }} />
                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: p.value ? 'text.disabled' : '#b45050' }}>
                        {p.value || 'not set'}
                      </Typography>
                    </Box>
                  ),
                },
                {
                  field: 'base_url', headerName: 'Base URL', flex: 1, minWidth: 130,
                  renderCell: (p) => p.value
                    ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LinkIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.66rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.value}
                        </Typography>
                      </Box>
                    )
                    : <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>—</Typography>,
                },
                {
                  field: 'is_active', headerName: 'Active', width: 80,
                  renderCell: (p) => p.value
                    ? <ToggleOnIcon  sx={{ fontSize: 22, color: '#6b8f71' }} />
                    : <ToggleOffIcon sx={{ fontSize: 22, color: 'text.disabled' }} />,
                },
                {
                  field: 'actions', headerName: 'Actions', width: 130, sortable: false,
                  renderCell: (p) => (
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Tooltip title={p.row.is_default ? 'Already default' : 'Set as default'}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleSetDefault(p.row.id)}
                            disabled={p.row.is_default}
                            sx={{ color: p.row.is_default ? accent : 'text.secondary', '&:hover': { color: accent } }}
                          >
                            {p.row.is_default ? <StarIcon sx={{ fontSize: 15 }} /> : <StarOutlineIcon sx={{ fontSize: 15 }} />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditModel(p.row)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                          <EditIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteAiDialog({ id: p.row.id, name: p.row.name })} sx={{ color: 'text.secondary', '&:hover': { color: '#c98f8f' } }}>
                          <DeleteIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ),
                },
              ]}
            />
          </Card>
        </Box>
      )}
```

- [ ] **Step 7: Add the Add/Edit AI Model dialog (paste before the closing `</Box>` of the component return)**

```javascript
      {/* ── Add / Edit AI Model dialog ───────────────────────────────────── */}
      <Dialog open={Boolean(aiModelDialog)} onClose={() => setAiModelDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.4rem', color: 'text.primary', pb: 1 }}>
          {aiModelDialog === 'add' ? 'Add AI Model' : 'Edit AI Model'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 0.5 }}>
            <TextField
              label="Display name *"
              size="small"
              fullWidth
              autoFocus
              value={aiModelForm.name}
              onChange={(e) => setAiModelForm((p) => ({ ...p, name: e.target.value }))}
              sx={{ '& .MuiInputBase-root': { fontFamily: '"Raleway", sans-serif', fontSize: '0.82rem' } }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.8rem' }}>Provider *</InputLabel>
              <Select
                value={aiModelForm.provider}
                label="Provider *"
                onChange={(e) => setAiModelForm((p) => ({ ...p, provider: e.target.value }))}
                sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.8rem' }}
              >
                {['gemini', 'openai', 'anthropic', 'grok', 'generic'].map((p) => (
                  <MenuItem key={p} value={p} sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem' }}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Model ID *"
              size="small"
              fullWidth
              placeholder="e.g. gemini-2.0-flash, gpt-4o, claude-sonnet-4-6"
              value={aiModelForm.model_id}
              onChange={(e) => setAiModelForm((p) => ({ ...p, model_id: e.target.value }))}
              sx={{ '& .MuiInputBase-root': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' } }}
            />
            <TextField
              label={aiModelDialog === 'add' ? 'API Key *' : 'API Key (leave blank to keep existing)'}
              size="small"
              fullWidth
              type="password"
              value={aiModelForm.api_key}
              onChange={(e) => setAiModelForm((p) => ({ ...p, api_key: e.target.value }))}
              sx={{ '& .MuiInputBase-root': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' } }}
            />
            {(aiModelForm.provider === 'generic' || aiModelForm.provider === 'grok') && (
              <TextField
                label={aiModelForm.provider === 'grok' ? 'Base URL (default: https://api.x.ai/v1)' : 'Base URL *'}
                size="small"
                fullWidth
                placeholder="https://api.example.com/v1"
                value={aiModelForm.base_url}
                onChange={(e) => setAiModelForm((p) => ({ ...p, base_url: e.target.value }))}
                sx={{ '& .MuiInputBase-root': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' } }}
              />
            )}
            <Box sx={{ display: 'flex', gap: 3 }}>
              <FormControlLabel
                control={<Switch size="small" checked={aiModelForm.is_default} onChange={(e) => setAiModelForm((p) => ({ ...p, is_default: e.target.checked }))} />}
                label={<Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.78rem' }}>Set as default</Typography>}
              />
              <FormControlLabel
                control={<Switch size="small" checked={aiModelForm.is_active} onChange={(e) => setAiModelForm((p) => ({ ...p, is_active: e.target.checked }))} />}
                label={<Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.78rem' }}>Active</Typography>}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setAiModelDialog(null)} variant="outlined" startIcon={<CancelIcon sx={{ fontSize: 15 }} />} sx={{ color: 'text.secondary', borderColor: 'divider', fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveAiModel}
            disabled={aiModelLoading || !aiModelForm.name.trim() || !aiModelForm.model_id.trim()}
            variant="contained"
            startIcon={aiModelLoading ? <CircularProgress size={14} /> : <SaveIcon sx={{ fontSize: 15 }} />}
            sx={{ bgcolor: 'primary.main', color: 'background.default', fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem' }}
          >
            {aiModelLoading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete AI Model dialog ───────────────────────────────────────── */}
      <Dialog open={Boolean(deleteAiDialog)} onClose={() => setDeleteAiDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.3rem', color: 'text.primary', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ fontSize: 20, color: '#b45050' }} /> Delete model?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: '"Raleway", sans-serif', fontSize: '0.82rem', color: 'text.secondary', lineHeight: 1.7 }}>
            Remove <strong style={{ color: theme.palette.text.primary }}>{deleteAiDialog?.name}</strong> from the platform. The API key stored for this model will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteAiDialog(null)} variant="outlined" startIcon={<CancelIcon sx={{ fontSize: 15 }} />} sx={{ color: 'text.secondary', borderColor: 'divider', fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteAiModel} disabled={aiModelLoading} variant="contained" startIcon={aiModelLoading ? <CircularProgress size={14} /> : <DeleteIcon sx={{ fontSize: 15 }} />} sx={{ bgcolor: '#8f4a4a', '&:hover': { bgcolor: '#b45050' }, fontFamily: '"Raleway", sans-serif', fontSize: '0.72rem' }}>
            {aiModelLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
```

- [ ] **Step 8: Commit**

```
git add frontend/src/pages/Admin.jsx
git commit -m "feat: add AI Models management tab to admin console"
```

---

## Self-Review

**Spec coverage:**
- ✅ PDF download with html2canvas + jsPDF, 2-column grid (captured as one canvas, paginated)
- ✅ AI models DB table with all required fields
- ✅ Encrypted API keys (Fernet, same as sftp_password_enc)
- ✅ Admin CRUD endpoints: list, create, update, delete, set-default
- ✅ Providers: gemini, openai, anthropic, grok (OpenAI-compat), generic (OpenAI-compat)
- ✅ `analyze_file` reads from DB, falls back to env var
- ✅ API keys never returned in GET (masked as ••••••••)
- ✅ AuditEvent logged for create/update/delete/set-default
- ✅ Duplicate `analyzeFile` in api.js fixed
- ✅ Admin tab count badge on "AI Models"

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:**
- `AiModel.id` is `Integer` in backend → used as `model_id_pk: int` in route params ✅
- `_serialize_model` returns `api_key: "••••••••"` or `""` — frontend checks `p.value` truthiness ✅
- `setDefaultAiModel` sets all rows' `is_default=False` then sets target ✅
- Frontend `setAiModels` after set-default: maps all rows and sets `is_default` only for matching id ✅
