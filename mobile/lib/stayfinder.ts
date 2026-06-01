import Constants from "expo-constants";

export type LandmarkMetric = {
  landmark_slug: string;
  landmark_name: string;
  distance_m: number | null;
  method: string | null;
  anchor_label: string | null;
};

export type PlaceSummary = {
  id: string;
  place_id: string;
  title: string;
  type_slug: string | null;
  address: string | null;
  neighborhood: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews_count: number | null;
  price_text: string | null;
  cover_image: string | null;
  amenities_preview: string[];
  nearest_landmarks: LandmarkMetric[];
  requested_landmark_distance_m: number | null;
};

export type PlaceDetailAmenity = {
  slug: string;
  label: string;
};

export type ReviewSample = {
  stars: number | null;
  review_text: string | null;
  text_translated: string | null;
  likes_count: number | null;
  published_at: string | null;
  images: string[];
};

export type AiReviewSummary = {
  summary_text: string;
  bullets: string[];
  model: string | null;
  prompt_version: string | null;
  source_review_count: number;
  metadata: Record<string, unknown>;
  updated_at?: string | null;
  source?: string | null;
};

export type ReviewSummaryResponse = AiReviewSummary & {
  place_id: string;
  title: string;
};

export type ChatQueryResponse = {
  answer: string;
  applied_filters: {
    type_slugs: string[];
    landmark_slugs: string[];
    zone_slugs: string[];
    amenity_labels: string[];
    min_rating: number | null;
    max_distance_m: number | null;
    signals: string[];
  };
  recommended_places: PlaceSummary[];
  local_context_used: Array<{
    slug: string;
    title: string;
    subject_kind: string | null;
    subject_slug: string | null;
    content: string;
    tags: string[];
  }>;
  follow_up_prompts: string[];
  meta: {
    query: string;
    should_recommend_places?: boolean;
    semantic_error: string | null;
    semantic_matches: unknown[];
  };
};

export type FetchReviewSummaryOptions = {
  refresh?: boolean;
  useLlm?: boolean;
  timeoutMs?: number;
};

export type PlaceDetail = {
  id: string;
  place_id: string;
  title: string;
  type_slug: string | null;
  type_label: string | null;
  description: string | null;
  category_name: string | null;
  address: string | null;
  neighborhood: string | null;
  district: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews_count: number | null;
  cover_image: string | null;
  gallery: string[];
  phone: string | null;
  website: string | null;
  opening_hours: Record<string, unknown> | null;
  additional_info: Record<string, unknown> | null;
  price_text: string | null;
  hotel_description: string | null;
  amenities: PlaceDetailAmenity[];
  reviews_sample: ReviewSample[];
  landmark_metrics: LandmarkMetric[];
  ai_review_summary: AiReviewSummary | null;
};

export type PlacesResponse = {
  total: number;
  page: number;
  page_size: number;
  items: PlaceSummary[];
};

export type FiltersMeta = {
  types: Array<{ value: string; label: string; count: number }>;
  districts: Array<{ value: string; count: number }>;
  neighborhoods: Array<{ value: string; count: number }>;
  amenities: Array<{ slug: string; label: string; count: number }>;
  landmarks: Array<{ slug: string; name: string; places_count: number }>;
  rating_range: { min: number | null; max: number | null };
};

export type PlacesQuery = {
  q?: string;
  typeSlugs?: string[];
  districts?: string[];
  neighborhoods?: string[];
  amenityLabels?: string[];
  landmarkSlugs?: string[];
  minRating?: number | null;
  maxDistanceM?: number | null;
  sort?: "rating_desc" | "reviews_desc" | "title_asc" | "distance_asc" | "random" | "price_available_desc";
  page?: number;
  limit?: number;
};

type ExpoConstantsWithHost = typeof Constants & {
  expoConfig?: {
    hostUri?: string | null;
    extra?: {
      apiPort?: string | number | null;
      apiBaseUrl?: string | null;
    } | null;
  } | null;
  manifest2?: {
    extra?: {
      expoClient?: { hostUri?: string | null } | null;
    } | null;
  } | null;
  manifest?: { debuggerHost?: string | null } | null;
  linkingUri?: string | null;
};

function extractHost(rawValue: string | null | undefined) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return null;
  }

  if (value.includes("://")) {
    try {
      return new URL(value).hostname;
    } catch {
      return null;
    }
  }

  return value.split("/")[0]?.split(":")[0] || null;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function buildHttpBaseUrl(host: string, port: string) {
  return normalizeBaseUrl(`http://${host}:${port}`);
}

