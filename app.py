# app.py
# Streamlit UI for Migration Copilot (Demo)
# - BYPASS_HMAC dev switch + optional HMAC secret
# - Upload CSV, send to n8n webhook
# - Fixes panel: quick-fix toggles + per-product overrides editor
# - Success banner + hide overrides when gate passes
# - Assistant Summary: state-aware line (needs review vs success) + "Applied fixes" count
# - CSV download fixed (real bytes)

import os
import io
import json
import time
import uuid
import hmac
import hashlib
from base64 import b64encode, b64decode
from typing import Tuple, Dict, Any, List

import requests
import pandas as pd
import streamlit as st

# ---------------------------- Config ----------------------------
DEFAULT_WEBHOOK_PATH = "/webhook/migrate_v1"   # adjust if different
DEFAULT_TIMEOUT_SEC = 120
DEFAULT_BYPASS_HMAC = True  # dev default

# ---------------------- Session bootstrap -----------------------
def _init_state():
    st.session_state.setdefault("base_url", os.getenv("N8N_BASE_URL", "").strip())
    st.session_state.setdefault("bypass_hmac", DEFAULT_BYPASS_HMAC)
    st.session_state.setdefault("mw_secret", os.getenv("MW_HMAC_SECRET", ""))  # UI can override
    st.session_state.setdefault("timeout_sec", DEFAULT_TIMEOUT_SEC)

    st.session_state.setdefault("strict_mode", True)
    st.session_state.setdefault("strategy_json", "")         # JSON string
    st.session_state.setdefault("overrides_json", "")        # JSON string
    st.session_state.setdefault("per_product_edits", {})     # temp UI state for overrides

    st.session_state.setdefault("stored_file_name", "")
    st.session_state.setdefault("stored_file_bytes", b"")
    st.session_state.setdefault("last_response", None)       # cache last js

_init_state()

# -------------------------- Helpers -----------------------------
def pretty_json(obj: Any) -> str:
    try:
        return json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        return str(obj)

def get_hmac_secret() -> str:
    # 1) env var, 2) sidebar input, else empty (unsigned)
    return os.getenv("MW_HMAC_SECRET") or st.session_state.get("mw_secret", "")

def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def sign_body(secret: str, ts: int, request_id: str, file_digest_header: str) -> str:
    # Must match n8n Verify HMAC: base = f"{ts}.{request_id}.{file_digest_header}"
    base = f"{ts}.{request_id}.{file_digest_header}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), base, hashlib.sha256).hexdigest()

def send_to_n8n(
    base_url: str,
    path: str,
    file_name: str,
    file_bytes: bytes,
    strict_mode: bool,
    strategy_json: str,
    overrides_json: str,
    bypass_hmac: bool,
) -> Tuple[bool, str, requests.Response]:
    """Graceful signing: if secret provided and not bypassed, sign; else send unsigned."""
    ts = int(time.time())
    request_id = str(uuid.uuid4())
    file_digest_header = sha256_hex(file_bytes)

    headers = {
        "x-timestamp": str(ts),
        "x-request-id": request_id,
        "x-file-digest": file_digest_header,
        "x-strict-mode": str(strict_mode).lower(),
        "x-strategy-json": strategy_json or "",
        "x-overrides-json": overrides_json or "",
        # 'content-type' left to requests for multipart boundary
    }

    # Also send as form data for backwards compatibility
    data = {
        "strict_mode": str(strict_mode).lower(),
        "strategy_json": strategy_json or "",
        "overrides_json": overrides_json or "",
    }

    files = {
        "file": (file_name or "catalog.csv", file_bytes, "text/csv"),
    }

    signed = False
    secret = get_hmac_secret()
    if secret and not bypass_hmac:
        headers["x-signature"] = sign_body(secret, ts, request_id, file_digest_header)
        signed = True

    url = base_url.rstrip("/") + "/" + path.lstrip("/")

    # CRITICAL FIX: Pass overrides and strategy as URL query params
    # This ensures they survive the n8n "Extract from File" node which drops metadata
    from urllib.parse import quote
    query_params = []
    if overrides_json:
        query_params.append(f"overrides={quote(overrides_json)}")
    if strategy_json:
        query_params.append(f"strategy={quote(strategy_json)}")
    if strict_mode is not None:
        query_params.append(f"strict_mode={str(strict_mode).lower()}")

    if query_params:
        url += "?" + "&".join(query_params)

    resp = requests.post(
        url, data=data, files=files, headers=headers,
        timeout=int(st.session_state.get("timeout_sec", DEFAULT_TIMEOUT_SEC))
    )
    return signed, request_id, resp

