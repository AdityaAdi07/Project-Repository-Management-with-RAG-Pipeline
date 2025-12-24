"""Diagnostic endpoints for connectivity checks."""
from __future__ import annotations

from fastapi import APIRouter

from ..chroma import probe_store
from ..mongo import check_connection
from ..services.projects import get_project_summary

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/chroma")
async def chroma_status():
    probe = probe_store()
    return {
        "status": "ok" if probe.dim else "unknown",
        "collection": probe.collection,
        "count": probe.count,
        "embedding_dim": probe.dim,
    }


@router.get("/mongo")
async def mongo_status():
    status_info = check_connection()
    return {
        "status": "ok" if status_info.ok else "error",
        "error": status_info.error,
    }


@router.get("/projects/summary")
async def project_summary():
    return get_project_summary()
