#!/usr/bin/env python3
"""
Import all_types_compact_combined.json into Supabase Postgres (PLAN.md §1).

Prerequisites:
  - Apply supabase/migrations/*.sql to your database (Supabase SQL editor, or
    `supabase db push` after `supabase link`, or `psql "$DATABASE_URL" -f ...`).

Environment (either):

  A) URI (one string):
     DATABASE_URL or SUPABASE_DB_URL

  B) Separate fields (no URI needed), e.g. from Dashboard → Connect:
     PGHOST, PGPORT (default 5432), PGUSER, PGPASSWORD, PGDATABASE (default postgres)
     Or: SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD,
     SUPABASE_DB_NAME
     SSL: PGSSLMODE=require recommended for Supabase.

  IPv6 "Network is unreachable":
     Many `db.<ref>.supabase.co` hosts are IPv6-only (no IPv4 A record). Then you must use the
     **Pooler** host from Dashboard → Connect (Transaction or Session mode), which usually has IPv4.
     If your host has both A and AAAA and IPv6 is broken on your network:
     export PGFORCE_IPV4=1
     Or set PGHOSTADDR to an IPv4 from: dig +short YOUR_HOST A

Idempotency: upsert by places.place_id; child rows (images, reviews, amenities)
are replaced on each import for that place.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
import sys
from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:

    def load_dotenv(*_args: Any, **_kwargs: Any) -> None:
        """No-op if python-dotenv is not installed; use exported env vars instead."""

try:
    import psycopg2
    from psycopg2.extras import Json, execute_batch
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: pip install psycopg2-binary"
    ) from exc


def _resolve_first_ipv4(hostname: str) -> str | None:
    try:
        for res in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            return res[4][0]
    except OSError:
        pass
    return None


def _hostaddr_from_env(hostname: str | None) -> str | None:
    explicit = (os.environ.get("PGHOSTADDR") or os.environ.get("SUPABASE_DB_HOSTADDR") or "").strip()
    if explicit:
        return explicit
    if os.environ.get("PGFORCE_IPV4", "").lower() not in ("1", "true", "yes"):
        return None
    if hostname:
        return _resolve_first_ipv4(hostname)
    return None


def _apply_hostaddr_to_url(url: str) -> str:
    parsed = urlparse(url)
    hostaddr = _hostaddr_from_env(parsed.hostname)
    if (
        not hostaddr
        and os.environ.get("PGFORCE_IPV4", "").lower() in ("1", "true", "yes")
        and parsed.hostname
        and not (os.environ.get("PGHOSTADDR") or os.environ.get("SUPABASE_DB_HOSTADDR") or "").strip()
    ):
        print(
            "PGFORCE_IPV4: no IPv4 (A) DNS record for this host (often IPv6-only direct DB). "
            "Use Dashboard → Connect → Pooler host/port, or fix IPv6 on this network.",
            file=sys.stderr,
        )
    if not hostaddr:
        return url
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if "hostaddr" in query:
        return url
    query["hostaddr"] = hostaddr
    return urlunparse(parsed._replace(query=urlencode(query)))


def connect_from_env():
    """Return psycopg2 connection using URI or discrete libpq-style env vars."""
    url = (os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or "").strip()
    if url:
        url = _apply_hostaddr_to_url(url)
        return psycopg2.connect(url)

    host = (os.environ.get("PGHOST") or os.environ.get("SUPABASE_DB_HOST") or "").strip()
    password = os.environ.get("PGPASSWORD") or os.environ.get("SUPABASE_DB_PASSWORD")
    if host and password:
        port_s = os.environ.get("PGPORT") or os.environ.get("SUPABASE_DB_PORT") or "5432"
        try:
            port = int(port_s)
        except ValueError:
            port = 5432
        user = os.environ.get("PGUSER") or os.environ.get("SUPABASE_DB_USER") or "postgres"
        dbname = os.environ.get("PGDATABASE") or os.environ.get("SUPABASE_DB_NAME") or "postgres"
        sslmode = os.environ.get("PGSSLMODE") or "require"
        hostaddr = _hostaddr_from_env(host)
        if (
            not hostaddr
            and os.environ.get("PGFORCE_IPV4", "").lower() in ("1", "true", "yes")
            and not (os.environ.get("PGHOSTADDR") or os.environ.get("SUPABASE_DB_HOSTADDR") or "").strip()
        ):
            print(
                "PGFORCE_IPV4: no IPv4 (A) DNS record for this host (often IPv6-only direct DB). "
                "Use Dashboard → Connect → Pooler host/port, or fix IPv6 on this network.",
                file=sys.stderr,
            )
        kw: dict[str, Any] = dict(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            sslmode=sslmode,
        )
        if hostaddr:
            kw["hostaddr"] = hostaddr
        return psycopg2.connect(**kw)

    print(
        "Set DATABASE_URL (or SUPABASE_DB_URL), or set PGHOST + PGPASSWORD "
        "(and optionally PGPORT, PGUSER, PGDATABASE, PGSSLMODE).",
        file=sys.stderr,
    )
    raise SystemExit(1)


def amenity_slug(label: str) -> str:
    return hashlib.sha256(label.encode("utf-8")).hexdigest()[:24]


def unique_preserve(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def extract_amenity_labels(additional_info: dict[str, Any] | None) -> list[str]:
    buckets: list[Any] = []
    for value in (additional_info or {}).values():
        if isinstance(value, list):
            buckets.extend(value)
    enabled: list[str] = []
    for entry in buckets:
        if not isinstance(entry, dict):
            continue
        for name, flag in entry.items():
            if flag is True:
                enabled.append(str(name))
    return unique_preserve(enabled)


def parse_district(state: str | None) -> str | None:
    if not state:
        return None
    parts = [p.strip() for p in str(state).split(",")]
    if len(parts) >= 2:
        return parts[0]
    return str(state).strip() or None


def price_to_text(price: Any) -> str | None:
    if price is None:
        return None
    if isinstance(price, str):
        return price.strip() or None
    try:
        return json.dumps(price, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(price)


def safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_iso_ts(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def dedupe_place_key(item: dict[str, Any]) -> str | None:
    pid = str(item.get("placeId") or "").strip()
    if pid:
        return pid
    url = str(item.get("url") or "").strip()
    if url:
        return url
    return None


def load_items(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("JSON root must be an array")
    return data


def ensure_amenity(cur, cache: dict[str, int], label: str) -> int:
    if label in cache:
        return cache[label]
    cur.execute("SELECT id FROM amenities WHERE label = %s", (label,))
    row = cur.fetchone()
    if row:
        cache[label] = int(row[0])
        return cache[label]
    slug = amenity_slug(label)
    cur.execute(
        "INSERT INTO amenities (slug, label) VALUES (%s, %s) RETURNING id",
        (slug, label),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"amenity insert failed for {label!r}")
    cache[label] = int(row[0])
    return cache[label]


def import_run(
    conn,
    items: list[dict[str, Any]],
    *,
    batch_id: str,
    source_path: str | None,
) -> tuple[int, int]:
    skipped = 0
    imported = 0
    amenity_cache: dict[str, int] = {}

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO crawl_batches (batch_key, source_path, row_count)
            VALUES (%s, %s, 0)
            ON CONFLICT (batch_key) DO UPDATE SET
                source_path = COALESCE(EXCLUDED.source_path, crawl_batches.source_path),
                created_at = crawl_batches.created_at
            RETURNING id
            """,
            (batch_id, source_path),
        )
        batch_uuid = cur.fetchone()[0]

        for item in items:
            key = dedupe_place_key(item)
            if not key:
                skipped += 1
                continue

            raw_payload = json.loads(json.dumps(item))
            place_id = str(item.get("placeId") or "").strip() or key
            type_slug = str(item.get("crawlCategorySlug") or "unknown").strip() or "unknown"
            type_label = item.get("crawlCategoryLabel")
            labels = item.get("crawlCategoryLabels")
            if isinstance(labels, list):
                crawl_category_labels = [str(x) for x in labels if x]
            else:
                crawl_category_labels = [str(type_label)] if type_label else []

            loc = item.get("location") or {}
            lat = loc.get("lat")
            lng = loc.get("lng")
            rating = item.get("totalScore")
            scraped_at = parse_iso_ts(item.get("scrapedAt"))

            cur.execute(
                """
                INSERT INTO places (
                    batch_id, place_id, type_slug, type_label, crawl_category_labels,
                    title, description, category_name, address, neighborhood, district,
                    street, city, postal_code, state, country_code,
                    phone, website, lat, lng, rating, reviews_count, reviews_distribution,
                    images_count, price_text, hotel_stars, hotel_description,
                    check_in_date, check_out_date, scraped_at, url, search_page_url,
                    search_string, language, rank, is_advertisement, image_url,
                    plus_code, popular_times_live_text, opening_hours, hotel_ads,
                    additional_info, categories, crawl_search_terms, raw_payload
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
                ON CONFLICT (place_id) DO UPDATE SET
                    batch_id = EXCLUDED.batch_id,
                    type_slug = EXCLUDED.type_slug,
                    type_label = EXCLUDED.type_label,
                    crawl_category_labels = EXCLUDED.crawl_category_labels,
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    category_name = EXCLUDED.category_name,
                    address = EXCLUDED.address,
                    neighborhood = EXCLUDED.neighborhood,
                    district = EXCLUDED.district,
                    street = EXCLUDED.street,
                    city = EXCLUDED.city,
                    postal_code = EXCLUDED.postal_code,
                    state = EXCLUDED.state,
                    country_code = EXCLUDED.country_code,
                    phone = EXCLUDED.phone,
                    website = EXCLUDED.website,
                    lat = EXCLUDED.lat,
                    lng = EXCLUDED.lng,
                    rating = EXCLUDED.rating,
                    reviews_count = EXCLUDED.reviews_count,
                    reviews_distribution = EXCLUDED.reviews_distribution,
                    images_count = EXCLUDED.images_count,
                    price_text = EXCLUDED.price_text,
                    hotel_stars = EXCLUDED.hotel_stars,
                    hotel_description = EXCLUDED.hotel_description,
                    check_in_date = EXCLUDED.check_in_date,
                    check_out_date = EXCLUDED.check_out_date,
                    scraped_at = EXCLUDED.scraped_at,
                    url = EXCLUDED.url,
                    search_page_url = EXCLUDED.search_page_url,
                    search_string = EXCLUDED.search_string,
                    language = EXCLUDED.language,
                    rank = EXCLUDED.rank,
                    is_advertisement = EXCLUDED.is_advertisement,
                    image_url = EXCLUDED.image_url,
                    plus_code = EXCLUDED.plus_code,
                    popular_times_live_text = EXCLUDED.popular_times_live_text,
                    opening_hours = EXCLUDED.opening_hours,
                    hotel_ads = EXCLUDED.hotel_ads,
                    additional_info = EXCLUDED.additional_info,
                    categories = EXCLUDED.categories,
                    crawl_search_terms = EXCLUDED.crawl_search_terms,
                    raw_payload = EXCLUDED.raw_payload
                RETURNING id
                """,
                (
                    batch_uuid,
                    place_id,
                    type_slug,
                    type_label,
                    crawl_category_labels,
                    item.get("title"),
                    item.get("description"),
                    item.get("categoryName"),
                    item.get("address"),
                    item.get("neighborhood"),
                    parse_district(item.get("state")),
                    item.get("street"),
                    item.get("city"),
                    item.get("postalCode"),
                    item.get("state"),
                    item.get("countryCode"),
                    item.get("phone"),
                    item.get("website"),
                    safe_float(lat),
                    safe_float(lng),
                    safe_float(rating),
                    item.get("reviewsCount"),
                    Json(item.get("reviewsDistribution") or {}),
                    item.get("imagesCount"),
                    price_to_text(item.get("price")),
                    item.get("hotelStars"),
                    item.get("hotelDescription"),
                    str(item.get("checkInDate")) if item.get("checkInDate") else None,
                    str(item.get("checkOutDate")) if item.get("checkOutDate") else None,
                    scraped_at,
                    item.get("url"),
                    item.get("searchPageUrl"),
                    item.get("searchString"),
                    item.get("language"),
                    item.get("rank"),
                    item.get("isAdvertisement"),
                    item.get("imageUrl"),
                    item.get("plusCode"),
                    item.get("popularTimesLiveText"),
                    Json(item.get("openingHours") or []),
                    Json(item.get("hotelAds") or []),
                    Json(item.get("additionalInfo") or {}),
                    item.get("categories"),
                    item.get("crawlSearchTerms"),
                    Json(raw_payload),
                ),
            )
            place_uuid = cur.fetchone()[0]

            cur.execute("DELETE FROM place_images WHERE place_id = %s", (place_uuid,))
            gallery = item.get("galleryImages") or item.get("imageUrls") or []
            if isinstance(gallery, list) and gallery:
                rows_img = [
                    (place_uuid, str(url), idx)
                    for idx, url in enumerate(gallery)
                    if isinstance(url, str) and url.strip()
                ]
                execute_batch(
                    cur,
                    """
                    INSERT INTO place_images (place_id, image_url, sort_order)
                    VALUES (%s, %s, %s)
                    """,
                    rows_img,
                )

            cur.execute("DELETE FROM reviews WHERE place_id = %s", (place_uuid,))
            review_rows: list[tuple[Any, ...]] = []
            for rev in item.get("reviews") or []:
                if not isinstance(rev, dict):
                    continue
                rid = rev.get("reviewId")
                rid_s = str(rid).strip() if rid else None
                pub = parse_iso_ts(rev.get("publishedAtDate"))
                payload = json.loads(json.dumps(rev))
                review_rows.append(
                    (
                        place_uuid,
                        rid_s,
                        rev.get("stars"),
                        rev.get("text"),
                        rev.get("textTranslated"),
                        rev.get("publishAt"),
                        pub,
                        rev.get("likesCount"),
                        rev.get("reviewOrigin"),
                        Json(payload),
                    )
                )
            if review_rows:
                execute_batch(
                    cur,
                    """
                    INSERT INTO reviews (
                        place_id, source_review_id, stars, review_text, text_translated,
                        publish_at, published_at, likes_count, review_origin, payload
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    review_rows,
                )

            cur.execute("DELETE FROM place_amenities WHERE place_id = %s", (place_uuid,))
            for label in extract_amenity_labels(item.get("additionalInfo")):
                aid = ensure_amenity(cur, amenity_cache, label)
                cur.execute(
                    """
                    INSERT INTO place_amenities (place_id, amenity_id)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (place_uuid, aid),
                )

            imported += 1

        cur.execute(
            "UPDATE crawl_batches SET row_count = %s WHERE id = %s",
            (imported, batch_uuid),
        )

    return imported, skipped


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "json_path",
        type=Path,
        help="Path to all_types_compact_combined.json",
    )
    parser.add_argument(
        "--batch-key",
        required=True,
        help="Stable id for this import, e.g. danang_accommodations_batch_20260323_082743",
    )
    return parser.parse_args()


def main() -> int:
    load_dotenv()
    args = parse_args()

    items = load_items(args.json_path)
    conn = connect_from_env()
    try:
        imported, skipped = import_run(
            conn,
            items,
            batch_key=args.batch_key,
            source_path=str(args.json_path.resolve()),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"Imported/updated places: {imported}, skipped (no key): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
