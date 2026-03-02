"""
NOTION WEBHOOK PROBE SERVER
===========================
Temporary FastAPI endpoint used to:
- capture Notion webhook verification challenges
- store incoming webhook payloads as JSON artifacts for mapping design

USAGE:
- python -m venv .venv && source .venv/bin/activate
- pip install fastapi uvicorn
- uvicorn server:app --host 0.0.0.0 --port 8321
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


ROOT_DIR = Path(__file__).resolve().parent
PAYLOAD_DIR = ROOT_DIR / "payloads"
PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("notion-webhook-probe")

app = FastAPI(title="Notion Webhook Probe", version="0.1.0")


def write_payload(payload: dict[str, Any], request_id: str) -> Path:
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    output = PAYLOAD_DIR / f"{timestamp}_{request_id}.json"
    output.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return output


@app.post("/hooks/notion")
async def notion_hook(request: Request) -> JSONResponse:
    body = await request.json()
    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"ok": False, "error": "invalid_json_body"})

    request_id = datetime.now(UTC).strftime("%H%M%S%f")

    verification_token = body.get("verification_token")
    if isinstance(verification_token, str) and verification_token.strip():
        LOGGER.info("[verification_token] %s", verification_token)
        saved = write_payload(body, f"{request_id}_verification")
        return JSONResponse(status_code=200, content={"ok": True, "verificationTokenSeen": True, "saved": str(saved)})

    saved = write_payload(body, request_id)
    event_type = body.get("type")
    LOGGER.info("[event] type=%s saved=%s", event_type, saved)
    return JSONResponse(status_code=200, content={"ok": True, "saved": str(saved), "eventType": event_type})
