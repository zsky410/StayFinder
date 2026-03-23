#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from apify_client import ApifyClient
from apify_client._errors import ApifyApiError
from dotenv import load_dotenv

ACTOR_ID = "compass/crawler-google-places"
BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_PATH = BASE_DIR / "examples" / "danang_accommodation_demo_input.json"
DEFAULT_OUTPUT_ROOT = BASE_DIR / "output"
DEFAULT_PER_TYPE_LIMIT = 200
DEFAULT_MIN_RATING = 2.5
DEFAULT_MAX_REVIEWS = 25
DEFAULT_MAX_IMAGES = 15
DEFAULT_COMPACT_REVIEW_LIMIT = 10
DEFAULT_SOCIAL_MEDIA_FLAGS = {
    "facebooks": False,
    "instagrams": False,
    "youtubes": False,
    "tiktoks": False,
    "twitters": False,
}
DA_NANG_TOKENS = ("da nang", "đà nẵng")
DA_NANG_LAT_RANGE = (15.955, 16.165)
DA_NANG_LNG_RANGE = (108.095, 108.33)
ACCOMMODATION_TOKENS = (
    "hotel",
    "khách sạn",
    "homestay",
    "lưu trú nhà dân",
    "hostel",
    "nhà trọ",
    "ký túc xá",
    "dormitory",
    "resort",
    "khu nghỉ dưỡng",
    "nhà nghỉ",
    "motel",
    "nhà khách",
    "villa",
    "biệt thự",
    "apartment",
    "căn hộ",
    "căn hộ dịch vụ",
    "serviced apartment",
    "aparthotel",
    "apartment hotel",
    "guest house",
    "guesthouse",
    "inn",
    "condotel",
    "residence",
    "farmstay",
    "chalet",
    "cottage",
    "lodging",
)


@dataclass(frozen=True)
class CrawlPlan:
    slug: str
    label: str
    search_terms: list[str]
    category_filters: list[str]


