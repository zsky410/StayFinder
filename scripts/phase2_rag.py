#!/usr/bin/env python3
"""
StayFinder Phase 2 RAG pipeline.

Implements the LangChain-oriented Phase 2 foundation described in PLAN.md:

1. Build rich place documents from DB-backed structured data
2. Split them with RecursiveCharacterTextSplitter
3. Store chunks in public.ai_place_chunks
4. Embed chunks with OpenAI 1536-dim embeddings
5. Run prototype retrieval with structured filters + vector search
6. Generate/cache AI review summaries per place
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable

from psycopg2.extras import Json, RealDictCursor, execute_batch

try:
    from db_env import connect_from_env, load_project_env
except ImportError:  # pragma: no cover
    from scripts.db_env import connect_from_env, load_project_env

try:
    from langchain_anthropic import ChatAnthropic
    from langchain_core.documents import Document
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing Phase 2 dependencies. Run: pip install -r requirements.txt"
    ) from exc


DEFAULT_BATCH_KEY = "danang_accommodations_batch_20260323_082743"
DEFAULT_EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL") or "text-embedding-3-small"
DEFAULT_CHAT_MODEL = os.environ.get("RAG_CHAT_MODEL") or "gpt-5.4"
DEFAULT_CHAT_PROVIDER = os.environ.get("RAG_CHAT_PROVIDER") or "openai_compatible"
DEFAULT_CHAT_BASE_URL = "http://127.0.0.1:8080/v1"
DEFAULT_CHAT_API_KEY = "pwd"
DEFAULT_PROMPT_VERSION = "phase2-v2-review-only"
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 180

TYPE_ALIASES: dict[str, list[str]] = {
    "hotel": ["hotel", "khach san", "khách sạn"],
    "homestay": ["homestay", "home stay"],
    "hostel": ["hostel", "dorm"],
    "villa": ["villa"],
    "resort": ["resort", "khu nghi duong", "nghỉ dưỡng"],
    "can-ho": ["can ho", "căn hộ", "apartment"],
    "can-ho-dich-vu": ["can ho dich vu", "căn hộ dịch vụ", "serviced apartment"],
    "nha-nghi": ["nha nghi", "nhà nghỉ", "guesthouse"],
    "nha-khach": ["nha khach", "nhà khách"],
    "nha-tro": ["nha tro", "nhà trọ"],
}

AMENITY_ALIASES: dict[str, list[str]] = {
    "ho boi": ["Bể bơi trong nhà và ngoài trời"],
    "be boi": ["Bể bơi trong nhà và ngoài trời"],
    "pool": ["Bể bơi trong nhà và ngoài trời"],
    "wifi": ["Wi-Fi miễn phí"],
    "spa": ["Spa"],
    "gym": ["Trung tâm thể dục"],
    "phong gym": ["Trung tâm thể dục"],
    "dua don san bay": ["Xe đưa đón ra sân bay"],
    "san bay shuttle": ["Xe đưa đón ra sân bay"],
    "an sang": ["Bữa sáng có tính phí"],
    "family": ["Phù hợp với trẻ em"],
    "gia dinh": ["Phù hợp với trẻ em"],
    "tre em": ["Phù hợp với trẻ em"],
    "pet": ["Chấp nhận vật nuôi"],
    "thu cung": ["Chấp nhận vật nuôi"],
    "do xe": ["Đỗ xe miễn phí"],
    "parking": ["Đỗ xe miễn phí"],
}

ZONE_BY_LANDMARK: dict[str, str] = {
    "an-thuong": "an-thuong-zone",
    "my-khe-beach": "my-khe-strip",
    "da-nang-airport": "airport-corridor",
}


@dataclass
class StructuredIntent:
    raw_query: str
    normalized_query: str
    type_slugs: list[str] = field(default_factory=list)
    landmark_slugs: list[str] = field(default_factory=list)
    zone_slugs: list[str] = field(default_factory=list)
    amenity_labels: list[str] = field(default_factory=list)
    min_rating: float | None = None
    max_distance_m: int | None = None
    signals: list[str] = field(default_factory=list)

    @property
    def has_filters(self) -> bool:
        return bool(
            self.type_slugs
            or self.landmark_slugs
            or self.zone_slugs
            or self.amenity_labels
            or self.min_rating is not None
            or self.max_distance_m is not None
        )


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value.casefold().replace("đ", "d"))
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[^a-z0-9\s]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float, Decimal)):
        return int(value)
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def unique_preserve(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        clean = str(value).strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        output.append(clean)
    return output


def format_distance_m(value: Any) -> str:
    distance = as_int(value)
    if distance is None:
        return "unknown distance"
    if distance >= 1000:
        return f"{distance / 1000:.1f} km"
    return f"{distance} m"


def chunk_md5(content: str) -> str:
    return hashlib.md5(content.encode("utf-8")).hexdigest()


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{float(value):.12f}" for value in values) + "]"


def get_embed_api_key() -> str | None:
    return os.environ.get("RAG_EMBED_API_KEY") or os.environ.get("OPENAI_API_KEY")


def get_embed_base_url() -> str | None:
    return os.environ.get("RAG_EMBED_BASE_URL") or os.environ.get("OPENAI_BASE_URL")


def get_chat_api_key() -> str | None:
    return os.environ.get("RAG_CHAT_API_KEY") or os.environ.get("OPENAI_API_KEY") or DEFAULT_CHAT_API_KEY


def get_chat_base_url() -> str | None:
    return os.environ.get("RAG_CHAT_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or DEFAULT_CHAT_BASE_URL


def get_chat_provider() -> str:
    return (os.environ.get("RAG_CHAT_PROVIDER") or DEFAULT_CHAT_PROVIDER).strip().lower()


def response_text(response: Any) -> str:
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text))
            else:
                text = getattr(item, "text", None)
                if text:
                    parts.append(str(text))
        return "\n".join(part for part in parts if part.strip()).strip()
    return str(content).strip()


def build_where_filters(
    *,
    batch_key: str | None,
    place_ids: list[str] | None,
    title_search: str | None,
) -> tuple[str, list[Any]]:
    clauses = ["1=1"]
    params: list[Any] = []
    if batch_key:
        clauses.append("b.batch_key = %s")
        params.append(batch_key)
    if place_ids:
        clauses.append("p.place_id = ANY(%s)")
        params.append(place_ids)
    if title_search:
        clauses.append("p.title ILIKE %s")
        params.append(f"%{title_search}%")
    return " AND ".join(clauses), params


def fetch_places_bundle(
    conn,
    *,
    batch_key: str | None,
    place_ids: list[str] | None,
    title_search: str | None,
    limit: int | None,
) -> list[dict[str, Any]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        where_sql, params = build_where_filters(
            batch_key=batch_key,
            place_ids=place_ids,
            title_search=title_search,
        )
        sql = f"""
            SELECT
                p.id,
                p.place_id,
                b.batch_key,
                p.type_slug,
                p.type_label,
                p.title,
                p.description,
                p.category_name,
                p.address,
                p.neighborhood,
                p.district,
                p.city,
                p.state,
                p.country_code,
                p.phone,
                p.website,
                p.lat,
                p.lng,
                p.rating,
                p.reviews_count,
                p.image_url,
                p.price_text,
                p.hotel_description,
                p.additional_info,
                p.opening_hours,
                p.crawl_search_terms
            FROM places p
            LEFT JOIN crawl_batches b ON b.id = p.batch_id
            WHERE {where_sql}
            ORDER BY p.reviews_count DESC NULLS LAST, p.rating DESC NULLS LAST, p.title ASC
        """
        if limit is not None:
            sql += " LIMIT %s"
            params.append(limit)
        cur.execute(sql, params)
        places = [dict(row) for row in cur.fetchall()]
        if not places:
            return []

        ids = [row["id"] for row in places]

        cur.execute(
            """
            SELECT place_id, image_url, sort_order
            FROM place_images
            WHERE place_id = ANY(%s::uuid[])
            ORDER BY place_id, sort_order
            """,
            (ids,),
        )
        images_by_place: dict[Any, list[str]] = defaultdict(list)
        for row in cur.fetchall():
            images_by_place[row["place_id"]].append(row["image_url"])

        cur.execute(
            """
            SELECT
                r.place_id,
                r.stars,
                r.review_text,
                r.text_translated,
                r.likes_count,
                r.published_at
            FROM reviews r
            WHERE r.place_id = ANY(%s::uuid[])
            ORDER BY r.place_id, r.likes_count DESC NULLS LAST, r.published_at DESC NULLS LAST
            """,
            (ids,),
        )
        reviews_by_place: dict[Any, list[dict[str, Any]]] = defaultdict(list)
        for row in cur.fetchall():
            reviews_by_place[row["place_id"]].append(dict(row))

        cur.execute(
            """
            SELECT pa.place_id, a.label
            FROM place_amenities pa
            JOIN amenities a ON a.id = pa.amenity_id
            WHERE pa.place_id = ANY(%s::uuid[])
            ORDER BY pa.place_id, a.label
            """,
            (ids,),
        )
        amenities_by_place: dict[Any, list[str]] = defaultdict(list)
        for row in cur.fetchall():
            amenities_by_place[row["place_id"]].append(row["label"])

        cur.execute(
            """
            SELECT
                plm.place_id,
                l.slug,
                l.name,
                plm.distance_m,
                plm.anchor_label
            FROM place_landmark_metrics plm
            JOIN local_landmarks l ON l.id = plm.landmark_id
            WHERE plm.place_id = ANY(%s::uuid[])
            ORDER BY plm.place_id, plm.distance_m ASC NULLS LAST, l.slug ASC
            """,
            (ids,),
        )
        landmarks_by_place: dict[Any, list[dict[str, Any]]] = defaultdict(list)
        for row in cur.fetchall():
            landmarks_by_place[row["place_id"]].append(
                {
                    "slug": row["slug"],
                    "name": row["name"],
                    "distance_m": as_int(row["distance_m"]),
                    "anchor_label": row["anchor_label"],
                }
            )

    for place in places:
        pid = place["id"]
        place["images"] = images_by_place.get(pid, [])
        place["reviews"] = reviews_by_place.get(pid, [])
        place["amenities"] = amenities_by_place.get(pid, [])
        place["landmarks"] = landmarks_by_place.get(pid, [])
    return places


def load_context_notes(conn) -> dict[str, dict[str, list[dict[str, Any]]]]:
    notes = {"city": defaultdict(list), "zone": defaultdict(list), "landmark": defaultdict(list)}
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT slug, title, subject_kind, subject_slug, content, tags, metadata
            FROM local_context_notes
            ORDER BY slug
            """
        )
        for row in cur.fetchall():
            bucket = notes.get(row["subject_kind"])
            if bucket is None:
                continue
            bucket[row["subject_slug"] or row["slug"]].append(dict(row))
    return notes


