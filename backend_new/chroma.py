"""ChromaDB connectivity and utilities for the standalone backend."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import chromadb

from .settings import get_settings


@dataclass
class ChromaProbe:
    collection: str
    count: Optional[int]
    dim: Optional[int]


class ChromaStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = chromadb.PersistentClient(path=str(settings.chroma_path))
        self._collection_name = settings.chroma_collection
        self._collection = self._client.get_collection(self._collection_name)

    @property
    def collection(self):
        return self._collection

    def probe(self) -> ChromaProbe:
        sample = self._collection.get(limit=1, include=["embeddings"])
        embeddings = sample.get("embeddings") if sample else None
        dim = _extract_first_vector_length(embeddings)
        try:
            count = self._collection.count()
        except Exception:
            count = None
        return ChromaProbe(collection=self._collection_name, count=count, dim=dim)


def _extract_first_vector_length(data: Any) -> Optional[int]:
    """
    Robust extraction of vector dimension from Chroma embeddings.
    Handles:
      - [384 floats]
      - [[384 floats]]
      - [[[384 floats]]]
      - numpy arrays
    """
    if data is None:
        return None

    candidate = data

    # Flatten until we reach the innermost numeric list
    while True:

        # If numpy array, convert to list
        if hasattr(candidate, "shape") and hasattr(candidate, "tolist"):
            candidate = candidate.tolist()

        # Must be list-like
        if not isinstance(candidate, (list, tuple)) or len(candidate) == 0:
            return None

        first = candidate[0]

        # If first element is list-like → go deeper
        if isinstance(first, (list, tuple)):
            candidate = first
            continue

        # First element is a number → candidate is now the vector
        try:
            return len(candidate)
        except Exception:
            return None



_store: Optional[ChromaStore] = None


def get_store() -> ChromaStore:
    global _store
    if _store is None:
        _store = ChromaStore()
    return _store


def get_collection():
    return get_store().collection


def probe_store() -> ChromaProbe:
    return get_store().probe()
