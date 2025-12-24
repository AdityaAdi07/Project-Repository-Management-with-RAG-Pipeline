"""Student-specific endpoints."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..mongo import (
    get_projects_collection,
    get_search_history_collection,
    get_teams_collection,
    get_users_collection,
)
from ..security import TokenPayload, require_token

router = APIRouter(prefix="/students", tags=["students"])


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize MongoDB document by converting ObjectId to string."""
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.get("/my-team")
async def get_my_team(payload: TokenPayload = Depends(require_token)) -> Dict[str, Any]:
    """Get the logged-in student's team details and associated projects."""
    if payload.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access only")

    usn = payload.usn
    if not usn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing USN in token")

    # Use helper functions matching pattern from auth.py and teams.py
    students_coll = get_users_collection()
    teams_coll = get_teams_collection()
    projects_coll = get_projects_collection()

    # Find student by USN - same pattern as auth.py login
    student = students_coll.find_one({"usn": usn})
    
    if not student:
        return {
            "student": None,
            "team": None,
            "projects": [],
            "message": f"Student record not found for USN: {usn}",
        }

    team_id = student.get("team_id")
    if not team_id:
        return {
            "student": _serialize(student),
            "team": None,
            "projects": [],
            "message": "Student is not assigned to any team",
        }

    # Get team details - same pattern as teams.py
    team = teams_coll.find_one({"team_id": team_id})
    
    # Get all projects for this team
    projects: List[Dict[str, Any]] = [*projects_coll.find({"team_id": team_id})]

    return {
        "student": _serialize(student),
        "team": _serialize(team) if team else None,
        "projects": [_serialize(project) for project in projects],
    }


@router.get("/my-search-history")
async def get_my_search_history(
    limit: int = 20, payload: TokenPayload = Depends(require_token)
) -> Dict[str, Any]:
    """Get the logged-in student's search history."""
    if payload.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access only")

    usn = payload.usn
    if not usn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing USN in token")

    search_history_coll = get_search_history_collection()
    projects_coll = get_projects_collection()

    # Get search history sorted by timestamp (newest first)
    history: List[Dict[str, Any]] = [
        *search_history_coll.find({"student_usn": usn})
        .sort("timestamp", -1)
        .limit(limit)
    ]

    # Enrich with project details
    enriched_history = []
    for entry in history:
        matched_pid = entry.get("matched_pid")
        project = None
        if matched_pid:
            project = projects_coll.find_one({"p_id": matched_pid})
        
        enriched_entry = {
            **_serialize(entry),
            "project": _serialize(project) if project else None,
        }
        enriched_history.append(enriched_entry)

    return {
        "usn": usn,
        "total": len(enriched_history),
        "history": enriched_history,
    }