function resolveApiBaseUrl() {
  const explicitBaseUrl = String(process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  const constants = Constants as ExpoConstantsWithHost;
  const manifestBaseUrl = String(constants.expoConfig?.extra?.apiBaseUrl ?? "").trim();
  if (manifestBaseUrl) {
    return normalizeBaseUrl(manifestBaseUrl);
  }

  const apiPort =
    String(process.env.EXPO_PUBLIC_API_PORT || "").trim() ||
    String(constants.expoConfig?.extra?.apiPort ?? "").trim() ||
    "3000";
  const candidateHosts = [
    constants.expoConfig?.hostUri,
    constants.manifest2?.extra?.expoClient?.hostUri,
    constants.linkingUri,
    constants.manifest?.debuggerHost,
  ];

  for (const candidate of candidateHosts) {
    const detectedHost = extractHost(candidate);
    if (detectedHost && detectedHost !== "127.0.0.1" && detectedHost !== "localhost") {
      return buildHttpBaseUrl(detectedHost, apiPort);
    }
  }

  const debuggerHost = extractHost(constants.manifest?.debuggerHost);
  if (debuggerHost) {
    return buildHttpBaseUrl(debuggerHost, apiPort);
  }

  return buildHttpBaseUrl("127.0.0.1", apiPort);
}

export const stayfinderApiBaseUrl = resolveApiBaseUrl();
const REQUEST_TIMEOUT_MS = 8000;

function formatNetworkError(error: unknown, url: string, label: string) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return `${label} timeout: ${url}`;
    }
    if (error.message === "Network request failed") {
      return `${label} network failed: ${url}`;
    }
    return `${error.message} (${url})`;
  }
  return `${label} failed: ${url}`;
}

function appendQueryValue(searchParams: URLSearchParams, key: string, values: string[]) {
  for (const value of values) {
    const cleaned = String(value || "").trim();
    if (cleaned) {
      searchParams.append(key, cleaned);
    }
  }
}

function buildUrl(pathname: string, query: PlacesQuery | Record<string, string | number | undefined> = {}) {
  const url = new URL(pathname, `${stayfinderApiBaseUrl}/`);
  const searchParams = new URLSearchParams();

  if ("q" in query && query.q) {
    searchParams.set("q", String(query.q).trim());
  }
  if ("typeSlugs" in query && Array.isArray(query.typeSlugs)) {
    appendQueryValue(searchParams, "type", query.typeSlugs);
  }
  if ("districts" in query && Array.isArray(query.districts)) {
    appendQueryValue(searchParams, "district", query.districts);
  }
  if ("neighborhoods" in query && Array.isArray(query.neighborhoods)) {
    appendQueryValue(searchParams, "neighborhood", query.neighborhoods);
  }
  if ("amenityLabels" in query && Array.isArray(query.amenityLabels)) {
    appendQueryValue(searchParams, "amenity", query.amenityLabels);
  }
  if ("landmarkSlugs" in query && Array.isArray(query.landmarkSlugs)) {
    appendQueryValue(searchParams, "landmark", query.landmarkSlugs);
  }
  if ("minRating" in query && query.minRating !== null && query.minRating !== undefined) {
    searchParams.set("min_rating", String(query.minRating));
  }
  if ("maxDistanceM" in query && query.maxDistanceM !== null && query.maxDistanceM !== undefined) {
    searchParams.set("max_distance_m", String(query.maxDistanceM));
  }
  if ("sort" in query && query.sort) {
    searchParams.set("sort", String(query.sort));
  }
  if ("page" in query && query.page) {
    searchParams.set("page", String(query.page));
  }
  if ("limit" in query && query.limit) {
    searchParams.set("limit", String(query.limit));
  }

  for (const [key, value] of Object.entries(query)) {
    if (
      ["q", "typeSlugs", "districts", "neighborhoods", "amenityLabels", "landmarkSlugs", "minRating", "maxDistanceM", "sort", "page", "limit"].includes(
        key,
      )
    ) {
      continue;
    }

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value));
    }
  }

  url.search = searchParams.toString();
  return url.toString();
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: { message?: string }; message?: string };
    return payload.error?.message || payload.message || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

async function fetchJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const url = buildUrl(pathname);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(init?.headers || {}),
      },
      ...init,
      signal: init?.signal || controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`API timeout after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw new Error(formatNetworkError(error, url, "API request"));
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function fetchPlaces(query: PlacesQuery = {}) {
  const url = buildUrl("/places", query);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`API timeout after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw new Error(formatNetworkError(error, url, "Places request"));
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as PlacesResponse;
}

export function fetchPlaceDetail(placeId: string) {
  return fetchJson<PlaceDetail>(`/places/${encodeURIComponent(placeId)}`);
}

export function fetchFiltersMeta() {
  return fetchJson<FiltersMeta>("/filters/meta");
}

const REVIEW_SUMMARY_TIMEOUT_MS = 45_000;
const CHAT_QUERY_TIMEOUT_MS = 45_000;

export async function fetchChatQuery(query: string, timeoutMs = CHAT_QUERY_TIMEOUT_MS): Promise<ChatQueryResponse> {
  const url = buildUrl("/chat/query");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        generate: true,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI chat timeout sau ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error(formatNetworkError(error, url, "AI chat request"));
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as ChatQueryResponse;
}

export async function fetchReviewSummary(
  placeId: string,
  options: FetchReviewSummaryOptions = {},
): Promise<ReviewSummaryResponse> {
  const url = buildUrl("/ai/review-summary");
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? REVIEW_SUMMARY_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        placeId,
        refresh: options.refresh === true,
        useLlm: options.useLlm,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI summary timeout sau ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error(formatNetworkError(error, url, "AI summary request"));
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as ReviewSummaryResponse;
}
