"""Project insights service leveraging MongoDB."""
from __future__ import annotations

from collections import Counter
from typing import Dict, List

from ..mongo import get_projects_collection


def _top_tech_tags(documents: List[dict], limit: int = 8) -> List[dict]:
    counter: Counter[str] = Counter()
    for doc in documents:
        tech_stack = doc.get("tech_stack") or ""
        if not tech_stack:
            continue
        for raw in tech_stack.split(","):
            tag = raw.strip()
            if not tag or tag.lower() == "none":
                continue
            counter[tag] += 1
    return [
        {
            "tech": tag,
            "count": count,
        }
        for tag, count in counter.most_common(limit)
    ]


def get_project_summary(limit: int = 6) -> Dict[str, object]:
    collection = get_projects_collection()

    total_projects = collection.count_documents({})

    domain_pipeline = [
        {"$match": {"domain": {"$ne": None, "$ne": ""}}},
        {"$group": {"_id": "$domain", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    domain_summary = [
        {"domain": item["_id"], "count": item["count"]}
        for item in collection.aggregate(domain_pipeline)
    ]

    project_pipeline = [
        {"$group": {"_id": "$title", "count": {"$sum": 1}, "sample": {"$first": "$$ROOT"}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    frequent_projects = [
        {
            "title": item.get("_id"),
            "occurrences": item.get("count", 0),
            "domain": item.get("sample", {}).get("domain"),
            "tech_stack": item.get("sample", {}).get("tech_stack"),
            "team_id": item.get("sample", {}).get("team_id"),
        }
        for item in collection.aggregate(project_pipeline)
    ]

    documents = list(collection.find({}, {"tech_stack": 1, "year": 1}).limit(1000))
    top_tags = _top_tech_tags(documents, limit=10)

    year_counter: Counter[str] = Counter()
    for doc in documents:
        year = str(doc.get("year")) if doc.get("year") else "Unknown"
        year_counter[year] += 1
    year_distribution = [
        {"year": year, "count": count}
        for year, count in sorted(year_counter.items(), key=lambda x: x[0], reverse=True)
    ]

    return {
        "total_projects": total_projects,
        "top_domains": domain_summary,
        "frequent_projects": frequent_projects,
        "top_tech_tags": top_tags,
        "year_distribution": year_distribution,
    }
