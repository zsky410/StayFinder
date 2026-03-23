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
DEFAULT_INPUT_PATH = BASE_DIR / "examples" / "google_maps_demo_input.json"
DEFAULT_OUTPUT_PATH = BASE_DIR / "output" / "google_maps_demo_results.json"
DEFAULT_SOCIAL_MEDIA_FLAGS = {
    "facebooks": False,
    "instagrams": False,
    "youtubes": False,
    "tiktoks": False,
    "twitters": False,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a simple Google Maps scrape on Apify for demo purposes."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help="Path to a JSON file with Apify actor input.",
    )
    parser.add_argument(
        "--term",
        action="append",
        dest="terms",
        help="Search term. Repeat this flag to pass multiple terms.",
    )
    parser.add_argument(
        "--location",
        help="Location query such as 'Ho Chi Minh City, Vietnam'.",
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
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Where to save the dataset items as JSON.",
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
    if token:
        return token
    raise RuntimeError("APIFY_TOKEN is invalid.")


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


def print_preview(items: list[dict[str, Any]]) -> None:
    if not items:
        print("No places returned by Apify.")
        return

    preview_count = min(5, len(items))
    print(f"Fetched {len(items)} place(s). Previewing {preview_count}:")
    for index, item in enumerate(items[:preview_count], start=1):
        title = item.get("title") or "(no title)"
        category = item.get("categoryName") or "-"
        address = item.get("address") or "-"
        rating = item.get("totalScore")
        phone = item.get("phone") or "-"
        website = item.get("website") or "-"
        print(f"{index}. {title}")
        print(f"   category: {category}")
        print(f"   address : {address}")
        print(f"   rating  : {rating if rating is not None else '-'}")
        print(f"   phone   : {phone}")
        print(f"   website : {website}")


def save_output(items: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(items, file, ensure_ascii=False, indent=2)


def main() -> int:
    args = parse_args()

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

    items = list(client.dataset(dataset_id).iterate_items())
    save_output(items, args.output)
    print(f"Run ID      : {run_id}")
    print(f"Dataset ID  : {dataset_id}")
    print(f"Dataset URL : https://console.apify.com/storage/datasets/{dataset_id}")
    print(f"Saved JSON  : {args.output}")
    print_preview(items)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
