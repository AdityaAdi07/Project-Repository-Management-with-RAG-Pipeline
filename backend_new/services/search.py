"""
Search and analysis services built on top of the Chroma AUG store.
"""
from __future__ import annotations

from typing import Iterable, List, Tuple
import numpy as np

from ..chroma import get_collection
from ..embedder import embed_text, ensure_model_matches_store, get_vector_dimension
from ..llm import get_llm_client
from ..utils import (
    as_1d_array,
    bag_of_words_similarity,
    dedupe_by_title,
    normalize_to_dim,
    safe_cosine,
    to_percent,
)


# =====================================================================
# INTERNAL QUERY
# =====================================================================
def _collection_query(query_vector: np.ndarray, top_k: int):
    coll = get_collection()
    return coll.query(
        query_embeddings=[query_vector.tolist()],
        n_results=top_k,
        include=["metadatas", "documents", "distances", "embeddings"],
    )


# =====================================================================
# PREPARE FIELD EMBEDDINGS
# =====================================================================
def _prepare_field_embeddings(meta: dict, document: str, target_dim: int):
    title = meta.get("title") or ""
    description = meta.get("description") or document or ""
    tech_stack = meta.get("tech_stack") or ""
    objective = meta.get("objective") or ""
    domain = meta.get("domain") or ""

    fields = {
        "title": title,
        "description": description,
        "tech_stack": tech_stack,
        "objective": objective,
        "domain": domain,
    }

    embeddings: dict[str, np.ndarray | None] = {}
    for key, text in fields.items():
        embeddings[key] = (
            normalize_to_dim(embed_text(text), target_dim) if text else None
        )

    return fields, embeddings


# =====================================================================
# PROJECT SEARCH
# =====================================================================
def search_projects(query: str, top_k: int = 5) -> List[dict]:
    ensure_model_matches_store()
    target_dim = get_vector_dimension()

    query_emb = normalize_to_dim(embed_text(query), target_dim)
    raw = _collection_query(query_emb, top_k * 4)

    ids = raw.get("ids", [[]])[0]
    documents = raw.get("documents", [[]])[0]
    metadatas = raw.get("metadatas", [[]])[0]
    stored_embs = raw.get("embeddings", [[]])[0]

    results: List[dict] = []

    for idx, project_id in enumerate(ids):
        meta = metadatas[idx] if idx < len(metadatas) else {}
        doc = documents[idx] if idx < len(documents) else ""
        stored_vec = normalize_to_dim(as_1d_array(stored_embs[idx]), target_dim)

        fields, femb = _prepare_field_embeddings(meta, doc, target_dim)

        # similarity scores
        sim_whole = safe_cosine(query_emb, stored_vec)
        sim_title = safe_cosine(query_emb, femb.get("title"))
        sim_description = safe_cosine(query_emb, femb.get("description"))
        sim_tech = safe_cosine(query_emb, femb.get("tech_stack"))
        sim_objective = safe_cosine(query_emb, femb.get("objective"))
        sim_domain = safe_cosine(query_emb, femb.get("domain"))

        field_avg = np.mean(
            [x for x in [sim_title, sim_description, sim_tech, sim_objective, sim_domain] if x is not None]
        ) if any([sim_title, sim_description, sim_tech, sim_objective, sim_domain]) else 0.0

        bow_sim = bag_of_words_similarity(query, doc)

        final_score = (
            0.55 * sim_whole +
            0.30 * field_avg +
            0.15 * bow_sim
        )

        results.append({
            "project_id": project_id,
            "title": fields["title"] or doc[:80],
            "domain": fields["domain"],
            "tech_stack": fields["tech_stack"],
            "objective": fields["objective"],
            "snippet": doc[:400],
            "whole_similarity": to_percent(sim_whole),
            "bow_similarity": to_percent(bow_sim),
            "final_similarity": to_percent(final_score),
            "field_scores": {
                "title": to_percent(sim_title),
                "description": to_percent(sim_description),
                "tech_stack": to_percent(sim_tech),
                "domain": to_percent(sim_domain),
                "objective": to_percent(sim_objective),
            },
        })

    return dedupe_by_title(sorted(results, key=lambda r: r["final_similarity"], reverse=True), limit=top_k)