def _clear_override_ui_state():
    # clears stale override widgets after success
    st.session_state.pop("per_product_edits", None)

# ---------------------------- UI --------------------------------
st.set_page_config(page_title="Migration Copilot (Demo)", layout="wide")

with st.sidebar:
    st.markdown("### Connection")
    st.session_state.base_url = st.text_input(
        "n8n Base URL", value=st.session_state.get("base_url", ""), placeholder="https://<your>.n8n.cloud"
    )
    st.session_state.bypass_hmac = st.toggle(
        "Bypass HMAC (dev)", value=st.session_state.get("bypass_hmac", DEFAULT_BYPASS_HMAC)
    )
    st.session_state.mw_secret = st.text_input(
        "HMAC Secret (optional)",
        value=st.session_state.get("mw_secret", ""),
        type="password",
        help="When set and Bypass HMAC is OFF, requests include x-signature."
    )
    st.session_state.timeout_sec = st.number_input(
        "Request timeout (sec)", min_value=30, max_value=600,
        value=int(st.session_state.get("timeout_sec", DEFAULT_TIMEOUT_SEC))
    )
    st.caption("Tip: For production webhook, ensure workflow is **active** in n8n.")

    st.divider()
    st.markdown("### Run Options")
    st.session_state.strict_mode = st.toggle(
        "Strict Mode (block on errors)", value=bool(st.session_state.get("strict_mode", True))
    )

st.title("🧭 Migration Copilot — Demo UI")

# Upload
col_u1, col_u2 = st.columns([3, 2])
with col_u1:
    uploaded = st.file_uploader("Upload source CSV export", type=["csv"])
with col_u2:
    st.write("Strategy JSON (optional)")
    st.session_state.strategy_json = st.text_area(
        label="strategy_json",
        value=st.session_state.get("strategy_json", ""),
        height=120,
        placeholder='e.g. {"option_priority":["Color","Size","Material"]}',
        label_visibility="collapsed"
    )

# Persist uploaded file for re-runs
if uploaded is not None:
    st.session_state.stored_file_name = uploaded.name
    st.session_state.stored_file_bytes = uploaded.read()

# Actions
c_send, c_rerun = st.columns([1, 1])
send_clicked = c_send.button("Send to Agent", type="primary", use_container_width=True)
rerun_clicked = c_rerun.button("Apply overrides & re-run", use_container_width=True)

# Resolve current JSON strings from session (set by overrides panel too)
overrides_json = st.session_state.get("overrides_json") or ""
strategy_json = st.session_state.get("strategy_json") or ""

# Guard: need file
if (send_clicked or rerun_clicked) and not st.session_state.get("stored_file_bytes"):
    st.error("Please upload a CSV file first.")
    st.stop()

