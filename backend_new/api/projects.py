"""Project insights endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..security import require_token
from ..services.projects import get_project_summary

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/summary")
async def project_summary(_=Depends(require_token)):
    return get_project_summary()
