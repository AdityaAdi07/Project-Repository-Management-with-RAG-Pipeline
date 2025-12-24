"""Pydantic models for API requests and responses."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# Auth
class LoginRequest(BaseModel):
    s_mail_id: str = Field(..., description="Student email ID (used as username)")
    usn: str = Field(..., description="USN credential used as password")


class FacultyLoginRequest(BaseModel):
    f_mail_id: str = Field(..., description="Faculty email ID (used as username)")
    fac_id: str = Field(..., description="Faculty credential used as password")


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_at: datetime


# Search
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


class FieldScores(BaseModel):
    title: float
    description: float
    tech_stack: float
    domain: float
    objective: float


class SearchResult(BaseModel):
    project_id: str
    title: str
    domain: Optional[str] = None
    tech_stack: Optional[str] = None
    objective: Optional[str] = None
    snippet: Optional[str] = None
    whole_similarity: float
    bow_similarity: float
    final_similarity: float
    field_scores: FieldScores


class SearchResponse(BaseModel):
    query: str
    top_k: int
    retrieved: int
    results: List[SearchResult]


# Analyze synopsis
class SynopsisRequest(BaseModel):
    title: str = ""
    description: str = ""
    tech_stack: str = ""
    domain: str = ""
    objective: str = ""
    top_k: int = Field(default=8, ge=1, le=20)


class AnalysisResult(BaseModel):
    project_id: str
    title: str
    domain: Optional[str] = None
    tech_stack: Optional[str] = None
    objective: Optional[str] = None
    snippet: Optional[str] = None
    field_scores: FieldScores
    whole_similarity: float
    bow_similarity: float
    contextual_similarity: float
    final_similarity: float


class AnalysisResponse(BaseModel):
    synopsis: SynopsisRequest
    retrieved: int
    results: List[AnalysisResult]
    llm_analysis: str
