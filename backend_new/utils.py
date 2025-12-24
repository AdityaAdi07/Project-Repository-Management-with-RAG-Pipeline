"""Utility functions for similarity metrics and scoring."""
from __future__ import annotations

from typing import Iterable, List, Sequence

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def to_percent(value: float) -> float:
    return round(float(value) * 100.0, 2)


def as_1d_array(vector: Sequence[float] | np.ndarray | None) -> np.ndarray | None:
    if vector is None:
        return None
    arr = np.asarray(vector, dtype=np.float32)
    if arr.ndim == 2 and arr.shape[0] == 1:
        arr = arr[0]
    if arr.ndim > 1:
        arr = arr.reshape(-1)
    return arr


def normalize_to_dim(vector: Sequence[float] | np.ndarray | None, target_dim: int) -> np.ndarray | None:
    arr = as_1d_array(vector)
    if arr is None:
        return None
    target_dim = int(target_dim)
    if target_dim <= 0:
        return arr
    if arr.shape[0] == target_dim:
        return arr
    if arr.shape[0] > target_dim:
        return arr[:target_dim]
    pad = np.zeros(target_dim - arr.shape[0], dtype=np.float32)
    return np.concatenate([arr, pad])


def safe_cosine(a: np.ndarray | Sequence[float] | None, b: np.ndarray | Sequence[float] | None) -> float:
    va = as_1d_array(a)
    vb = as_1d_array(b)
    if va is None or vb is None:
        return 0.0
    if np.linalg.norm(va) == 0 or np.linalg.norm(vb) == 0:
        return 0.0
    va = va.reshape(1, -1)
    vb = vb.reshape(1, -1)
    return float(cosine_similarity(va, vb)[0][0])


def bag_of_words_similarity(text_a: str, text_b: str) -> float:
    texts = [text_a or "", text_b or ""]
    vectorizer = CountVectorizer().fit(texts)
    bow_a = vectorizer.transform([texts[0]]).toarray()
    bow_b = vectorizer.transform([texts[1]]).toarray()
    if bow_a.size == 0 or bow_b.size == 0:
        return 0.0
    a = bow_a[0]
    b = bow_b[0]
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def dedupe_by_title(results: Iterable[dict], limit: int) -> List[dict]:
    seen = set()
    deduped: List[dict] = []
    for result in results:
        title = result.get("title") or result.get("project_title") or ""
        if title not in seen:
            seen.add(title)
            deduped.append(result)
        if len(deduped) >= limit:
            break
    return deduped