def load_landmark_catalog(conn) -> list[dict[str, Any]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT slug, name, metadata FROM local_landmarks ORDER BY slug")
        return [dict(row) for row in cur.fetchall()]


def load_amenity_catalog(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT label FROM amenities ORDER BY label")
        return [row[0] for row in cur.fetchall()]


def select_review_snippets(reviews: list[dict[str, Any]], *, limit: int = 4) -> list[str]:
    snippets: list[str] = []
    for review in reviews:
        text = str(review.get("review_text") or review.get("text_translated") or "").strip()
        if not text:
            continue
        text = re.sub(r"\s+", " ", text)
        snippets.append(text[:220].strip())
        if len(snippets) >= limit:
            break
    return unique_preserve(snippets)


def derive_tags(place: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    amenities = {normalize_text(label): label for label in place.get("amenities") or []}
    landmark_slugs = [entry["slug"] for entry in place.get("landmarks")[:3]]

    if any("tre em" in key for key in amenities):
        tags.append("family-friendly")
    if any("thu cung" in key for key in amenities):
        tags.append("pet-friendly")
    if any("spa" in key for key in amenities):
        tags.append("spa")
    if any("trung tam the duc" in key or "gym" in key for key in amenities):
        tags.append("fitness")
    if "my-khe-beach" in landmark_slugs:
        tags.append("beach-access")
    if "da-nang-airport" in landmark_slugs:
        tags.append("airport-convenience")
    if "dragon-bridge" in landmark_slugs or "han-bridge" in landmark_slugs:
        tags.append("central-riverfront")
    return unique_preserve(tags)


def select_context_for_place(
    place: dict[str, Any],
    notes_bundle: dict[str, dict[str, list[dict[str, Any]]]],
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add_notes(items: Iterable[dict[str, Any]]) -> None:
        for note in items:
            slug = note["slug"]
            if slug in seen:
                continue
            seen.add(slug)
            selected.append(note)

    add_notes(notes_bundle["city"].get("da-nang", []))

    for landmark in place.get("landmarks")[:3]:
        add_notes(notes_bundle["landmark"].get(landmark["slug"], []))
        zone_slug = ZONE_BY_LANDMARK.get(landmark["slug"])
        if zone_slug:
            add_notes(notes_bundle["zone"].get(zone_slug, []))

    return selected[:4]


def build_base_chunk_metadata(
    place: dict[str, Any],
    *,
    chunk_kind: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    title = place.get("title") or "Unknown place"
    rating = as_float(place.get("rating"))
    reviews_count = as_int(place.get("reviews_count"))
    amenities = place.get("amenities") or []
    landmarks = place.get("landmarks") or []
    tags = derive_tags(place)

    metadata = {
        "place_uuid": str(place["id"]),
        "place_id": place["place_id"],
        "batch_key": place.get("batch_key"),
        "title": title,
        "type_slug": place.get("type_slug"),
        "district": place.get("district"),
        "neighborhood": place.get("neighborhood"),
        "city": place.get("city"),
        "rating": rating,
        "reviews_count": reviews_count,
        "amenity_labels": amenities[:24],
        "nearest_landmarks": [
            {
                "slug": entry["slug"],
                "name": entry["name"],
                "distance_m": entry["distance_m"],
            }
            for entry in landmarks[:8]
        ],
        "derived_tags": tags,
        "chunk_kind": chunk_kind,
        "source": "phase2-rag",
    }
    if extra:
        metadata.update(extra)
    return metadata


def build_place_profile_text(place: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    title = place.get("title") or "Unknown place"
    type_label = place.get("type_label") or place.get("type_slug") or "stay"
    rating = as_float(place.get("rating"))
    reviews_count = as_int(place.get("reviews_count"))
    tags = derive_tags(place)

    lines: list[str] = [
        f"Place: {title}",
        f"Type: {type_label}",
    ]
    if place.get("category_name"):
        lines.append(f"Category: {place['category_name']}")
    if place.get("address"):
        lines.append(f"Address: {place['address']}")
    location_bits = [bit for bit in [place.get("neighborhood"), place.get("district"), place.get("city")] if bit]
    if location_bits:
        lines.append(f"Area: {', '.join(unique_preserve(location_bits))}")
    if rating is not None:
        rating_line = f"Rating: {rating:.2f}/5"
        if reviews_count is not None:
            rating_line += f" from {reviews_count} reviews"
        lines.append(rating_line)
    elif reviews_count is not None:
        lines.append(f"Reviews count: {reviews_count}")
    if place.get("description"):
        lines.append(f"Description: {str(place['description']).strip()}")
    if place.get("hotel_description"):
        lines.append(f"Hotel description: {str(place['hotel_description']).strip()}")
    if place.get("price_text"):
        lines.append(f"Price text: {place['price_text']}")
    lines.append(f"Phone available: {'yes' if place.get('phone') else 'no'}")
    lines.append(f"Website available: {'yes' if place.get('website') else 'no'}")
    if tags:
        lines.append(f"Derived stay tags: {', '.join(tags)}")

    return "\n".join(line for line in lines if line.strip()), build_base_chunk_metadata(
        place,
        chunk_kind="place_profile",
    )


def build_amenity_text(place: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    amenities = place.get("amenities") or []
    tags = derive_tags(place)
    if not amenities and not tags:
        return None

    title = place.get("title") or "Unknown place"
    lines = [f"Place amenities and suitability signals for {title}."]
    if amenities:
        lines.append("Amenities: " + ", ".join(amenities[:32]))
    if tags:
        lines.append("Derived stay tags: " + ", ".join(tags))

    return "\n".join(lines), build_base_chunk_metadata(
        place,
        chunk_kind="amenity_profile",
        extra={"amenity_count": len(amenities)},
    )


def build_landmark_text(place: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    landmarks = place.get("landmarks") or []
    if not landmarks:
        return None

    title = place.get("title") or "Unknown place"
    lines = [
        f"Nearby landmarks for {title}.",
        "Distances are bird-flight haversine distances unless OSRM route metrics are shown elsewhere.",
    ]
    for entry in landmarks[:8]:
        anchor_label = entry.get("anchor_label")
        suffix = f", anchor {anchor_label}" if anchor_label else ""
        lines.append(f"- {entry['name']} ({format_distance_m(entry['distance_m'])}{suffix})")

    return "\n".join(lines), build_base_chunk_metadata(
        place,
        chunk_kind="landmark_proximity",
        extra={"landmark_count": len(landmarks)},
    )


def build_review_text(place: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    reviews = place.get("reviews") or []
    snippets: list[str] = []
    for review in reviews:
        text = str(review.get("review_text") or review.get("text_translated") or "").strip()
        if not text:
            continue
        text = re.sub(r"\s+", " ", text)
        prefix_bits = []
        if review.get("stars") is not None:
            prefix_bits.append(f"{review['stars']} stars")
        if review.get("likes_count") is not None:
            prefix_bits.append(f"{review['likes_count']} likes")
        prefix = f" ({', '.join(prefix_bits)})" if prefix_bits else ""
        snippets.append(f"- Review{prefix}: {text[:420].strip()}")
        if len(snippets) >= 10:
            break
    snippets = unique_preserve(snippets)
    if not snippets:
        return None

    title = place.get("title") or "Unknown place"
    lines = [f"Guest review evidence for {title}.", *snippets]
    return "\n".join(lines), build_base_chunk_metadata(
        place,
        chunk_kind="review_snippets",
        extra={
            "review_snippet_count": len(snippets),
            "source_review_count": as_int(place.get("reviews_count")) or len(reviews),
        },
    )


def build_local_context_text(
    place: dict[str, Any],
    notes_bundle: dict[str, dict[str, list[dict[str, Any]]]],
) -> tuple[str, dict[str, Any]] | None:
    context_notes = select_context_for_place(place, notes_bundle)
    if not context_notes:
        return None

    title = place.get("title") or "Unknown place"
    lines = [f"Local context relevant to {title}."]
    if context_notes:
        for note in context_notes:
            lines.append(f"- {note['title']}: {note['content']}")

    return "\n".join(lines), build_base_chunk_metadata(
        place,
        chunk_kind="local_context",
        extra={"context_note_slugs": [note["slug"] for note in context_notes]},
    )


def build_raw_documents_for_place(
    place: dict[str, Any],
    notes_bundle: dict[str, dict[str, list[dict[str, Any]]]],
) -> list[Document]:
    sections = [
        build_place_profile_text(place),
        build_amenity_text(place),
        build_landmark_text(place),
        build_review_text(place),
        build_local_context_text(place, notes_bundle),
    ]
    docs: list[Document] = []
    for section_index, item in enumerate(sections):
        if not item:
            continue
        content, metadata = item
        content = content.strip()
        if not content:
            continue
        metadata = dict(metadata)
        metadata["section_index"] = section_index
        docs.append(Document(page_content=content, metadata=metadata))
    return docs


def build_documents_for_place(
    place: dict[str, Any],
    notes_bundle: dict[str, dict[str, list[dict[str, Any]]]],
    splitter: RecursiveCharacterTextSplitter,
) -> list[Document]:
    raw_docs = build_raw_documents_for_place(place, notes_bundle)
    split_docs: list[Document] = []
    for raw_doc in raw_docs:
        section_splits = splitter.split_documents([raw_doc])
        for section_chunk_index, doc in enumerate(section_splits):
            metadata = dict(doc.metadata)
            metadata["section_chunk_index"] = section_chunk_index
            doc.metadata = metadata
            split_docs.append(doc)
    return split_docs


def cmd_chunk(args: argparse.Namespace) -> int:
    load_project_env()
    conn = connect_from_env()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    places = fetch_places_bundle(
        conn,
        batch_key=args.batch_key,
        place_ids=args.place_id or None,
        title_search=args.title_search,
        limit=args.limit,
    )
    if not places:
        print("No places matched the requested filters.", file=sys.stderr)
        return 1

    notes_bundle = load_context_notes(conn)
    total_chunks = 0
    sample_chunks: list[dict[str, Any]] = []
    all_chunk_rows: list[tuple[Any, ...]] = []

    for place in places:
        docs = build_documents_for_place(place, notes_bundle, splitter)
        for idx, doc in enumerate(docs):
            content = doc.page_content.strip()
            if not content:
                continue
            metadata = dict(doc.metadata)
            metadata["chunk_index"] = idx
            metadata["chunk_chars"] = len(content)
            all_chunk_rows.append(
                (
                    place["id"],
                    idx,
                    content,
                    chunk_md5(content),
                    Json(metadata),
                )
            )
            if len(sample_chunks) < args.sample_count:
                sample_chunks.append(
                    {
                        "place_id": place["place_id"],
                        "title": place.get("title"),
                        "chunk_index": idx,
                        "chunk_kind": metadata.get("chunk_kind"),
                        "preview": content[:260],
                    }
                )

    total_chunks = len(all_chunk_rows)

    if not args.dry_run:
        place_uuids = [place["id"] for place in places]
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM ai_place_chunks WHERE place_id = ANY(%s::uuid[])", (place_uuids,))
                if all_chunk_rows:
                    execute_batch(
                        cur,
                        """
                        INSERT INTO ai_place_chunks (
                            place_id,
                            chunk_index,
                            content,
                            content_md5,
                            metadata
                        ) VALUES (%s, %s, %s, %s, %s)
                        """,
                        all_chunk_rows,
                        page_size=500,
                    )

    result = {
        "places_processed": len(places),
        "chunks_built": total_chunks,
        "dry_run": args.dry_run,
        "sample_chunks": sample_chunks,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def ensure_openai_key() -> None:
    if not get_embed_api_key():
        raise SystemExit(
            "Embedding requires RAG_EMBED_API_KEY or OPENAI_API_KEY. "
            "If you use a custom embeddings endpoint, also set RAG_EMBED_BASE_URL."
        )


def ensure_chat_credentials(provider: str | None = None) -> None:
    provider_name = (provider or get_chat_provider()).lower()
    if provider_name == "anthropic":
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit("ANTHROPIC_API_KEY is required when RAG_CHAT_PROVIDER=anthropic.")
        return
    if not get_chat_api_key():
        raise SystemExit(
            "Chat generation requires RAG_CHAT_API_KEY or OPENAI_API_KEY when using "
            "RAG_CHAT_PROVIDER=openai_compatible."
        )


def create_embeddings(model_name: str) -> OpenAIEmbeddings:
    ensure_openai_key()
    kwargs: dict[str, Any] = {
        "model": model_name,
        "api_key": get_embed_api_key(),
    }
    base_url = get_embed_base_url()
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAIEmbeddings(**kwargs)


def create_chat_model(model_name: str, *, temperature: float) -> Any:
    provider = get_chat_provider()
    ensure_chat_credentials(provider)
    if provider == "anthropic":
        return ChatAnthropic(
            model=model_name,
            temperature=temperature,
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
        )
    if provider in ("openai", "openai_compatible", "openai-compatible"):
        kwargs: dict[str, Any] = {
            "model": model_name,
            "api_key": get_chat_api_key(),
        }
        configured_temperature = os.environ.get("RAG_CHAT_TEMPERATURE")
        if configured_temperature not in (None, ""):
            kwargs["temperature"] = float(configured_temperature)
        base_url = get_chat_base_url()
        if base_url:
            kwargs["base_url"] = base_url
        return ChatOpenAI(**kwargs)
    raise SystemExit(
        "Unsupported RAG_CHAT_PROVIDER. Use 'openai_compatible' or 'anthropic'."
    )


def fetch_chunks_for_embedding(
    conn,
    *,
    batch_key: str | None,
    place_ids: list[str] | None,
    only_missing: bool,
    limit: int | None,
) -> list[dict[str, Any]]:
    where = ["1=1"]
    params: list[Any] = []
    if batch_key:
        where.append("b.batch_key = %s")
        params.append(batch_key)
    if place_ids:
        where.append("p.place_id = ANY(%s)")
        params.append(place_ids)
    if only_missing:
        where.append("c.embedding IS NULL")
    sql = f"""
        SELECT c.id, c.content
        FROM ai_place_chunks c
        JOIN places p ON p.id = c.place_id
        LEFT JOIN crawl_batches b ON b.id = p.batch_id
        WHERE {' AND '.join(where)}
        ORDER BY p.title ASC, c.chunk_index ASC
    """
    if limit is not None:
        sql += " LIMIT %s"
        params.append(limit)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def cmd_embed(args: argparse.Namespace) -> int:
    load_project_env()
    ensure_openai_key()
    conn = connect_from_env()
    rows = fetch_chunks_for_embedding(
        conn,
        batch_key=args.batch_key,
        place_ids=args.place_id or None,
        only_missing=not args.refresh,
        limit=args.limit,
    )
    if not rows:
        print(json.dumps({"chunks_embedded": 0, "message": "No chunks matched."}, indent=2))
        return 0

    embeddings = create_embeddings(args.model)
    updated = 0

    with conn:
        with conn.cursor() as cur:
            for start in range(0, len(rows), args.batch_size):
                batch = rows[start : start + args.batch_size]
                vectors = embeddings.embed_documents([row["content"] for row in batch])
                update_rows: list[tuple[str, Any]] = []
                for row, vector in zip(batch, vectors, strict=True):
                    if len(vector) != 1536:
                        raise SystemExit(
                            f"Embedding dimension mismatch for chunk {row['id']}: got {len(vector)}, expected 1536."
                        )
                    update_rows.append((vector_literal(vector), row["id"]))
                execute_batch(
                    cur,
                    "UPDATE ai_place_chunks SET embedding = %s::vector WHERE id = %s",
                    update_rows,
                )
                updated += len(update_rows)

    print(
        json.dumps(
            {
                "chunks_embedded": updated,
                "model": args.model,
                "refresh": args.refresh,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def build_validation_where(batch_key: str | None) -> tuple[str, list[Any]]:
    if not batch_key:
        return "1=1", []
    return "b.batch_key = %s", [batch_key]


def cmd_validate(args: argparse.Namespace) -> int:
    load_project_env()
    conn = connect_from_env()
    batch_key = None if args.all_batches else args.batch_key
    where_sql, params = build_validation_where(batch_key)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"""
            SELECT
                COUNT(*)::bigint AS chunks_total,
                COUNT(*) FILTER (WHERE c.embedding IS NOT NULL)::bigint AS chunks_with_embeddings,
                COUNT(*) FILTER (WHERE c.embedding IS NULL)::bigint AS chunks_missing_embeddings,
                COUNT(*) FILTER (
                    WHERE c.content_md5 IS DISTINCT FROM md5(c.content)
                )::bigint AS chunks_with_stale_hash,
                COUNT(DISTINCT c.place_id)::bigint AS places_with_chunks
            FROM ai_place_chunks c
            JOIN places p ON p.id = c.place_id
            LEFT JOIN crawl_batches b ON b.id = p.batch_id
            WHERE {where_sql}
            """,
            params,
        )
        chunk_stats = dict(cur.fetchone() or {})

        cur.execute(
            f"""
            SELECT COUNT(*)::bigint AS places_total
            FROM places p
            LEFT JOIN crawl_batches b ON b.id = p.batch_id
            WHERE {where_sql}
            """,
            params,
        )
        place_stats = dict(cur.fetchone() or {})

        cur.execute(
            f"""
            SELECT
                COALESCE(c.metadata->>'chunk_kind', 'unknown') AS chunk_kind,
                COUNT(*)::bigint AS row_count,
                COUNT(*) FILTER (WHERE c.embedding IS NOT NULL)::bigint AS embedded_count
            FROM ai_place_chunks c
            JOIN places p ON p.id = c.place_id
            LEFT JOIN crawl_batches b ON b.id = p.batch_id
            WHERE {where_sql}
            GROUP BY COALESCE(c.metadata->>'chunk_kind', 'unknown')
            ORDER BY row_count DESC, chunk_kind ASC
            """,
            params,
        )
        chunk_kinds = [dict(row) for row in cur.fetchall()]

        cur.execute(
            f"""
            SELECT
                p.place_id,
                p.title
            FROM places p
            LEFT JOIN crawl_batches b ON b.id = p.batch_id
            LEFT JOIN ai_place_chunks c ON c.place_id = p.id
            WHERE {where_sql}
            GROUP BY p.id, p.place_id, p.title
            HAVING COUNT(c.id) = 0
            ORDER BY p.title ASC NULLS LAST
            LIMIT %s
            """,
            [*params, args.sample_limit],
        )
        places_without_chunks = [dict(row) for row in cur.fetchall()]

        cur.execute(
            """
            SELECT
                to_regclass('public.idx_ai_place_chunks_embedding_cosine')::text AS vector_index,
                to_regclass('public.idx_ai_place_chunks_metadata_gin')::text AS metadata_index
            """
        )
        index_stats = dict(cur.fetchone() or {})

        cur.execute(
            f"""
            SELECT COUNT(*)::bigint AS review_summaries
            FROM ai_review_summaries ars
            JOIN places p ON p.id = ars.place_id
            LEFT JOIN crawl_batches b ON b.id = p.batch_id
            WHERE {where_sql}
            """,
            params,
        )
        summary_stats = dict(cur.fetchone() or {})

    places_total = int(place_stats.get("places_total") or 0)
    places_with_chunks = int(chunk_stats.get("places_with_chunks") or 0)
    chunks_total = int(chunk_stats.get("chunks_total") or 0)
    missing_embeddings = int(chunk_stats.get("chunks_missing_embeddings") or 0)
    stale_hashes = int(chunk_stats.get("chunks_with_stale_hash") or 0)
    missing_places_count = max(places_total - places_with_chunks, 0)
    healthy = (
        places_total > 0
        and chunks_total > 0
        and missing_embeddings == 0
        and stale_hashes == 0
        and missing_places_count == 0
        and bool(index_stats.get("vector_index"))
    )

    payload = {
        "batch_key": batch_key,
        "healthy": healthy,
        "places_total": places_total,
        "places_with_chunks": places_with_chunks,
        "places_without_chunks": missing_places_count,
        **chunk_stats,
        **summary_stats,
        "chunk_kinds": chunk_kinds,
        "indexes": index_stats,
        "sample_places_without_chunks": places_without_chunks,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
    return 0 if healthy or args.allow_unhealthy else 1


def build_landmark_alias_map(landmarks: list[dict[str, Any]]) -> dict[str, str]:
    alias_map: dict[str, str] = {}
    for landmark in landmarks:
        slug = landmark["slug"]
        name = landmark["name"]
        candidates = {
            normalize_text(slug.replace("-", " ")),
            normalize_text(name),
            normalize_text(name.split("(")[0]),
        }
        metadata = landmark.get("metadata") or {}
        if isinstance(metadata, dict):
            for key in ("anchorLabel", "area"):
                value = metadata.get(key)
                if value:
                    candidates.add(normalize_text(str(value)))
        for candidate in candidates:
            if candidate:
                alias_map[candidate] = slug

    alias_map.update(
        {
            "cau rong": "dragon-bridge",
            "dragon bridge": "dragon-bridge",
            "cau song han": "han-bridge",
            "han bridge": "han-bridge",
            "bai bien my khe": "my-khe-beach",
            "my khe": "my-khe-beach",
            "san bay da nang": "da-nang-airport",
            "da nang airport": "da-nang-airport",
            "cho han": "han-market",
            "an thuong": "an-thuong",
            "ban dao son tra": "son-tra-peninsula",
            "son tra": "son-tra-peninsula",
            "ngu hanh son": "marble-mountains",
            "marble mountains": "marble-mountains",
        }
    )
    return alias_map


def parse_structured_intent(
    query: str,
    *,
    landmark_aliases: dict[str, str],
    amenity_labels: list[str],
) -> StructuredIntent:
    normalized = normalize_text(query)
    intent = StructuredIntent(raw_query=query, normalized_query=normalized)

    for type_slug, aliases in TYPE_ALIASES.items():
        if any(normalize_text(alias) in normalized for alias in aliases):
            intent.type_slugs.append(type_slug)
            intent.signals.append(f"type:{type_slug}")

    for alias, slug in landmark_aliases.items():
        if alias and alias in normalized:
            intent.landmark_slugs.append(slug)
            intent.signals.append(f"landmark:{slug}")

    explicit_distance = re.search(r"(\d+(?:[.,]\d+)?)\s*(km|m)\b", normalized)
    if explicit_distance:
        numeric = float(explicit_distance.group(1).replace(",", "."))
        unit = explicit_distance.group(2)
        distance_m = int(numeric * 1000) if unit == "km" else int(numeric)
        intent.max_distance_m = distance_m
        intent.signals.append(f"distance:{distance_m}m")
    elif intent.landmark_slugs and any(word in normalized for word in ("gan", "near", "close", "walking")):
        intent.max_distance_m = 3000
        intent.signals.append("distance:default-nearby")

    rating_match = re.search(r"(?:rating|diem|điểm|tu)\s*(\d(?:[.,]\d+)?)", normalized)
    if not rating_match:
        rating_match = re.search(r"(\d(?:[.,]\d+)?)\s*(?:tro len|trở lên|up)", normalized)
    if rating_match:
        intent.min_rating = float(rating_match.group(1).replace(",", "."))
        intent.signals.append(f"rating>={intent.min_rating}")

    normalized_amenities = {normalize_text(label): label for label in amenity_labels}
    for alias, canonical_labels in AMENITY_ALIASES.items():
        if alias in normalized:
            intent.amenity_labels.extend(canonical_labels)
            intent.signals.append(f"amenity-alias:{alias}")
    for key, label in normalized_amenities.items():
        if key and key in normalized:
            intent.amenity_labels.append(label)
            intent.signals.append(f"amenity:{label}")

    if "an thuong" in normalized:
        intent.zone_slugs.append("an-thuong-zone")
    if "san bay" in normalized or "airport" in normalized:
        intent.zone_slugs.append("airport-corridor")
    if "my khe" in normalized or "bien" in normalized or "beach" in normalized:
        intent.zone_slugs.append("my-khe-strip")

    intent.type_slugs = unique_preserve(intent.type_slugs)
    intent.landmark_slugs = unique_preserve(intent.landmark_slugs)
    intent.zone_slugs = unique_preserve(intent.zone_slugs)
    intent.amenity_labels = unique_preserve(intent.amenity_labels)
    intent.signals = unique_preserve(intent.signals)
    return intent


def fetch_candidate_places(
    conn,
    intent: StructuredIntent,
    *,
    limit: int,
) -> list[dict[str, Any]]:
    inner_where = ["1=1"]
    select_params: list[Any] = []
    where_params: list[Any] = []
    landmark_distance_sql = "NULL::integer"

    if intent.type_slugs:
        inner_where.append("p.type_slug = ANY(%s)")
        where_params.append(intent.type_slugs)
    if intent.min_rating is not None:
        inner_where.append("p.rating >= %s")
        where_params.append(intent.min_rating)
    for label in intent.amenity_labels:
        inner_where.append(
            """
            EXISTS (
                SELECT 1
                FROM place_amenities pa
                JOIN amenities a ON a.id = pa.amenity_id
                WHERE pa.place_id = p.id AND a.label = %s
            )
            """
        )
        where_params.append(label)
    if intent.landmark_slugs:
        landmark_distance_sql = """
            (
                SELECT MIN(plm.distance_m)
                FROM place_landmark_metrics plm
                JOIN local_landmarks l ON l.id = plm.landmark_id
                WHERE plm.place_id = p.id AND l.slug = ANY(%s)
            )
        """
        select_params.append(intent.landmark_slugs)

    sql = f"""
        SELECT *
        FROM (
            SELECT
                p.id,
                p.place_id,
                p.title,
                p.type_slug,
                p.address,
                p.neighborhood,
                p.district,
                p.city,
                p.rating,
                p.reviews_count,
                p.image_url,
                ARRAY(
                    SELECT a.label
                    FROM place_amenities pa
                    JOIN amenities a ON a.id = pa.amenity_id
                    WHERE pa.place_id = p.id
                    ORDER BY a.label
                    LIMIT 10
                ) AS amenity_labels,
                (
                    SELECT COALESCE(
                        json_agg(
                            json_build_object(
                                'slug', near.slug,
                                'name', near.name,
                                'distance_m', near.distance_m
                            )
                            ORDER BY near.distance_m
                        ),
                        '[]'::json
                    )
                    FROM (
                        SELECT l.slug, l.name, plm.distance_m
                        FROM place_landmark_metrics plm
                        JOIN local_landmarks l ON l.id = plm.landmark_id
                        WHERE plm.place_id = p.id
                        ORDER BY plm.distance_m ASC NULLS LAST
                        LIMIT 3
                    ) AS near
                ) AS nearest_landmarks,
                {landmark_distance_sql} AS landmark_distance_m
            FROM places p
            WHERE {' AND '.join(inner_where)}
        ) AS candidates
        WHERE 1=1
    """
    params = list(select_params) + list(where_params)
    if intent.landmark_slugs and intent.max_distance_m is not None:
        sql += " AND COALESCE(candidates.landmark_distance_m, 999999999) <= %s"
        params.append(intent.max_distance_m)
    sql += " ORDER BY "
    if intent.landmark_slugs:
        sql += "candidates.landmark_distance_m ASC NULLS LAST, "
    sql += "candidates.rating DESC NULLS LAST, candidates.reviews_count DESC NULLS LAST LIMIT %s"
    params.append(limit)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        rows = [dict(row) for row in cur.fetchall()]
        for row in rows:
            row["rating"] = as_float(row.get("rating"))
            row["reviews_count"] = as_int(row.get("reviews_count"))
            row["landmark_distance_m"] = as_int(row.get("landmark_distance_m"))
        return rows


def fetch_semantic_matches(
    conn,
    *,
    query_text: str,
    model_name: str,
    candidate_place_uuids: list[str] | None,
    limit: int,
) -> list[dict[str, Any]]:
    ensure_openai_key()
    embeddings = create_embeddings(model_name)
    query_vector = embeddings.embed_query(query_text)
    where = ["c.embedding IS NOT NULL"]
    params: list[Any] = [vector_literal(query_vector)]
    if candidate_place_uuids:
        where.append("c.place_id = ANY(%s::uuid[])")
        params.append(candidate_place_uuids)
    sql = f"""
        SELECT
            c.id,
            c.place_id,
            c.chunk_index,
            c.content,
            c.metadata,
            c.metadata->>'chunk_kind' AS chunk_kind,
            p.place_id AS google_place_id,
            p.title,
            p.type_slug,
            p.neighborhood,
            p.district,
            p.rating,
            p.reviews_count,
            (c.embedding <=> %s::vector) AS vector_distance
        FROM ai_place_chunks c
        JOIN places p ON p.id = c.place_id
        WHERE {' AND '.join(where)}
        ORDER BY vector_distance ASC
        LIMIT %s
    """
    params.append(limit)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        rows = [dict(row) for row in cur.fetchall()]
    for row in rows:
        row["vector_distance"] = as_float(row.get("vector_distance"))
        row["rating"] = as_float(row.get("rating"))
        row["reviews_count"] = as_int(row.get("reviews_count"))
    return rows


def select_query_context_notes(
    intent: StructuredIntent,
    notes_bundle: dict[str, dict[str, list[dict[str, Any]]]],
    candidate_places: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(items: Iterable[dict[str, Any]]) -> None:
        for note in items:
            slug = note["slug"]
            if slug in seen:
                continue
            seen.add(slug)
            selected.append(note)

    add(notes_bundle["city"].get("da-nang", []))
    for slug in intent.landmark_slugs:
        add(notes_bundle["landmark"].get(slug, []))
    for slug in intent.zone_slugs:
        add(notes_bundle["zone"].get(slug, []))

    if len(selected) < 4:
        for place in candidate_places[:5]:
            for landmark in place.get("nearest_landmarks") or []:
                add(notes_bundle["landmark"].get(landmark.get("slug"), []))
                zone_slug = ZONE_BY_LANDMARK.get(landmark.get("slug"))
                if zone_slug:
                    add(notes_bundle["zone"].get(zone_slug, []))
                if len(selected) >= 4:
                    break
            if len(selected) >= 4:
                break

    return selected[:4]


def build_generation_context(
    query: str,
    intent: StructuredIntent,
    candidate_places: list[dict[str, Any]],
    semantic_matches: list[dict[str, Any]],
    context_notes: list[dict[str, Any]],
) -> str:
    lines = [f"User query: {query}", "", "Structured intent:"]
    lines.append(json.dumps(intent.__dict__, ensure_ascii=False, indent=2))
    lines.append("")
    lines.append("Candidate places:")
    for place in candidate_places[:5]:
        lines.append(
            f"- {place.get('title')} | type={place.get('type_slug')} | rating={place.get('rating')} | "
            f"reviews={place.get('reviews_count')} | district={place.get('district')} | "
            f"nearest_distance={format_distance_m(place.get('landmark_distance_m')) if place.get('landmark_distance_m') is not None else 'n/a'}"
        )
        for landmark in place.get("nearest_landmarks") or []:
            lines.append(
                f"  nearest landmark: {landmark.get('name')} ({format_distance_m(landmark.get('distance_m'))}, bird-flight)"
            )
        if place.get("amenity_labels"):
            lines.append(f"  amenities: {', '.join(place['amenity_labels'][:8])}")

    if semantic_matches:
        lines.append("")
        lines.append("Retrieved chunk excerpts:")
        for match in semantic_matches[:5]:
            excerpt = re.sub(r"\s+", " ", str(match.get("content") or "")).strip()[:380]
            lines.append(
                f"- {match.get('title')} | vector_distance={match.get('vector_distance')}: {excerpt}"
            )

    if context_notes:
        lines.append("")
        lines.append("Local context notes:")
        for note in context_notes:
            lines.append(f"- {note['title']}: {note['content']}")

    return "\n".join(lines).strip()


def maybe_generate_answer(
    *,
    query: str,
    context_text: str,
    model_name: str,
) -> str | None:
    provider = get_chat_provider()
    if provider == "anthropic" and not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    if provider != "anthropic" and not get_chat_api_key():
        return None
    model = create_chat_model(model_name, temperature=0.2)
    prompt = [
        (
            "system",
            "You are StayFinder's Da Nang lodging assistant for a consumer mobile app. "
            "Answer naturally in Vietnamese unless the user asks for another language. "
            "For lodging questions, answer only from the provided context and do not invent prices, "
            "amenities, policies, safety claims, or travel times. Distances are bird-flight haversine "
            "distances, so say that explicitly when you mention them. If a detail is not supported, "
            "use customer-facing wording such as 'mình chưa thể xác nhận thông tin đó trên hồ sơ hiện tại' "
            "or suggest a next filter; do not say dataset, database, RAG, chunks, embeddings, model, "
            "developer, backend, prompt, or internal data. For greetings or capability questions, answer "
            "briefly and steer back to helping with places to stay in Da Nang.",
        ),
        ("human", f"{context_text}\n\nPlease answer the user query: {query}"),
    ]
    try:
        response = model.invoke(prompt)
        return response_text(response)
    except Exception as exc:
        print(f"[rag] chat generation failed: {exc}", file=sys.stderr)
        return None


def cmd_query(args: argparse.Namespace) -> int:
    load_project_env()
    conn = connect_from_env()
    landmarks = load_landmark_catalog(conn)
    notes_bundle = load_context_notes(conn)
    amenity_labels = load_amenity_catalog(conn)
    landmark_aliases = build_landmark_alias_map(landmarks)
    intent = parse_structured_intent(
        args.query,
        landmark_aliases=landmark_aliases,
        amenity_labels=amenity_labels,
    )

    candidate_places = fetch_candidate_places(conn, intent, limit=args.candidate_limit) if intent.has_filters else []
    candidate_place_uuids = [str(row["id"]) for row in candidate_places] if intent.has_filters else None

    semantic_matches: list[dict[str, Any]] = []
    semantic_error: str | None = None
    try:
        semantic_matches = fetch_semantic_matches(
            conn,
            query_text=args.query,
            model_name=args.embed_model,
            candidate_place_uuids=candidate_place_uuids,
            limit=args.semantic_limit,
        )
    except SystemExit as exc:
        semantic_error = str(exc)

    if not candidate_places and not semantic_matches:
        print(
            json.dumps(
                {
                    "query": args.query,
                    "intent": intent.__dict__,
                    "message": "No structured candidates or semantic matches found.",
                    "semantic_error": semantic_error,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    context_notes = select_query_context_notes(intent, notes_bundle, candidate_places)
    context_text = build_generation_context(
        args.query,
        intent,
        candidate_places,
        semantic_matches,
        context_notes,
    )
    generated_answer = None
    if args.generate:
        generated_answer = maybe_generate_answer(
            query=args.query,
            context_text=context_text,
            model_name=args.chat_model,
        )

    payload = {
        "query": args.query,
        "intent": intent.__dict__,
        "structured_candidates": candidate_places[: args.output_places],
        "semantic_matches": semantic_matches[: args.output_matches],
        "local_context_notes": context_notes,
        "generated_answer": generated_answer,
        "semantic_error": semantic_error,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
        return 0

    print(f"Query: {args.query}\n")
    print("Structured intent:")
    print(json.dumps(intent.__dict__, ensure_ascii=False, indent=2))
    print("\nTop candidate places:")
    for place in payload["structured_candidates"]:
        print(
            f"- {place.get('title')} | {place.get('type_slug')} | rating {place.get('rating')} | "
            f"reviews {place.get('reviews_count')}"
        )
        for landmark in place.get("nearest_landmarks") or []:
            print(
                f"  nearest: {landmark.get('name')} ({format_distance_m(landmark.get('distance_m'))}, bird-flight)"
            )
    if generated_answer:
        print("\nGenerated answer:\n")
        print(generated_answer)
    elif semantic_error:
        print("\nSemantic retrieval note:")
        print(semantic_error)
    return 0


def resolve_place_for_summary(
    conn,
    *,
    place_id: str | None,
    title_search: str | None,
) -> dict[str, Any] | None:
    places = fetch_places_bundle(
        conn,
        batch_key=None,
        place_ids=[place_id] if place_id else None,
        title_search=title_search,
        limit=1,
    )
    return places[0] if places else None


def fetch_cached_summary(conn, place_uuid: str) -> dict[str, Any] | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT summary_text, bullets, model, prompt_version, source_review_count, metadata, updated_at
            FROM ai_review_summaries
            WHERE place_id = %s
            """,
            (place_uuid,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def build_fallback_summary(place: dict[str, Any]) -> dict[str, Any]:
    reviews_count = as_int(place.get("reviews_count")) or 0
    amenities = place.get("amenities") or []
    snippets = select_review_snippets(place.get("reviews") or [], limit=3)

    summary_parts: list[str] = []
    if snippets:
        summary_parts.append(f"Khách thường nhắc tới: {snippets[0]}")
    if len(snippets) > 1:
        summary_parts.append(f"Một số nhận xét khác ghi nhận: {snippets[1]}")
    if amenities:
        summary_parts.append(f"Tiện nghi nổi bật được dữ liệu ghi nhận gồm {', '.join(amenities[:4])}.")
    if not summary_parts:
        summary_parts.append("Chưa có đủ nội dung review chi tiết để rút ra nhận xét đáng tin cậy.")

    bullets: list[str] = []
    bullets.extend(snippets[1:4])
    bullets.extend([f"Tiện nghi được nhắc trong dữ liệu: {item}" for item in amenities[:3]])

    return {
        "summary_text": " ".join(summary_parts),
        "bullets": unique_preserve(bullets)[:6],
        "model": "heuristic-fallback",
        "prompt_version": DEFAULT_PROMPT_VERSION,
        "source_review_count": reviews_count,
        "metadata": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "strategy": "fallback",
        },
    }


def generate_llm_review_summary(place: dict[str, Any], *, model_name: str) -> dict[str, Any]:
    ensure_chat_credentials()
    snippets = select_review_snippets(place.get("reviews") or [], limit=6)
    prompt_context = {
        "amenities": place.get("amenities")[:12],
        "review_snippets": snippets,
    }

    model = create_chat_model(model_name, temperature=0.2)
    prompt = [
        (
            "system",
            "You summarize hotel/review data for StayFinder. Only use provided data. "
            "Return compact Vietnamese JSON with keys summary_text and bullets. Focus only on useful "
            "insights extracted from review_snippets: what guests praise, complain about, and practical "
            "tradeoffs. Do not repeat the place name, type/category, district/neighborhood/address, rating, "
            "review count, model name, or generic facts already shown elsewhere in the detail screen. "
            "Mention amenities only when reviews or supplied data make them useful context. Do not invent "
            "price, booking policy, distance, location, or safety claims.",
        ),
        ("human", json.dumps(prompt_context, ensure_ascii=False)),
    ]
    response = model.invoke(prompt)
    text = response_text(response)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        payload = {
            "summary_text": text.strip(),
            "bullets": [],
        }

    summary_text = str(payload.get("summary_text") or "").strip()
    bullets = [str(item).strip() for item in (payload.get("bullets") or []) if str(item).strip()]
    if not summary_text:
        raise SystemExit("Configured chat provider returned an empty summary_text for review summary generation.")
    return {
        "summary_text": summary_text,
        "bullets": unique_preserve(bullets)[:6],
        "model": model_name,
        "prompt_version": DEFAULT_PROMPT_VERSION,
        "source_review_count": as_int(place.get("reviews_count")) or 0,
        "metadata": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "strategy": f"chat-provider:{get_chat_provider()}",
        },
    }


def upsert_review_summary(conn, place_uuid: str, payload: dict[str, Any]) -> None:
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_review_summaries (
                    place_id,
                    summary_text,
                    bullets,
                    model,
                    prompt_version,
                    source_review_count,
                    metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (place_id) DO UPDATE SET
                    summary_text = EXCLUDED.summary_text,
                    bullets = EXCLUDED.bullets,
                    model = EXCLUDED.model,
                    prompt_version = EXCLUDED.prompt_version,
                    source_review_count = EXCLUDED.source_review_count,
                    metadata = EXCLUDED.metadata
                """,
                (
                    place_uuid,
                    payload["summary_text"],
                    Json(payload["bullets"]),
                    payload["model"],
                    payload["prompt_version"],
                    payload["source_review_count"],
                    Json(payload["metadata"]),
                ),
            )


def cmd_review_summary(args: argparse.Namespace) -> int:
    load_project_env()
    conn = connect_from_env()
    place = resolve_place_for_summary(
        conn,
        place_id=args.place_id,
        title_search=args.title_search,
    )
    if not place:
        print("No place matched the provided identifier.", file=sys.stderr)
        return 1

    if not args.refresh:
        cached = fetch_cached_summary(conn, str(place["id"]))
        if cached:
            print(json.dumps({"source": "cache", **cached}, ensure_ascii=False, indent=2, default=str))
            return 0

    if args.use_llm:
        payload = generate_llm_review_summary(place, model_name=args.chat_model)
    else:
        payload = build_fallback_summary(place)

    upsert_review_summary(conn, str(place["id"]), payload)
    print(
        json.dumps(
            {
                "source": "generated",
                "place_id": place["place_id"],
                "title": place.get("title"),
                **payload,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="StayFinder Phase 2 LangChain RAG pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    chunk = subparsers.add_parser("chunk", help="Build and store ai_place_chunks from DB data")
    chunk.add_argument("--batch-key", default=DEFAULT_BATCH_KEY)
    chunk.add_argument("--place-id", action="append", help="Google place_id; repeatable")
    chunk.add_argument("--title-search")
    chunk.add_argument("--limit", type=int)
    chunk.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    chunk.add_argument("--chunk-overlap", type=int, default=DEFAULT_CHUNK_OVERLAP)
    chunk.add_argument("--dry-run", action="store_true")
    chunk.add_argument("--sample-count", type=int, default=3)
    chunk.set_defaults(func=cmd_chunk)

    embed = subparsers.add_parser("embed", help="Embed ai_place_chunks with OpenAI 1536-dim vectors")
    embed.add_argument("--batch-key", default=DEFAULT_BATCH_KEY)
    embed.add_argument("--place-id", action="append", help="Google place_id; repeatable")
    embed.add_argument("--limit", type=int)
    embed.add_argument("--batch-size", type=int, default=32)
    embed.add_argument("--model", default=DEFAULT_EMBED_MODEL)
    embed.add_argument("--refresh", action="store_true", help="Re-embed chunks even if embedding already exists")
    embed.set_defaults(func=cmd_embed)

    validate = subparsers.add_parser("validate", help="Validate RAG chunk and embedding coverage")
    validate.add_argument("--batch-key", default=DEFAULT_BATCH_KEY)
    validate.add_argument("--all-batches", action="store_true", help="Validate all places instead of one batch")
    validate.add_argument("--sample-limit", type=int, default=10)
    validate.add_argument(
        "--allow-unhealthy",
        action="store_true",
        help="Always return exit code 0 after printing validation JSON",
    )
    validate.set_defaults(func=cmd_validate)

    query = subparsers.add_parser("query", help="Run structured + semantic retrieval prototype")
    query.add_argument("query", help="Natural-language stay query")
    query.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    query.add_argument("--chat-model", default=DEFAULT_CHAT_MODEL)
    query.add_argument("--candidate-limit", type=int, default=12)
    query.add_argument("--semantic-limit", type=int, default=8)
    query.add_argument("--output-places", type=int, default=5)
    query.add_argument("--output-matches", type=int, default=5)
    query.add_argument(
        "--generate",
        action="store_true",
        help="Generate an answer with the configured chat provider (openai_compatible or anthropic)",
    )
    query.add_argument("--json", action="store_true")
    query.set_defaults(func=cmd_query)

    review = subparsers.add_parser("review-summary", help="Generate/cache AI review summary for one place")
    review.add_argument("--place-id", help="Google place_id")
    review.add_argument("--title-search", help="Fallback title search if place_id not provided")
    review.add_argument("--chat-model", default=DEFAULT_CHAT_MODEL)
    review.add_argument(
        "--use-claude",
        dest="use_llm",
        action="store_true",
        help="Use the configured chat provider instead of heuristic fallback (legacy flag name kept for compatibility)",
    )
    review.add_argument(
        "--use-llm",
        dest="use_llm",
        action="store_true",
        help="Use the configured chat provider instead of heuristic fallback",
    )
    review.set_defaults(use_llm=False)
    review.add_argument("--refresh", action="store_true", help="Ignore cached summary and regenerate")
    review.set_defaults(func=cmd_review_summary)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
