"""Embedding utilities compatible with the Chroma AUG store."""
from __future__ import annotations

from functools import lru_cache
from typing import Iterable, List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer

from .chroma import get_collection, probe_store
from .settings import get_settings


class DimensionMismatchError(RuntimeError):
    pass


_TARGET_DIM: Optional[int] = None


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    settings = get_settings()
    return SentenceTransformer(settings.embed_model)


def _ensure_dimension(target_dim: int) -> None:
    settings = get_settings()
    if target_dim == 0:
        raise DimensionMismatchError("Chroma reported zero dimension; store may be empty or corrupted.")
    model = _load_model()
    dummy = model.encode("dimension probe")
    model_dim = dummy.shape[-1]
    if model_dim != target_dim:
        raise DimensionMismatchError(
            f"Model '{settings.embed_model}' outputs {model_dim} dims but Chroma store expects {target_dim}."
        )


def embed_text(text: str) -> np.ndarray:
    vec = _load_model().encode(text)
    return np.asarray(vec, dtype=np.float32)


def embed_texts(texts: Iterable[str]) -> List[np.ndarray]:
    model = _load_model()
    vectors = model.encode(list(texts))
    return [np.asarray(v, dtype=np.float32) for v in vectors]


def ensure_model_matches_store() -> int:
    global _TARGET_DIM
    probe = probe_store()
    dim = probe.dim or 0
    _ensure_dimension(dim)
    _TARGET_DIM = dim
    return dim


def get_vector_dimension() -> int:
    global _TARGET_DIM
    if _TARGET_DIM is None:
        return ensure_model_matches_store()
    return _TARGET_DIM
