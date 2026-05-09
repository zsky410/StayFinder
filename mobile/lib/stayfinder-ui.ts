import type { ImageSourcePropType } from "react-native";

import type { LandmarkMetric, PlaceDetail, PlaceSummary } from "@/lib/stayfinder";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const blockedImageUrlMarkers = [
  "streetviewpixels-pa.googleapis.com",
  "/gps-cs-s/",
  "/geougc-cs/",
];

export function formatRating(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Mới";
  }

  return value.toFixed(1);
}

export function formatReviewCount(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "Chưa có review";
  }

  return `${new Intl.NumberFormat("vi-VN").format(value)} review`;
}

export function formatDistanceMeters(distanceM: number | null | undefined) {
  if (typeof distanceM !== "number" || Number.isNaN(distanceM)) {
    return "Chưa có khoảng cách";
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distanceM)}m`;
}

export function formatLocation(place: Pick<PlaceSummary, "neighborhood" | "district" | "address">) {
  const parts = [place.neighborhood, place.district].filter(Boolean);
  if (parts.length) {
    return parts.join(" • ");
  }

  return place.address || "Đà Nẵng";
}

export function formatPriceText(value: string | null | undefined) {
  const cleaned = String(value || "").trim();
  if (!cleaned || ["null", "n/a", "na", "none", "unknown"].includes(cleaned.toLowerCase())) {
    return "Liên hệ";
  }

  return cleaned;
}

export function getImageSource(
  imageUrl: string | null | undefined,
  fallback: ImageSourcePropType,
): ImageSourcePropType {
  const cleaned = String(imageUrl || "").trim();
  if (!cleaned) {
    return fallback;
  }

  return { uri: cleaned };
}

export function isLikelyUsableImageUrl(imageUrl: string | null | undefined) {
  const cleaned = String(imageUrl || "").trim();
  if (!cleaned) {
    return false;
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    return false;
  }

  return !blockedImageUrlMarkers.some((marker) => cleaned.includes(marker));
}

export function filterUsableImageUrls(imageUrls: Array<string | null | undefined>) {
  return Array.from(new Set(imageUrls.map((imageUrl) => String(imageUrl || "").trim()).filter(isLikelyUsableImageUrl)));
}

export function getNearestLandmark(metrics: LandmarkMetric[] | null | undefined) {
  if (!metrics?.length) {
    return null;
  }

  return metrics.find((metric) => typeof metric.distance_m === "number") || metrics[0] || null;
}

export function buildDistanceLabel(place: Pick<PlaceSummary, "nearest_landmarks" | "requested_landmark_distance_m">) {
  if (typeof place.requested_landmark_distance_m === "number") {
    return `Cách ${formatDistanceMeters(place.requested_landmark_distance_m)}`;
  }

  const nearest = getNearestLandmark(place.nearest_landmarks);
  if (!nearest) {
    return "Xem vị trí chi tiết";
  }

  return `Gần ${nearest.landmark_name} ${formatDistanceMeters(nearest.distance_m)}`;
}

export function derivePlaceTags(
  place:
    | Pick<PlaceSummary, "type_slug" | "amenities_preview" | "nearest_landmarks">
    | Pick<PlaceDetail, "type_slug" | "amenities" | "landmark_metrics">,
) {
  const tags: string[] = [];
  const amenityLabels =
    "amenities_preview" in place
      ? place.amenities_preview
      : place.amenities.map((amenity) => amenity.label);
  const landmarks = "nearest_landmarks" in place ? place.nearest_landmarks : place.landmark_metrics;
  const normalizedAmenities = amenityLabels.map((label) => normalizeText(label));

  if (place.type_slug) {
    tags.push(place.type_slug.replace(/-/g, " "));
  }
  if (normalizedAmenities.some((label) => label.includes("wifi"))) {
    tags.push("Wi-Fi");
  }
  if (normalizedAmenities.some((label) => label.includes("tre em"))) {
    tags.push("Gia đình");
  }
  if (normalizedAmenities.some((label) => label.includes("be boi") || label.includes("ho boi"))) {
    tags.push("Hồ bơi");
  }
  if (normalizedAmenities.some((label) => label.includes("san bay"))) {
    tags.push("Đưa đón sân bay");
  }
  if (landmarks.some((landmark) => landmark.landmark_slug === "my-khe-beach")) {
    tags.push("Gần biển");
  }
  if (landmarks.some((landmark) => landmark.landmark_slug === "dragon-bridge")) {
    tags.push("Gần trung tâm");
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

export function pickAmenityLabels(place: PlaceDetail, limit?: number) {
  const labels = Array.from(
    new Set(
      place.amenities
        .map((amenity) => amenity.label.trim())
        .filter(Boolean),
    ),
  );

  if (typeof limit === "number") {
    return labels.slice(0, limit);
  }

  return labels;
}
