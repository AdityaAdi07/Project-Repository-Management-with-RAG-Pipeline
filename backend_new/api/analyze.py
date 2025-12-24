"""Analysis endpoints for synopsis evaluation."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models import AnalysisResponse, SynopsisRequest
from ..security import require_token
from ..services.search import analyze_synopsis

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/synopsis", response_model=AnalysisResponse)
async def analyze_synopsis_route(payload: SynopsisRequest, _=Depends(require_token)) -> AnalysisResponse:
    results, llm_text = analyze_synopsis(payload.model_dump(), top_k=payload.top_k)
    return AnalysisResponse(
        synopsis=payload,
        retrieved=len(results),
        results=results,
        llm_analysis=llm_text,
    )
