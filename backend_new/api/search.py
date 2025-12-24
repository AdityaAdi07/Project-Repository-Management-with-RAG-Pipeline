"""Search-related endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models import SearchRequest, SearchResponse
from ..security import require_token
from ..services.search import search_projects

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/title", response_model=SearchResponse)
async def search_by_title(payload: SearchRequest, _=Depends(require_token)) -> SearchResponse:
    results = search_projects(payload.query, top_k=payload.top_k)
    return SearchResponse(
        query=payload.query,
        top_k=payload.top_k,
        retrieved=len(results),
        results=results,
    )