# =====================================================================
# SYNOPSIS ANALYSIS + Llama Evaluation
# =====================================================================
def analyze_synopsis(synopsis: dict, top_k: int = 8) -> Tuple[List[dict], str]:
    ensure_model_matches_store()
    target_dim = get_vector_dimension()

    # combine text for embedding
    combined_text = " ".join(
        filter(None, [
            synopsis.get("title"),
            synopsis.get("description"),
            synopsis.get("tech_stack"),
            synopsis.get("domain"),
            synopsis.get("objective"),
        ])
    ).strip()

    if not combined_text:
        combined_text = synopsis.get("description", "")

    # main embeddings
    embeddings = {
        "whole": normalize_to_dim(embed_text(combined_text), target_dim),
        "title": normalize_to_dim(embed_text(synopsis.get("title", "")), target_dim) if synopsis.get("title") else None,
        "description": normalize_to_dim(embed_text(synopsis.get("description", "")), target_dim) if synopsis.get("description") else None,
        "tech_stack": normalize_to_dim(embed_text(synopsis.get("tech_stack", "")), target_dim) if synopsis.get("tech_stack") else None,
        "domain": normalize_to_dim(embed_text(synopsis.get("domain", "")), target_dim) if synopsis.get("domain") else None,
        "objective": normalize_to_dim(embed_text(synopsis.get("objective", "")), target_dim) if synopsis.get("objective") else None,
    }

    # query Chroma
    raw = _collection_query(embeddings["whole"], top_k * 4)
    ids = raw.get("ids", [[]])[0]
    documents = raw.get("documents", [[]])[0]
    metadatas = raw.get("metadatas", [[]])[0]
    stored_embs = raw.get("embeddings", [[]])[0]

    llm = get_llm_client()

    rows: List[dict] = []

    for idx, project_id in enumerate(ids):
        meta = metadatas[idx] if idx < len(metadatas) else {}
        doc = documents[idx]
        stored_vec = normalize_to_dim(as_1d_array(stored_embs[idx]), target_dim)

        fields, femb = _prepare_field_embeddings(meta, doc, target_dim)

        sim_whole = safe_cosine(embeddings["whole"], stored_vec)
        sim_title = safe_cosine(embeddings["title"], femb.get("title"))
        sim_description = safe_cosine(embeddings["description"], femb.get("description"))
        sim_tech = safe_cosine(embeddings["tech_stack"], femb.get("tech_stack"))
        sim_domain = safe_cosine(embeddings["domain"], femb.get("domain"))
        sim_objective = safe_cosine(embeddings["objective"], femb.get("objective"))

        bow_sim = bag_of_words_similarity(combined_text, doc)

        # === NEW improved contextual similarity (llama-based) ===
        contextual = llm.score_similarity(
            query_text=combined_text,
            doc_text=doc
        )

        final_score = (
            0.40 * sim_whole +
            0.20 * ((sim_title + sim_description + sim_tech + sim_domain + sim_objective) / 5.0) +
            0.15 * bow_sim +
            0.25 * (contextual / 100.0)
        )

        rows.append({
            "project_id": project_id,
            "title": fields["title"] or doc[:80],
            "domain": fields["domain"],
            "tech_stack": fields["tech_stack"],
            "objective": fields["objective"],
            "snippet": doc[:400],
            "whole_similarity": to_percent(sim_whole),
            "bow_similarity": to_percent(bow_sim),
            "contextual_similarity": contextual,
            "final_similarity": to_percent(final_score),
            "field_scores": {
                "title": to_percent(sim_title),
                "description": to_percent(sim_description),
                "tech_stack": to_percent(sim_tech),
                "domain": to_percent(sim_domain),
                "objective": to_percent(sim_objective),
            },
        })

    deduped = dedupe_by_title(
        sorted(rows, key=lambda r: r["final_similarity"], reverse=True),
        limit=top_k
    )

    # === New llama mega prompt ===
    llm_analysis = llm.analyze_matches(synopsis, deduped)

    return deduped, llm_analysis
