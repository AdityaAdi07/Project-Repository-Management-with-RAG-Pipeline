"""Authentication endpoints."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, status

from ..models import FacultyLoginRequest, LoginRequest, TokenResponse
from ..mongo import get_faculty_collection, get_users_collection
from ..security import issue_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    users = get_users_collection()
    user = users.find_one({"s_mail_id": payload.s_mail_id, "usn": payload.usn})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user = {**user, "role": user.get("role") or "student"}
    token, exp = issue_token(user)
    if not isinstance(exp, datetime):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Token generation failed")

    return TokenResponse(token=token, expires_at=exp)



@router.post("/faculty-login", response_model=TokenResponse)
async def faculty_login(payload: FacultyLoginRequest) -> TokenResponse:
    # --- START OF HARDCODED CREDENTIALS (FOR TESTING ONLY - DO NOT USE IN PRODUCTION) ---
    if payload.f_mail_id == "Padmashree.is@rvce.edu.in" and payload.fac_id == "F000":
        user = {
            "_id": "691b7a995ced86b3871e2ca5", # Using the provided OID as an ID
            "fac_id": "F000",
            "f_name": "Padmashree",
            "f_mail_id": "Padmashree.is@rvce.edu.in",
            "dept": "ISE",
            "role": "teacher" # Explicitly setting the role for the token
        }
    else:
        # If not the hardcoded user, proceed with original database lookup or deny access
        # For temporary hardcoding, you might just deny access for other users
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # --- END OF HARDCODED CREDENTIALS ---

    # The rest of the logic remains the same to issue the token based on the 'user' object
    normalized = {
        **user,
        "s_mail_id": user.get("f_mail_id"),
        "usn": user.get("fac_id"),
        "role": user.get("role") or "teacher",
    }

    token, exp = issue_token(normalized)
    if not isinstance(exp, datetime):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Token generation failed")

    return TokenResponse(token=token, expires_at=exp)
