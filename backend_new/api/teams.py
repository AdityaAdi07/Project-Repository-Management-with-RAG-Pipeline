"""Faculty team and project review endpoints."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..mongo import get_projects_collection, get_teams_collection
from ..security import TokenPayload, require_token

router = APIRouter(prefix="/teams", tags=["teams"])


class ApprovalRequest(BaseModel):
    approved: bool = Field(..., description="Whether the team project is approved")


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("/my")
async def list_faculty_teams(payload: TokenPayload = Depends(require_token)) -> Dict[str, Any]:
    """Return all teams mapped to the logged-in faculty member."""
    if payload.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Faculty access only")

    fac_id = payload.usn
    if not fac_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing faculty ID in token")

    teams_coll = get_teams_collection()
    teams: List[Dict[str, Any]] = [*teams_coll.find({"fac_id": fac_id})]
    return {
        "fac_id": fac_id,
        "teams": [_serialize(team) for team in teams],
    }


@router.get("/{team_id}")
async def get_team_detail(team_id: str, payload: TokenPayload = Depends(require_token)) -> Dict[str, Any]:
    """Return team document and all associated projects by team_id."""
    if payload.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Faculty access only")

    teams_coll = get_teams_collection()
    projects_coll = get_projects_collection()

    team = teams_coll.find_one({"team_id": team_id})
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    projects: List[Dict[str, Any]] = [*projects_coll.find({"team_id": team_id})]
    return {
        "team": _serialize(team),
        "projects": [_serialize(project) for project in projects],
    }


@router.post("/{team_id}/approval")
async def set_team_approval(
    team_id: str,
    body: ApprovalRequest,
    payload: TokenPayload = Depends(require_token),
) -> Dict[str, Any]:
    """Update the approval status for a team."""
    if payload.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Faculty access only")

    teams_coll = get_teams_collection()
    status_text = "APPROVED" if body.approved else "NOT APPROVED"

    result = teams_coll.update_one({"team_id": team_id}, {"$set": {"approved": status_text}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    updated = teams_coll.find_one({"team_id": team_id})
    return {"team": _serialize(updated), "approved": status_text}