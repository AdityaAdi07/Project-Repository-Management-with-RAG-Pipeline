"""MongoDB connectivity helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from pymongo import MongoClient
from pymongo.collection import Collection

from .settings import get_settings

_client: Optional[MongoClient] = None


@dataclass
class MongoStatus:
    ok: bool
    error: Optional[str] = None


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = MongoClient(settings.mongo_uri)
    return _client


def get_database():
    settings = get_settings()
    return _get_client()[settings.mongo_database]


def get_users_collection() -> Collection:
    settings = get_settings()
    return get_database()[settings.mongo_users_collection]


def get_faculty_collection() -> Collection:
    settings = get_settings()
    return get_database()[settings.mongo_faculty_collection]


def get_projects_collection() -> Collection:
    settings = get_settings()
    return get_database()[settings.mongo_projects_collection]


def get_teams_collection() -> Collection:
    settings = get_settings()
    return get_database()[settings.mongo_teams_collection]


def get_search_history_collection() -> Collection:
    """Get Search_history collection."""
    return get_database()["Search_history"]


def check_connection() -> MongoStatus:
    try:
        _get_client().admin.command("ping")
        return MongoStatus(ok=True)
    except Exception as exc:  # pragma: no cover - diagnostics only
        return MongoStatus(ok=False, error=str(exc))
