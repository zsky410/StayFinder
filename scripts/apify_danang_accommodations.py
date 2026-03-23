#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from apify_client import ApifyClient
from apify_client._errors import ApifyApiError
from dotenv import load_dotenv

ACTOR_ID = "compass/crawler-google-places"
BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_PATH = BASE_DIR / "examples" / "danang_accommodation_demo_input.json"
DEFAULT_OUTPUT_PATH = BASE_DIR / "output" / "danang_accommodations_demo_500.json"
DEFAULT_OUTPUT_LIMIT = 500
DEFAULT_MIN_RATING = 2.5
DEFAULT_SOCIAL_MEDIA_FLAGS = {
    "facebooks": False,
    "instagrams": False,
    "youtubes": False,
    "tiktoks": False,
    "twitters": False,
}
REMOVE_KEYS = {
    "imageCategories",
    "similarHotelsNearby",
    "ownerUpdates",
    "fid",
    "cid",
    "kgmid",
    "googleFoodUrl",
    "gasPrices",
    "inputPlaceId",
    "inputStartUrl",
    "userPlaceNote",
    "webResults",
    "tableReservationLinks",
    "bookingLinks",
    "orderBy",
    "leadsEnrichment",
    "restaurantData",
    "reserveTableUrl",
    "menu",
    "floor",
    "subTitle",
    "locatedIn",
    "additionalOpeningHours",
    "openingHoursBusinessConfirmationText",
    "hotelReviewSummary",
    "questionsAndAnswers",
    "peopleAlsoSearch",
    "placesTags",
    "reviewsTags",
    "images",
    "imageUrls",
    "reviewImageUrls",
    "phoneUnformatted",
    "claimThisBusiness",
    "permanentlyClosed",
    "temporarilyClosed",
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crawl Da Nang accommodations from Apify and save a compact 500-place JSON."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help="Path to a JSON file with Apify actor input.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Where to save the filtered dataset items as JSON.",
    )
    parser.add_argument(
        "--output-limit",
        type=int,
        default=DEFAULT_OUTPUT_LIMIT,
        help="Maximum number of final places to save.",
    )
    parser.add_argument(
        "--min-rating",
        type=float,
        default=DEFAULT_MIN_RATING,
        help="Post-filter minimum totalScore to keep in the final output.",
    )
    parser.add_argument(
        "--term",
        action="append",
        dest="terms",
        help="Search term. Repeat this flag to pass multiple terms.",
    )
    parser.add_argument(
        "--location",
        help="Location query such as 'Da Nang, Vietnam'.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Override maxCrawledPlacesPerSearch.",
    )
    parser.add_argument(
        "--language",
        help="Override language, for example 'vi' or 'en'.",
    )
    parser.add_argument(
        "--detail-page",
        action="store_true",
        help="Enable scrapePlaceDetailPage for richer output.",
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


def build_run_input(args: argparse.Namespace) -> dict[str, Any]:
    run_input = load_input_file(args.input)
    run_input.setdefault("scrapeSocialMediaProfiles", DEFAULT_SOCIAL_MEDIA_FLAGS.copy())
    run_input.setdefault("maximumLeadsEnrichmentRecords", 0)
    run_input.setdefault("maxImages", 0)

    if args.terms:
        run_input["searchStringsArray"] = args.terms
    if args.location:
        run_input["locationQuery"] = args.location
    if args.limit is not None:
        if args.limit < 1:
            raise ValueError("--limit must be greater than 0.")
        run_input["maxCrawledPlacesPerSearch"] = args.limit
    if args.language:
        run_input["language"] = args.language
    if args.detail_page:
        run_input["scrapePlaceDetailPage"] = True

    if not run_input.get("searchStringsArray"):
        raise ValueError("Input must contain searchStringsArray.")

    return run_input


def ensure_token() -> str:
    load_dotenv()
    token = (os.getenv("APIFY_TOKEN") or "").strip()
    if not token:
        raise RuntimeError(
            "Missing APIFY_TOKEN. Create a .env file from .env.example or export APIFY_TOKEN in your shell."
        )
    if "xxxxxxxx" in token.lower():
        raise RuntimeError(
            "APIFY_TOKEN in .env is still the placeholder value. Replace it with the real token from Apify Console."
        )
    return token


def validate_token(client: ApifyClient) -> str:
    try:
        user = client.user().get()
    except ApifyApiError as exc:
        if exc.status_code in {401, 403, 404}:
            raise RuntimeError(
                "APIFY_TOKEN is not valid. Open Apify Console > Settings > Integrations, copy a fresh API token, and update .env."
            ) from exc
        raise RuntimeError(f"Apify API error while verifying token: {exc}") from exc

    if not user:
        raise RuntimeError("Apify did not return user information for this token.")

    return user.get("username") or user.get("email") or "unknown-user"


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return value.casefold()


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
        compacted: dict[str, Any] = {}
        for key, nested_value in value.items():
            if key in REMOVE_KEYS:
                continue
            compacted[key] = compact_value(nested_value)
        return compacted
    return value


def prepare_items(
    items: list[dict[str, Any]],
    *,
    min_rating: float,
    output_limit: int,
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
        kept.append(compact_value(item))

        if len(kept) >= output_limit:
            break

    stats["final"] = len(kept)
    return kept, stats


def print_preview(items: list[dict[str, Any]]) -> None:
    if not items:
        print("No places returned after filtering.")
        return

    preview_count = min(5, len(items))
    print(f"Final output contains {len(items)} place(s). Previewing {preview_count}:")
    for index, item in enumerate(items[:preview_count], start=1):
        title = item.get("title") or "(no title)"
        category = item.get("categoryName") or "-"
        address = item.get("address") or "-"
        rating = item.get("totalScore")
        reviews = item.get("reviewsCount")
        print(f"{index}. {title}")
        print(f"   category: {category}")
        print(f"   address : {address}")
        print(f"   rating  : {rating if rating is not None else '-'}")
        print(f"   reviews : {reviews if reviews is not None else '-'}")


def save_output(items: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(items, file, ensure_ascii=False, indent=2)
        file.write("\n")


def main() -> int:
    args = parse_args()
    if args.output_limit < 1:
        print("Error: --output-limit must be greater than 0.", file=sys.stderr)
        return 1
    if args.min_rating < 0:
        print("Error: --min-rating must be 0 or greater.", file=sys.stderr)
        return 1

    try:
        token = ensure_token()
        run_input = build_run_input(args)
    except (FileNotFoundError, RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    client = ApifyClient(token)
    try:
        username = validate_token(client)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Authenticated as Apify user: {username}")
    print(f"Starting Apify actor: {ACTOR_ID}")
    print(json.dumps(run_input, ensure_ascii=False, indent=2))

    try:
        run = client.actor(ACTOR_ID).call(run_input=run_input)
    except Exception as exc:  # noqa: BLE001
        print(f"Error: failed to run actor: {exc}", file=sys.stderr)
        return 1

    dataset_id = run.get("defaultDatasetId")
    run_id = run.get("id")
    if not dataset_id:
        print("Error: actor finished without defaultDatasetId.", file=sys.stderr)
        return 1

    raw_items = list(client.dataset(dataset_id).iterate_items())
    prepared_items, stats = prepare_items(
        raw_items,
        min_rating=args.min_rating,
        output_limit=args.output_limit,
    )
    save_output(prepared_items, args.output)

    print(f"Run ID      : {run_id}")
    print(f"Dataset ID  : {dataset_id}")
    print(f"Dataset URL : https://console.apify.com/storage/datasets/{dataset_id}")
    print(f"Saved JSON  : {args.output}")
    print(
        "Filter stats: "
        f"raw={stats['raw']}, "
        f"non_danang={stats['rejected_non_danang']}, "
        f"low_rating={stats['rejected_low_rating']}, "
        f"non_accommodation={stats['rejected_non_accommodation']}, "
        f"duplicates={stats['rejected_duplicates']}, "
        f"final={stats['final']}"
    )
    print_preview(prepared_items)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
