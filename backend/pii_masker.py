"""
pii_masker.py — PII detection, masking, and de-anonymization for LLM prompt safety.

Detection layers (applied in order):
  1. Column-name heuristics  — regex match on column headers (HR/payroll focused)
  2. Structural regex        — email, phone, SSN, credit card, IBAN, date-of-birth
  3. spaCy NER (optional)    — PERSON, ORG, GPE entities if the model is available

Each unique sensitive string receives a stable, reversible token:
    [PERSON_1], [EMAIL_2], [ORG_3], [DATA_4], ...

A per-request vault (token → original) is used to de-anonymize LLM output.
The masker is NOT thread-safe by design — create one instance per request.
"""

from __future__ import annotations

import copy
import re
from collections import defaultdict
from typing import Any

# ── spaCy (optional) ─────────────────────────────────────────────────────────
# Falls back to regex-only when the model is not installed.
try:
    import spacy as _spacy
    _nlp = _spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except Exception:
    _nlp = None
    SPACY_AVAILABLE = False

# ── Column-name patterns that indicate sensitive columns ──────────────────────
_SENSITIVE_COL_RE = re.compile(
    r"(?:^|[\W_])("
    r"name|firstname|lastname|fullname|first[\W_]name|last[\W_]name|"
    r"email|e[\W_]mail|"
    r"phone|mobile|cell|telephone|"
    r"ssn|social[\W_]?security|national[\W_]?id|nid|tin|tax[\W_]?id|"
    r"salary|wage|compensation|pay|income|earnings|bonus|"
    r"address|street|city|state|zip|postal|"
    r"dob|birth|date[\W_]of[\W_]birth|birthdate|"
    r"account|acct|iban|routing|swift|bic|"
    r"credit[\W_]?card|card[\W_]?num|card[\W_]?number|"
    r"password|passwd|pin|secret|"
    r"passport|license|licence|"
    r"emplid|emp[\W_]?id|employee[\W_]?id|"
    r"gender|race|ethnicity|religion|nationality|marital|"
    r"emergency[\W_]contact|next[\W_]of[\W_]kin"
    r")(?:$|[\W_])",
    re.IGNORECASE,
)

# ── Structural PII regex patterns ─────────────────────────────────────────────
_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(
        r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
    )),
    ("PHONE", re.compile(
        r"\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
    )),
    ("SSN", re.compile(
        r"\b\d{3}-\d{2}-\d{4}\b"
    )),
    ("CARD", re.compile(
        r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
    )),
    ("IBAN", re.compile(
        r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b"
    )),
    ("DOB", re.compile(
        r"\b(?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01])[/\-.](?:19|20)\d{2}\b"
    )),
]

# spaCy entity labels we treat as PII
_PII_LABELS = {"PERSON", "ORG", "GPE", "LOC", "NORP", "FAC"}


class PIIMasker:
    """
    One-request lifetime masker.  Create a new instance for every /analyze-file call.
    """

    def __init__(self):
        self._vault: dict[str, str] = {}              # token  → original
        self._rev: dict[str, str] = {}                # "{kind}:{original}" → token
        self._counters: defaultdict[str, int] = defaultdict(int)

    # ── internal token management ─────────────────────────────────────────────

    def _token(self, kind: str, value: str) -> str:
        key = f"{kind}:{value}"
        if key not in self._rev:
            self._counters[kind] += 1
            tok = f"[{kind}_{self._counters[kind]}]"
            self._rev[key] = tok
            self._vault[tok] = value
        return self._rev[key]

    # ── value-level masking ───────────────────────────────────────────────────

    def _mask_value(self, value: str, force: bool = False) -> str:
        """
        Mask a single string value.
        `force=True` masks the whole value if no pattern matched (used for
        sensitive columns where any non-numeric content is PII).
        """
        if not isinstance(value, str) or not value.strip():
            return value

        text = value

        # Layer 1: Structured regex patterns
        for kind, pat in _PATTERNS:
            def _sub(m, k=kind):
                return self._token(k, m.group(0))
            text = pat.sub(_sub, text)

        # Layer 2: spaCy NER (only if regex did not already mask everything)
        if SPACY_AVAILABLE and _nlp and text == value:
            doc = _nlp(text[:500])   # cap to keep inference fast
            # Replace entities in reverse order so offsets stay valid
            ents = [
                (e.start_char, e.end_char, e.label_, e.text)
                for e in doc.ents
                if e.label_ in _PII_LABELS
            ]
            for start, end, label, ent_text in reversed(ents):
                tok = self._token(label, ent_text)
                text = text[:start] + tok + text[end:]

        # Layer 3: Force-mask for column-heuristic sensitive values
        if force and text == value:
            # Only mask non-numeric strings (numbers are aggregate-safe)
            if not re.fullmatch(r"[\d.,\s%$€£¥+-]+", value.strip()):
                text = self._token("DATA", value)

        return text

    # ── profile masking ───────────────────────────────────────────────────────

    def _sensitive_column_names(self, profile: dict) -> set[str]:
        return {
            c["name"]
            for c in profile.get("columns", [])
            if _SENSITIVE_COL_RE.search(c["name"])
        }

    def mask_profile(self, profile: dict) -> tuple[dict, int]:
        """
        Return *(masked_profile, n_values_masked)*.
        The input dict is not mutated.
        """
        masked = copy.deepcopy(profile)
        sens = self._sensitive_column_names(masked)
        before = len(self._vault)

        # ── column-level stats ────────────────────────────────────────────────
        for col_info in masked.get("columns", []):
            is_sens = col_info["name"] in sens
            if "top_values" in col_info:
                col_info["top_values"] = {
                    self._mask_value(str(v), force=is_sens): cnt
                    for v, cnt in col_info["top_values"].items()
                }

        # ── category_counts ───────────────────────────────────────────────────
        if "category_counts" in masked:
            for col_name, counts in masked["category_counts"].items():
                is_sens = col_name in sens
                masked["category_counts"][col_name] = {
                    self._mask_value(str(v), force=is_sens): cnt
                    for v, cnt in counts.items()
                }

        # ── sample_rows (highest risk — actual cell values) ───────────────────
        for row in masked.get("sample_rows", []):
            for col, val in list(row.items()):
                if val is None:
                    continue
                is_sens = col in sens
                row[col] = self._mask_value(str(val), force=is_sens)

        n_masked = len(self._vault) - before
        return masked, n_masked

    # ── de-anonymization ─────────────────────────────────────────────────────

    def demask_str(self, text: str) -> str:
        """Replace all tokens in *text* with their originals."""
        for tok, original in self._vault.items():
            text = text.replace(tok, original)
        return text

    def demask_obj(self, obj: Any) -> Any:
        """Recursively restore originals in any JSON-compatible structure."""
        if isinstance(obj, str):
            return self.demask_str(obj)
        if isinstance(obj, list):
            return [self.demask_obj(i) for i in obj]
        if isinstance(obj, dict):
            return {k: self.demask_obj(v) for k, v in obj.items()}
        return obj

    # ── introspection ─────────────────────────────────────────────────────────

    @property
    def masked_count(self) -> int:
        return len(self._vault)

    @property
    def spacy_active(self) -> bool:
        return SPACY_AVAILABLE
