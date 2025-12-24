"""API routers for the standalone backend."""

from .analyze import router as analyze_router
from .auth import router as auth_router
from .debug import router as debug_router
from .projects import router as projects_router
from .search import router as search_router
from .students import router as students_router
from .teams import router as teams_router

routers = [auth_router, search_router, analyze_router, projects_router, teams_router, students_router, debug_router]

__all__ = ["routers"]