# Do request (send or re-run)
js = None
if send_clicked or rerun_clicked:
    try:
        # helpful debug: show what we're about to send
        if rerun_clicked or send_clicked:
            with st.expander("🔍 Outgoing payload (debug)", expanded=True):
                payload_debug = {
                    "strict_mode": bool(st.session_state.get("strict_mode", True)),
                    "strategy_json": strategy_json,
                    "overrides_json": overrides_json
                }
                st.code(json.dumps(payload_debug, indent=2), language="json")

                # Also show parsed overrides
                if overrides_json:
                    try:
                        parsed_overrides = json.loads(overrides_json)
                        st.write("**Parsed overrides:**")
                        st.json(parsed_overrides)
                    except Exception as e:
                        st.error(f"Error parsing overrides_json: {e}")

        signed, request_id, r = send_to_n8n(
            base_url=st.session_state.get("base_url", "").strip(),
            path=DEFAULT_WEBHOOK_PATH,
            file_name=st.session_state.get("stored_file_name", "catalog.csv"),
            file_bytes=st.session_state.get("stored_file_bytes", b""),
            strict_mode=bool(st.session_state.get("strict_mode", True)),
            strategy_json=strategy_json,
            overrides_json=overrides_json,
            bypass_hmac=bool(st.session_state.get("bypass_hmac", DEFAULT_BYPASS_HMAC)),
        )
        content_type = r.headers.get("content-type", "")
        ok_json = "application/json" in content_type or r.text.strip().startswith("{")
        try:
            js = r.json() if ok_json else None
        except Exception:
            js = None

        # Metrics
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("HTTP", r.status_code)
        m2.metric("JSON?", "yes" if js is not None else "no")
        m3.metric("Signed", "✅" if signed else "—")
        needs_override_metric = (js or {}).get("gate", {}).get("needs_override") if js else None
        m4.metric("Needs Override", "Yes" if needs_override_metric else ("No" if needs_override_metric is not None else "—"))

        if not signed and not bool(st.session_state.get("bypass_hmac", DEFAULT_BYPASS_HMAC)):
            st.warning("Sent **unsigned** (no secret provided). Enter a secret or toggle Bypass HMAC.")

        if js is None:
            st.error("No JSON in response. Body preview:")
            st.code(r.text[:2000])
        else:
            st.session_state.last_response = js
    except Exception as e:
        st.exception(e)

# Show last response if nothing new was sent
if js is None:
    js = st.session_state.get("last_response")

if not js:
    st.info("Upload a CSV and click **Send to Agent** to begin.")
    st.stop()

# -------------------- Render response --------------------
gate = js.get("gate", {}) or {}
qa = js.get("qa", {}) or {}
decision_log = js.get("decision_log", {}) or {}
files = js.get("files") or {}
assistant = js.get("assistant") or {}
handles_list = js.get("handles_with_overflow") or []

# Assistant Summary — conversational, copilot-style
def build_conversational_summary(js_obj):
    """Build natural language, copilot-style summary"""
    gate = js_obj.get("gate", {}) or {}
    qa = js_obj.get("qa", {}) or {}
    decision_log = js_obj.get("decision_log", {}) or {}
    handles_list = js_obj.get("handles_with_overflow") or []

    needs_override = bool(gate.get("needs_override"))
    blocking_count = int(qa.get("blocking") or 0)
    warn_count = int(qa.get("warnings") or 0)
    issues = qa.get("issues", [])

    messages = []

    # Opening line
    if needs_override:
        messages.append("⚠️ **Review needed before finalizing:**")
    else:
        messages.append("✅ **Migration ready to export!**")

    # Details about products with overflow
    if len(handles_list) > 0:
        plural = "product has" if len(handles_list) == 1 else "products have"
        messages.append(f"\n**{len(handles_list)} {plural} more than 3 options** (Shopify's limit).")

        # Show which options were suggested
        first_handle = handles_list[0]
        suggested = first_handle.get('suggested_three', [])
        if suggested:
            messages.append(f"• I suggest keeping: **{', '.join(suggested)}** as the main options.")
        messages.append("• Remaining options will be moved to metafields and product description.")

        # List affected products
        if len(handles_list) <= 3:
            product_names = [h.get('title', h.get('handle')) for h in handles_list]
            messages.append(f"• Affected: {', '.join(product_names)}")
        else:
            sample = [h.get('title', h.get('handle')) for h in handles_list[:2]]
            messages.append(f"• Affected: {', '.join(sample)}, and {len(handles_list) - 2} more...")

    # Blocking issues
    if blocking_count > 0:
        messages.append(f"\n**{blocking_count} critical issue(s) found:**")
        # Categorize blocking issues
        missing_titles = [i for i in issues if i.get('code') == 'REQ_MISSING_TITLE']
        missing_prices = [i for i in issues if i.get('code') == 'REQ_MISSING_PRICE']

        if missing_titles:
            messages.append(f"• {len(missing_titles)} product(s) missing titles")
        if missing_prices:
            messages.append(f"• {len(missing_prices)} variant(s) missing prices")
        messages.append("_These must be fixed before import._")

    # Warnings
    if warn_count > 0:
        messages.append(f"\n**{warn_count} warning(s) detected:**")
        auto_sku = [i for i in issues if i.get('code') == 'AUTO_SKU_ASSIGNED']
        dup_variants = [i for i in issues if i.get('code') == 'DUP_VARIANT_COMBO']

        if auto_sku:
            messages.append(f"• {len(auto_sku)} SKU(s) auto-generated")
        if dup_variants:
            messages.append(f"• {len(dup_variants)} duplicate variant combination(s)")

    # Applied fixes
    applied = decision_log.get("overrides_applied", {}) or {}
    applied_list = applied.get("list", [])
    if applied_list:
        messages.append(f"\n✨ **Applied {len(applied_list)} fix(es):**")

        # Categorize fixes
        option_fixes = [a for a in applied_list if a.get('type') == 'cap_options']
        price_fixes = [a for a in applied_list if 'price' in a.get('type', '')]
        title_fixes = [a for a in applied_list if 'title' in a.get('type', '')]

        if option_fixes:
            messages.append(f"• Capped options to 3 for {len(option_fixes)} product(s)")
        if price_fixes:
            messages.append(f"• Fixed missing prices for {len(price_fixes)} variant(s)")
        if title_fixes:
            messages.append(f"• Fixed missing titles for {len(title_fixes)} product(s)")

    return "\n".join(messages)

