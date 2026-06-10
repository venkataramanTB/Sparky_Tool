# Reveal Saved Passwords in Config Tab

**Date:** 2026-06-10
**Status:** Approved

## Problem

When a saved configuration is loaded in the Settings page, all four password fields (PeopleSoft, SFTP, FTP, Windows) display `***` — the sentinel value returned by the backend to avoid re-transmitting secrets on every page load. Clicking the eye icon reveals `***` literally rather than the actual saved password, which is unhelpful and forces users to re-enter passwords they have already saved.

## Goal

Let users click the eye icon on any `***` password field and see the real saved password.

## Approach

Fetch-on-reveal: a dedicated backend endpoint returns all four decrypted passwords for a config when explicitly requested. The frontend calls it once on the first eye-click for a loaded config, hydrates all four fields with real values, then shows/hides in memory on subsequent toggles.

Rejected alternatives:
- **Return decrypted on GET config** — password always in the browser/devtools/response history even if the user never clicks reveal.
- **Per-field fetch** — 4× the requests with no security benefit over a single batch call.

## Backend

### New endpoint

```
GET /api/v2/configs/{config_id}/secrets
```

- Location: `backend/routers/configs.py`
- Auth: `Depends(get_current_user)` + `Depends(get_db)`
- Ownership check: `config.user_id == user.id` — 404 if not found or not owned
- Response:

```json
{
  "ps_password":   "decrypted or empty string",
  "sftp_password": "decrypted or empty string",
  "ftp_password":  "decrypted or empty string",
  "win_password":  "decrypted or empty string"
}
```

- Uses existing `decrypt()` from `encrypt.py`
- Empty string for any field with no saved password (`ps_password_enc == ""`)

## API Client

`frontend/src/api.js` — one new export:

```js
export const getConfigSecrets = (id) => client.get(`/v2/configs/${id}/secrets`)
```

The existing axios interceptor already attaches the Bearer token.

## Frontend

### New state in `Settings.jsx`

| State | Type | Purpose |
|---|---|---|
| `secretsFetched` | `bool` | Whether secrets have been fetched for the current config. Prevents redundant calls on repeat eye-clicks. |
| `revealLoading` | `bool` | Shows a spinner on the eye icon while the fetch is in-flight. |

### Reveal logic

`passAdornment` receives a new optional `onReveal` async callback in addition to the existing `toggle`. When the eye is clicked:

1. If `form[fieldKey] === '***'` and `!secretsFetched` → call `onReveal()`
2. `onReveal` sets `revealLoading = true`, calls `getConfigSecrets(selectedConfigId)`, patches all four password fields in `form` with real values, sets `secretsFetched = true`, clears `revealLoading`
3. `toggle()` runs as normal (show/hide)

Error handling: on fetch failure, show a snackbar error and do not change `secretsFetched` (so the user can retry).

### Reset on config switch

Inside `handleSelectConfig`, reset `secretsFetched = false` and `revealLoading = false` so switching to a different config always re-fetches rather than showing stale values.

### Fields affected

All four password fields use the reveal-aware toggle:
- PeopleSoft password / Bearer token (`ps_password`)
- SFTP password (`sftp_password`)
- FTP password (`ftp_password`)
- Windows password (`win_password`)

## Security notes

- The secrets endpoint requires a valid JWT and ownership check — unauthenticated callers receive 401, wrong-owner callers receive 404.
- Passwords only leave the backend when the user explicitly clicks reveal.
- The existing sentinel pattern (`***`) for save/update is unchanged.
