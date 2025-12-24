"""Service layer exports."""

from .projects import get_project_summary
from .search import analyze_synopsis, search_projects

__all__ = ["search_projects", "analyze_synopsis", "get_project_summary"]
