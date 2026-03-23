#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def unique_values(values):
    seen = set()
    result = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def parse_price(value):
    if not value:
        return None
    chars = []
    dot_used = False
    for char in str(value).replace(",", "."):
        if char.isdigit():
            chars.append(char)
        elif char == "." and not dot_used:
            chars.append(char)
            dot_used = True
        elif chars:
            break
    if not chars:
        return None
    try:
        return float("".join(chars))
    except ValueError:
        return None


def extract_amenities(additional_info):
    buckets = []
    for value in (additional_info or {}).values():
        if isinstance(value, list):
            buckets.extend(value)

    enabled = []
    for entry in buckets:
        if not isinstance(entry, dict):
            continue
        for name, enabled_flag in entry.items():
            if enabled_flag is True:
                enabled.append(name)

    return unique_values(enabled)[:6]


def pick_best_offer(hotel_ads):
    offers = []
    for offer in hotel_ads or []:
        if not isinstance(offer, dict):
            continue
        offers.append(
            {
                "title": offer.get("title"),
                "price": offer.get("price"),
                "url": offer.get("url") or offer.get("googleUrl"),
                "isOfficialSite": offer.get("isOfficialSite"),
                "parsedPrice": parse_price(offer.get("price")),
            }
        )

    offers.sort(
        key=lambda offer: (
            offer["parsedPrice"] is None,
            offer["parsedPrice"] if offer["parsedPrice"] is not None else 10**12,
        )
    )

    if not offers:
        return None

    best_offer = offers[0]
    return {
        "title": best_offer.get("title"),
        "price": best_offer.get("price"),
        "url": best_offer.get("url"),
        "isOfficialSite": best_offer.get("isOfficialSite"),
    }


def build_index_item(item):
    gallery_images = unique_values([*(item.get("galleryImages") or []), item.get("imageUrl")])[:5]
    review_image_count = sum(
        len(unique_values(review.get("reviewImageUrls") or []))
        for review in (item.get("reviews") or [])
        if isinstance(review, dict)
    )

    return {
        "crawlCategorySlug": item.get("crawlCategorySlug"),
        "crawlCategoryLabel": item.get("crawlCategoryLabel"),
        "crawlSearchTerms": item.get("crawlSearchTerms"),
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
        "location": item.get("location"),
        "totalScore": item.get("totalScore"),
        "placeId": item.get("placeId"),
        "categories": item.get("categories"),
        "reviewsCount": item.get("reviewsCount"),
        "imagesCount": item.get("imagesCount"),
        "scrapedAt": item.get("scrapedAt"),
        "hotelStars": item.get("hotelStars"),
        "hotelDescription": item.get("hotelDescription"),
        "checkInDate": item.get("checkInDate"),
        "checkOutDate": item.get("checkOutDate"),
        "openingHours": item.get("openingHours"),
        "url": item.get("url"),
        "searchString": item.get("searchString"),
        "language": item.get("language"),
        "rank": item.get("rank"),
        "isAdvertisement": item.get("isAdvertisement"),
        "imageUrl": item.get("imageUrl"),
        "galleryImages": gallery_images,
        "popularTimesLiveText": item.get("popularTimesLiveText"),
        "amenities": extract_amenities(item.get("additionalInfo")),
        "bestOffer": pick_best_offer(item.get("hotelAds")),
        "reviewImageCount": review_image_count,
    }


def main():
    parser = argparse.ArgumentParser(description="Build lightweight web dataset from a batch crawl.")
    parser.add_argument("--batch-dir", required=True, help="Folder containing batch compact files.")
    parser.add_argument("--output-dir", required=True, help="Public data folder to write index/chunks into.")
    args = parser.parse_args()

    batch_dir = Path(args.batch_dir)
    output_dir = Path(args.output_dir)
    details_dir = output_dir / "details"

    combined_path = batch_dir / "all_types_compact_combined.json"
    if not combined_path.exists():
        raise SystemExit(f"Missing combined compact file: {combined_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    details_dir.mkdir(parents=True, exist_ok=True)

    with combined_path.open("r", encoding="utf-8") as handle:
        combined_data = json.load(handle)

    index_data = [build_index_item(item) for item in combined_data]

    index_path = output_dir / "index.json"
    with index_path.open("w", encoding="utf-8") as handle:
        json.dump(index_data, handle, ensure_ascii=False, separators=(",", ":"))

    detail_files = []
    for source_path in sorted(batch_dir.glob("*_compact.json")):
        slug = source_path.name.replace("_compact.json", "")
        destination_path = details_dir / f"{slug}.json"
        shutil.copy2(source_path, destination_path)
        detail_files.append(destination_path.name)

    manifest = {
        "batchFolder": batch_dir.name,
        "indexFile": index_path.name,
        "detailFiles": detail_files,
        "placesCount": len(index_data),
    }
    with (output_dir / "manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)

    print(f"Built index with {len(index_data)} places at {index_path}")
    print(f"Copied {len(detail_files)} detail files into {details_dir}")


if __name__ == "__main__":
    main()
