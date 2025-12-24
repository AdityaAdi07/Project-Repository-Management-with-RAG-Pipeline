"""Lightweight token generation and verification utilities."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .settings import get_settings

_bearer_scheme = HTTPBearer(auto_error=True)


@dataclass
class TokenPayload:
    user_id: str
    s_mail_id: Optional[str]
    usn: Optional[str]
    role: Optional[str]
    exp: datetime


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(data: bytes) -> str:
    settings = get_settings()
    secret = settings.auth_token_secret.encode("utf-8")
    signature = hmac.new(secret, data, hashlib.sha256).digest()
    return _b64encode(signature)


def create_token(payload: Dict[str, Any]) -> str:
    body = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    encoded = _b64encode(body)
    signature = _sign(body)
    return f"{encoded}.{signature}"


def decode_token(token: str) -> TokenPayload:
    try:
        encoded, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token") from exc

    body = _b64decode(encoded)
    expected_sig = _sign(body)
    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

    data = json.loads(body.decode("utf-8"))
    try:
        exp = datetime.fromisoformat(data["exp"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload") from exc

    if exp <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    return TokenPayload(
        user_id=str(data.get("user_id")),
        s_mail_id=str(data.get("s_mail_id")),
        usn=str(data.get("usn")),
        role=data.get("role"),
        exp=exp,
    )


def issue_token(user_doc: Dict[str, Any]) -> tuple[str, datetime]:
    settings = get_settings()
    ttl = timedelta(minutes=settings.auth_token_ttl_minutes)
    exp = datetime.now(timezone.utc) + ttl
    payload = {
        "user_id": str(user_doc.get("_id")),
        "s_mail_id": user_doc.get("s_mail_id"),
        "usn": user_doc.get("usn"),
        "role": user_doc.get("role") or "student",
        "exp": exp.isoformat(),
    }
    token = create_token(payload)
    return token, exp


async def require_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> TokenPayload:
    return decode_token(credentials.credentials)