st.subheader("Assistant Summary")
summary_msg = build_conversational_summary(js)
st.markdown(summary_msg)

# QA / Gate details
with st.expander("QA & Gate details", expanded=False):
    st.write("**Gate**")
    st.code(pretty_json(gate), language="json")
    st.write("**QA**")
    st.code(pretty_json(qa), language="json")

# Confirmation message after re-run with overrides
if rerun_clicked and js:
    applied = decision_log.get("overrides_applied", {})
    applied_list = applied.get("list", [])
    if applied_list:
        resolved_handles = list(set([item.get('handle') for item in applied_list if item.get('type') == 'cap_options']))
        if resolved_handles:
            st.success(f"✅ Overrides applied to {len(resolved_handles)} product(s): {', '.join(resolved_handles[:3])}{'...' if len(resolved_handles) > 3 else ''}")

# Success banner & cleanup (hide overrides when fully resolved)
applied_count = int(decision_log.get("overrides_applied", {}).get("count") or 0)
needs_override = bool(gate.get("needs_override"))
if applied_count > 0 and not needs_override and not handles_list:
    st.success(f"All overrides applied! CSV is ready for review/download.")
    st.session_state.pop("overrides_json", None)
    st.session_state.pop("per_product_edits", None)
    try:
        _clear_override_ui_state()
    except Exception:
        pass

# Preview (first 25 rows)
def _preview_df(rows: List[Dict[str, Any]], limit: int = 25) -> pd.DataFrame:
    try:
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            return pd.DataFrame(rows[:limit])
        return pd.DataFrame()
    except Exception:
        return pd.DataFrame()

st.subheader("Preview (first 25 rows)")
df_prev = _preview_df(js.get("preview_transformed") or [], 25)
if not df_prev.empty:
    st.dataframe(df_prev, use_container_width=True, height=400)
else:
    st.caption("No preview rows returned.")

# Download — real bytes
csv_b64 = files.get("shopify_csv_base64")
if csv_b64:
    try:
        csv_bytes = b64decode(csv_b64)
        fname = f"shopify_products_{time.strftime('%Y-%m-%d')}.csv"
        st.download_button(
            "Download Shopify CSV",
            data=csv_bytes,
            file_name=fname,
            mime="text/csv",
            use_container_width=True,
        )
        st.caption(f"CSV size: ~{len(csv_bytes):,} bytes")
    except Exception as e:
        st.error(f"Could not decode CSV: {e}")

