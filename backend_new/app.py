"""FastAPI application wiring for the standalone backend."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import routers
from .embedder import DimensionMismatchError, ensure_model_matches_store
from .settings import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_probe() -> None:
    try:
        dim = ensure_model_matches_store()
        logger.info("Chroma store ready with embedding dim=%s", dim)
    except DimensionMismatchError as exc:
        logger.error("Embedder dimension mismatch: %s", exc)
        raise


for router in routers:
    app.include_router(router)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "model_backend": settings.model_backend,
        "model_name": settings.model_name,
    }