PLANS = [
    CrawlPlan(
        slug="hotel",
        label="Khach san",
        search_terms=["khách sạn", "hotel"],
        category_filters=["Khách sạn", "Hotel"],
    ),
    CrawlPlan(
        slug="homestay",
        label="Homestay",
        search_terms=["homestay", "lưu trú nhà dân"],
        category_filters=["Homestay", "Lưu trú nhà dân"],
    ),
    CrawlPlan(
        slug="hostel",
        label="Hostel",
        search_terms=["hostel", "ký túc xá", "dormitory"],
        category_filters=["Hostel", "Ký túc xá", "Dormitory"],
    ),
    CrawlPlan(
        slug="nha-nghi",
        label="Nha nghi",
        search_terms=["nhà nghỉ", "motel"],
        category_filters=["Nhà nghỉ", "Motel"],
    ),
    CrawlPlan(
        slug="nha-khach",
        label="Nha khach",
        search_terms=["nhà khách", "guest house", "guesthouse"],
        category_filters=["Nhà khách", "Guest house", "Guesthouse"],
    ),
    CrawlPlan(
        slug="resort",
        label="Resort",
        search_terms=["resort", "khu nghỉ dưỡng"],
        category_filters=["Resort", "Khu nghỉ dưỡng", "Khách sạn nghỉ dưỡng"],
    ),
    CrawlPlan(
        slug="villa",
        label="Villa",
        search_terms=["villa", "biệt thự"],
        category_filters=["Villa", "Biệt thự"],
    ),
    CrawlPlan(
        slug="can-ho",
        label="Can ho",
        search_terms=["căn hộ", "apartment"],
        category_filters=["Căn hộ", "Apartment"],
    ),
    CrawlPlan(
        slug="can-ho-dich-vu",
        label="Can ho dich vu",
        search_terms=["căn hộ dịch vụ", "serviced apartment", "aparthotel", "apartment hotel"],
        category_filters=["Căn hộ dịch vụ", "Serviced apartment", "Aparthotel", "Apartment hotel"],
    ),
    CrawlPlan(
        slug="nha-tro",
        label="Nha tro",
        search_terms=["nhà trọ"],
        category_filters=["Nhà trọ"],
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch crawl Da Nang accommodations with multiple Apify tokens, one token per accommodation type."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help="Template JSON input for the Apify actor.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory. Defaults to output/danang_accommodations_batch_<timestamp>/",
    )
    parser.add_argument(
        "--per-type-limit",
        type=int,
        default=DEFAULT_PER_TYPE_LIMIT,
        help="Maximum kept places per accommodation type after filtering and dedupe.",
    )
    parser.add_argument(
        "--min-rating",
        type=float,
        default=DEFAULT_MIN_RATING,
        help="Minimum totalScore to keep.",
    )
    parser.add_argument(
        "--max-reviews",
        type=int,
        default=DEFAULT_MAX_REVIEWS,
        help="Number of reviews to request per place from Apify.",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=DEFAULT_MAX_IMAGES,
        help="Number of place images to request per place from Apify.",
    )
    parser.add_argument(
        "--compact-review-limit",
        type=int,
        default=DEFAULT_COMPACT_REVIEW_LIMIT,
        help="How many preferred reviews to keep in compact output per place.",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        help="Parallel worker count. Defaults to the number of plans, capped at 10.",
    )
    return parser.parse_args()


def load_input_file(input_path: Path) -> dict[str, Any]:
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    with input_path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise ValueError("Input JSON must be an object.")
    return data


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return value.casefold()


def parse_tokens() -> list[str]:
    load_dotenv()
    raw = os.getenv("APIFY_TOKEN") or ""
    tokens = [token.strip() for token in raw.split(",") if token.strip()]
    if not tokens:
        raise RuntimeError(
            "Missing APIFY_TOKEN. Put a comma-separated list of Apify tokens into .env."
        )
    if any("xxxxxxxx" in token.lower() for token in tokens):
        raise RuntimeError("APIFY_TOKEN still contains placeholder values.")
    return tokens


def validate_token(client: ApifyClient) -> str:
    try:
        user = client.user().get()
    except ApifyApiError as exc:
        if exc.status_code in {401, 403, 404}:
            raise RuntimeError("An APIFY_TOKEN is not valid.") from exc
        raise RuntimeError(f"Apify API error while verifying token: {exc}") from exc

    if not user:
        raise RuntimeError("Apify did not return user information for this token.")

    return user.get("username") or user.get("email") or "unknown-user"


def build_output_dir(explicit_dir: Path | None) -> Path:
    if explicit_dir:
        return explicit_dir
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return DEFAULT_OUTPUT_ROOT / f"danang_accommodations_batch_{timestamp}"


def build_run_input(
    template: dict[str, Any],
    *,
    plan: CrawlPlan,
    per_type_limit: int,
    max_reviews: int,
    max_images: int,
) -> dict[str, Any]:
    run_input = json.loads(json.dumps(template))
    run_input.setdefault("scrapeSocialMediaProfiles", DEFAULT_SOCIAL_MEDIA_FLAGS.copy())
    run_input.setdefault("maximumLeadsEnrichmentRecords", 0)

    run_input["searchStringsArray"] = plan.search_terms
    run_input.pop("categoryFilterWords", None)
    run_input["countryCode"] = "vn"
    run_input["language"] = "vi"
    run_input["maxCrawledPlacesPerSearch"] = per_type_limit
    run_input["searchMatching"] = "all"
    run_input["placeMinimumStars"] = "twoAndHalf"
    run_input["website"] = "allPlaces"
    run_input["skipClosedPlaces"] = True
    run_input["scrapePlaceDetailPage"] = True
    run_input["maxQuestions"] = 0
    run_input["maxReviews"] = max_reviews
    run_input["reviewsSort"] = "mostRelevant"
    run_input["reviewsOrigin"] = "all"
    run_input["scrapeReviewsPersonalData"] = False
    run_input["maxImages"] = max_images
    run_input["scrapeImageAuthors"] = False
    run_input["includeWebResults"] = False
    run_input["scrapeDirectories"] = False
    run_input["scrapeContacts"] = False
    run_input["maximumLeadsEnrichmentRecords"] = 0

    if not run_input.get("searchStringsArray"):
        raise ValueError("searchStringsArray must not be empty.")

    return run_input


def is_in_da_nang(item: dict[str, Any]) -> bool:
    fields = (
        item.get("address"),
        item.get("city"),
        item.get("state"),
        item.get("neighborhood"),
    )
    haystack = " | ".join(normalize_text(str(value)) for value in fields if value)
    text_match = any(token in haystack for token in DA_NANG_TOKENS)

    location = item.get("location") or {}
    lat = location.get("lat")
    lng = location.get("lng")
    has_coords = isinstance(lat, (int, float)) and isinstance(lng, (int, float))
    coord_match = False
    if has_coords:
        coord_match = (
            DA_NANG_LAT_RANGE[0] <= float(lat) <= DA_NANG_LAT_RANGE[1]
            and DA_NANG_LNG_RANGE[0] <= float(lng) <= DA_NANG_LNG_RANGE[1]
        )

    if has_coords:
        return text_match and coord_match
    return text_match


def passes_min_rating(item: dict[str, Any], min_rating: float) -> bool:
    score = item.get("totalScore")
    return isinstance(score, (int, float)) and float(score) >= min_rating


def looks_like_accommodation(item: dict[str, Any]) -> bool:
    categories = item.get("categories") or []
    fields = [item.get("categoryName"), item.get("hotelStars"), *categories]
    haystack = " | ".join(normalize_text(str(value)) for value in fields if value)
    return any(token in haystack for token in ACCOMMODATION_TOKENS)


def dedupe_key(item: dict[str, Any]) -> str:
    return (
        str(item.get("placeId") or "").strip()
        or str(item.get("url") or "").strip()
        or f"{item.get('title', '')}|{item.get('address', '')}".strip()
    )


def compact_value(value: Any) -> Any:
    if isinstance(value, list):
        return [compact_value(item) for item in value]
    if isinstance(value, dict):
        return {key: compact_value(nested_value) for key, nested_value in value.items()}
    return value


def unique_list(values: list[Any]) -> list[Any]:
    unique_values: list[Any] = []
    for value in values:
        if value and value not in unique_values:
            unique_values.append(value)
    return unique_values


def select_place_images(item: dict[str, Any], *, limit: int) -> list[str]:
    images = unique_list([item.get("imageUrl"), *(item.get("imageUrls") or [])])
    return images[:limit]


def select_preferred_reviews(reviews: list[dict[str, Any]], *, limit: int) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for review in reviews:
        key = str(review.get("reviewId") or "").strip()
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        deduped.append(review)

    photo_reviews = [
        review for review in deduped if review.get("reviewImageUrls") and (review.get("text") or review.get("textTranslated"))
    ]
    text_reviews = [
        review
        for review in deduped
        if review not in photo_reviews and (review.get("text") or review.get("textTranslated"))
    ]
    image_only_reviews = [
        review
        for review in deduped
        if review not in photo_reviews and review not in text_reviews and review.get("reviewImageUrls")
    ]
    star_only_reviews = [
        review
        for review in deduped
        if review not in photo_reviews and review not in text_reviews and review not in image_only_reviews
    ]
    selected = photo_reviews + text_reviews + image_only_reviews + star_only_reviews
    return selected[:limit]


def compact_review(review: dict[str, Any]) -> dict[str, Any]:
    return {
        "text": review.get("text"),
        "textTranslated": review.get("textTranslated"),
        "publishAt": review.get("publishAt"),
        "publishedAtDate": review.get("publishedAtDate"),
        "likesCount": review.get("likesCount"),
        "reviewId": review.get("reviewId"),
        "reviewOrigin": review.get("reviewOrigin"),
        "stars": review.get("stars"),
        "rating": review.get("rating"),
        "responseFromOwnerDate": review.get("responseFromOwnerDate"),
        "responseFromOwnerText": review.get("responseFromOwnerText"),
        "reviewImageUrls": unique_list(review.get("reviewImageUrls") or []),
        "reviewContext": compact_value(review.get("reviewContext") or {}),
        "reviewDetailedRating": compact_value(review.get("reviewDetailedRating") or {}),
        "originalLanguage": review.get("originalLanguage"),
        "translatedLanguage": review.get("translatedLanguage"),
    }


def compact_item(
    item: dict[str, Any],
    *,
    plan: CrawlPlan,
    compact_review_limit: int,
    place_image_limit: int,
) -> dict[str, Any]:
    place_images = select_place_images(item, limit=place_image_limit)
    preferred_reviews = [
        compact_review(review)
        for review in select_preferred_reviews(item.get("reviews") or [], limit=compact_review_limit)
    ]

    return {
        "crawlCategorySlug": plan.slug,
        "crawlCategoryLabel": plan.label,
        "crawlSearchTerms": plan.search_terms,
        "title": item.get("title"),
        "description": item.get("description"),
        "price": item.get("price"),
        "categoryName": item.get("categoryName"),
        "address": item.get("address"),
        "neighborhood": item.get("neighborhood"),
        "street": item.get("street"),
        "city": item.get("city"),
        "postalCode": item.get("postalCode"),
        "state": item.get("state"),
        "countryCode": item.get("countryCode"),
        "website": item.get("website"),
        "phone": item.get("phone"),
        "location": compact_value(item.get("location") or {}),
        "totalScore": item.get("totalScore"),
        "placeId": item.get("placeId"),
        "categories": compact_value(item.get("categories") or []),
        "reviewsCount": item.get("reviewsCount"),
        "reviewsDistribution": compact_value(item.get("reviewsDistribution") or {}),
        "imagesCount": item.get("imagesCount"),
        "scrapedAt": item.get("scrapedAt"),
        "hotelStars": item.get("hotelStars"),
        "hotelDescription": item.get("hotelDescription"),
        "checkInDate": item.get("checkInDate"),
        "checkOutDate": item.get("checkOutDate"),
        "hotelAds": compact_value(item.get("hotelAds") or []),
        "openingHours": compact_value(item.get("openingHours") or []),
        "additionalInfo": compact_value(item.get("additionalInfo") or {}),
        "url": item.get("url"),
        "searchPageUrl": item.get("searchPageUrl"),
        "searchString": item.get("searchString"),
        "language": item.get("language"),
        "rank": item.get("rank"),
        "isAdvertisement": item.get("isAdvertisement"),
        "imageUrl": item.get("imageUrl"),
        "imageUrls": place_images,
        "galleryImages": place_images,
        "plusCode": item.get("plusCode"),
        "popularTimesLiveText": item.get("popularTimesLiveText"),
        "reviews": preferred_reviews,
    }


def prepare_items(
    items: list[dict[str, Any]],
    *,
    min_rating: float,
    output_limit: int,
    plan: CrawlPlan,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    kept: list[dict[str, Any]] = []
    seen: set[str] = set()
    stats = {
        "raw": len(items),
        "rejected_non_danang": 0,
        "rejected_low_rating": 0,
        "rejected_non_accommodation": 0,
        "rejected_duplicates": 0,
    }

    for item in items:
        if not is_in_da_nang(item):
            stats["rejected_non_danang"] += 1
            continue
        if not passes_min_rating(item, min_rating):
            stats["rejected_low_rating"] += 1
            continue
        if not looks_like_accommodation(item):
            stats["rejected_non_accommodation"] += 1
            continue

        key = dedupe_key(item)
        if key in seen:
            stats["rejected_duplicates"] += 1
            continue

        seen.add(key)
        copied_item = json.loads(json.dumps(item))
        copied_item["crawlCategorySlug"] = plan.slug
        copied_item["crawlCategoryLabel"] = plan.label
        copied_item["crawlSearchTerms"] = plan.search_terms
        kept.append(copied_item)

        if len(kept) >= output_limit:
            break

    stats["final"] = len(kept)
    return kept, stats


def save_json(items: Any, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(items, file, ensure_ascii=False, indent=2)
        file.write("\n")


def score_item_richness(item: dict[str, Any]) -> tuple[int, int, int]:
    place_images = item.get("galleryImages") or item.get("imageUrls") or []
    reviews = item.get("reviews") or []
    review_photo_count = sum(1 for review in reviews if review.get("reviewImageUrls"))
    return (
        len(place_images),
        review_photo_count,
        int(item.get("reviewsCount") or 0),
    )


def combine_deduped(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best_by_key: dict[str, dict[str, Any]] = {}
    categories_by_key: dict[str, list[str]] = {}

    for item in items:
        key = dedupe_key(item)
        if not key:
            continue

        category_label = str(item.get("crawlCategoryLabel") or "").strip()
        categories = categories_by_key.setdefault(key, [])
        if category_label and category_label not in categories:
            categories.append(category_label)

        current = best_by_key.get(key)
        if current is None or score_item_richness(item) > score_item_richness(current):
            best_by_key[key] = item

    combined = []
    for key, item in best_by_key.items():
        merged = json.loads(json.dumps(item))
        merged["crawlCategoryLabels"] = categories_by_key.get(key, [])
        combined.append(merged)

    combined.sort(
        key=lambda item: (
            -(item.get("totalScore") or 0),
            -(item.get("reviewsCount") or 0),
            str(item.get("title") or ""),
        )
    )
    return combined


def print_run_summary(results: list[dict[str, Any]]) -> None:
    print("Batch crawl summary:")
    for result in results:
        status = result["status"]
        label = result["plan"]["label"]
        compact_count = result.get("compactCount", 0)
        dataset_id = result.get("datasetId") or "-"
        if status == "ok":
            print(f"- {label}: {compact_count} place(s), dataset={dataset_id}")
        else:
            print(f"- {label}: FAILED - {result.get('error')}")


def run_single_plan(
    *,
    token: str,
    token_index: int,
    plan: CrawlPlan,
    template_input: dict[str, Any],
    output_dir: Path,
    per_type_limit: int,
    min_rating: float,
    max_reviews: int,
    max_images: int,
    compact_review_limit: int,
) -> dict[str, Any]:
    raw_output_path = output_dir / f"{plan.slug}_raw.json"
    compact_output_path = output_dir / f"{plan.slug}_compact.json"
    run_input = build_run_input(
        template_input,
        plan=plan,
        per_type_limit=per_type_limit,
        max_reviews=max_reviews,
        max_images=max_images,
    )

    client = ApifyClient(token)
    username = validate_token(client)
    run = client.actor(ACTOR_ID).call(run_input=run_input)
    dataset_id = run.get("defaultDatasetId")
    run_id = run.get("id")
    if not dataset_id:
        raise RuntimeError(f"Plan {plan.slug} finished without defaultDatasetId.")

    raw_items = list(client.dataset(dataset_id).iterate_items())
    filtered_raw_items, stats = prepare_items(
        raw_items,
        min_rating=min_rating,
        output_limit=per_type_limit,
        plan=plan,
    )
    compact_items = [
        compact_item(
            item,
            plan=plan,
            compact_review_limit=compact_review_limit,
            place_image_limit=max_images,
        )
        for item in filtered_raw_items
    ]

    save_json(filtered_raw_items, raw_output_path)
    save_json(compact_items, compact_output_path)

    return {
        "status": "ok",
        "plan": asdict(plan),
        "tokenIndex": token_index,
        "username": username,
        "runId": run_id,
        "datasetId": dataset_id,
        "datasetUrl": f"https://console.apify.com/storage/datasets/{dataset_id}",
        "rawCount": len(raw_items),
        "filteredCount": len(filtered_raw_items),
        "compactCount": len(compact_items),
        "stats": stats,
        "rawOutputPath": str(raw_output_path),
        "compactOutputPath": str(compact_output_path),
    }


def main() -> int:
    args = parse_args()
    if args.per_type_limit < 1:
        print("Error: --per-type-limit must be greater than 0.", file=sys.stderr)
        return 1
    if args.min_rating < 0:
        print("Error: --min-rating must be 0 or greater.", file=sys.stderr)
        return 1
    if args.max_reviews < 0 or args.max_images < 0 or args.compact_review_limit < 1:
        print("Error: --max-reviews and --max-images must be >= 0, compact review limit > 0.", file=sys.stderr)
        return 1

    try:
        tokens = parse_tokens()
        template_input = load_input_file(args.input)
    except (FileNotFoundError, RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if len(tokens) < len(PLANS):
        print(
            f"Error: need at least {len(PLANS)} tokens, but only found {len(tokens)} token(s).",
            file=sys.stderr,
        )
        return 1

    output_dir = build_output_dir(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    started_at = datetime.now().isoformat(timespec="seconds")
    max_workers = args.max_workers or min(len(PLANS), len(tokens), 10)
    manifest: dict[str, Any] = {
        "startedAt": started_at,
        "actorId": ACTOR_ID,
        "templateInput": str(args.input),
        "outputDir": str(output_dir),
        "perTypeLimit": args.per_type_limit,
        "minRating": args.min_rating,
        "maxReviews": args.max_reviews,
        "maxImages": args.max_images,
        "compactReviewLimit": args.compact_review_limit,
        "maxWorkers": max_workers,
        "plans": [asdict(plan) for plan in PLANS],
        "results": [],
    }
    save_json(manifest, output_dir / "manifest.json")

    print(f"Starting batch crawl with {len(PLANS)} accommodation types and {max_workers} worker(s).")
    print(f"Output directory: {output_dir}")

    results: list[dict[str, Any]] = []
    all_filtered_raw_items: list[dict[str, Any]] = []
    all_compact_items: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_plan = {
            executor.submit(
                run_single_plan,
                token=tokens[index],
                token_index=index,
                plan=plan,
                template_input=template_input,
                output_dir=output_dir,
                per_type_limit=args.per_type_limit,
                min_rating=args.min_rating,
                max_reviews=args.max_reviews,
                max_images=args.max_images,
                compact_review_limit=args.compact_review_limit,
            ): plan
            for index, plan in enumerate(PLANS)
        }

        for future in as_completed(future_to_plan):
            plan = future_to_plan[future]
            try:
                result = future.result()
                print(
                    f"Completed {plan.label}: {result['compactCount']} place(s), dataset={result['datasetId']}"
                )
                results.append(result)

                with Path(result["rawOutputPath"]).open("r", encoding="utf-8") as file:
                    all_filtered_raw_items.extend(json.load(file))
                with Path(result["compactOutputPath"]).open("r", encoding="utf-8") as file:
                    all_compact_items.extend(json.load(file))
            except Exception as exc:  # noqa: BLE001
                error_result = {
                    "status": "error",
                    "plan": asdict(plan),
                    "error": str(exc),
                }
                print(f"Plan {plan.label} failed: {exc}", file=sys.stderr)
                results.append(error_result)

    combined_raw = combine_deduped(all_filtered_raw_items)
    combined_compact = combine_deduped(all_compact_items)
    combined_raw_path = output_dir / "all_types_raw_combined.json"
    combined_compact_path = output_dir / "all_types_compact_combined.json"
    save_json(combined_raw, combined_raw_path)
    save_json(combined_compact, combined_compact_path)

    manifest["completedAt"] = datetime.now().isoformat(timespec="seconds")
    manifest["results"] = results
    manifest["combinedRawOutputPath"] = str(combined_raw_path)
    manifest["combinedCompactOutputPath"] = str(combined_compact_path)
    manifest["combinedRawCount"] = len(combined_raw)
    manifest["combinedCompactCount"] = len(combined_compact)
    save_json(manifest, output_dir / "manifest.json")

    print_run_summary(results)
    print(f"Combined raw output    : {combined_raw_path}")
    print(f"Combined compact output: {combined_compact_path}")
    print(f"Combined unique places : {len(combined_compact)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