# ----------------- Fixes (Agentic) Panel -----------------
def render_overrides_panel(js_obj: dict):
    """Per-product overrides + quick-fix toggles. Render only if still needed."""
    st.subheader("Overrides (per product)")

    # Pending changes indicator
    has_pending_changes = bool(st.session_state.get("per_product_edits"))
    if has_pending_changes:
        st.info("📝 You have pending changes. Click **'Apply overrides & re-run'** at the top to submit them.")

    # Quick-fix toggles for strategy
    with st.expander("Quick Fixes (Price/Title/SKU)", expanded=False):
        colA, colB = st.columns(2)
        with colA:
            fmp_zero = st.checkbox("Fill missing price → 0", value=False, key="fix_price_zero")
            fmp_copy = st.checkbox("Copy compare-at into price if missing", value=False, key="fix_price_copy")
        with colB:
            fmt_title = st.checkbox("Fill missing title → 'Untitled' prefix", value=False, key="fix_title_prefix")
            sku_unique = st.checkbox("Generate unique SKUs for expanded variants", value=True, key="sku_unique",
                                     help="When a simple product is expanded into variants, generate unique SKUs for each variant instead of keeping the parent SKU")

        # Build strategy patch and persist as JSON string
        try:
            base_strategy = st.session_state.get("strategy_json") or ""
            base = json.loads(base_strategy) if isinstance(base_strategy, str) and base_strategy.strip() else {}
        except Exception:
            base = {}

        if fmp_zero:
            base["fix_missing_price"] = "zero"
        elif fmp_copy:
            base["fix_missing_price"] = "copy_compare_at"

        if fmt_title:
            base["fix_missing_title"] = {"mode": "prefix", "prefix": "Untitled"}

        if sku_unique:
            base["sku_generation"] = "generate_unique"
        else:
            base["sku_generation"] = "keep_parent"

        st.session_state.strategy_json = json.dumps(base)

    st.caption("Pick up to 3 option dimensions per product. Overflow will be appended to Body (HTML) and stored as Metafields JSON on the first row.")

    per_edits = st.session_state.get("per_product_edits") or {}
    items = js_obj.get("handles_with_overflow") or []

    for item in items:
        handle = item.get("handle")
        title = item.get("title") or handle
        attrs = item.get("varying_attributes") or []
        suggested = item.get("suggested_three") or attrs[:3]
        if not handle:
            continue

        with st.container(border=True):
            st.markdown(f"**{title}**  \n`{handle}`")
            sel = st.multiselect(
                "Choose up to 3 option dimensions",
                options=attrs,
                default=suggested[:3],
                max_selections=3,
                key=f"opt_{handle}"
            )
            action = st.selectbox(
                "Overflow action",
                options=["append_to_body_html"],
                index=0,
                key=f"act_{handle}",
                help="Demo: overflow values are appended to Body (HTML) and written into a Metafields JSON."
            )
            per_edits[handle] = {"chosen_options": sel, "overflow_to": action}

    st.session_state.per_product_edits = per_edits

    # Build overrides_json from edits
    if per_edits:
        payload = {"per_product": per_edits}
        st.session_state.overrides_json = json.dumps(payload, ensure_ascii=False)

    st.caption("⚠️ Changes are staged locally. Click **'Apply overrides & re-run'** button at the top to submit them to the workflow.")

# Render Overrides panel only if still needed
if needs_override or handles_list:
    render_overrides_panel(js)

# Footer debug
with st.expander("Raw JSON response", expanded=False):
    st.code(pretty_json(js), language="json")
with st.expander("Session (debug)", expanded=False):
    dbg = {k: (v if k not in ("stored_file_bytes",) else f"<{len(v)} bytes>") for k, v in st.session_state.items()}
    st.code(pretty_json(dbg), language="json")
