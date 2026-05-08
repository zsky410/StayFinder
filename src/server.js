import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { pool, query, withTransaction } from "./db.js";
import {
  HttpError,
  asyncRoute,
  badRequest,
  errorMiddleware,
  notFound,
  serviceUnavailable,
  unauthorized,
} from "./errors.js";
import {
  asNullableNumber,
  asNullableText,
  coerceRowNumber,
  ensureArrayOfStrings,
  ensurePlainObject,
  formatDistance,
  parseBoolean,
  parseFloatNumber,
  parseInteger,
  parseStringList,
  uniqueStrings,
} from "./utils.js";

const app = express();
const adminJobs = new Map();
const ADMIN_JOB_RETENTION_MS = 30 * 60 * 1000;

app.use(express.json({ limit: "2mb" }));
app.use(
  cors(
    config.corsOrigins.length
      ? {
          origin(origin, callback) {
            if (!origin || config.corsOrigins.includes(origin)) {
              callback(null, true);
              return;
            }
            callback(new HttpError(403, "Origin is not allowed."));
          },
        }
      : undefined,
  ),
);

function makeParamBag() {
  const params = [];
  return {
    params,
    push(value) {
      params.push(value);
      return `$${params.length}`;
    },
  };
}

function cleanupAdminJobs() {
  const now = Date.now();
  for (const [jobId, job] of adminJobs.entries()) {
    if (!job.finished_at) {
      continue;
    }
    const finishedAt = new Date(job.finished_at).getTime();
    if (Number.isFinite(finishedAt) && now - finishedAt > ADMIN_JOB_RETENTION_MS) {
      adminJobs.delete(jobId);
    }
  }
}

function serializeAdminJob(job) {
  return {
    job_id: job.id,
    job_type: job.type,
    status: job.status,
    submitted_at: job.submitted_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    result: job.result ?? null,
    error: job.error ?? null,
  };
}

function enqueueAdminJob(type, payload, runner) {
  cleanupAdminJobs();

  const job = {
    id: randomUUID(),
    type,
    payload,
    status: "queued",
    submitted_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    result: null,
    error: null,
  };

  adminJobs.set(job.id, job);

  queueMicrotask(async () => {
    job.status = "running";
    job.started_at = new Date().toISOString();
    try {
      job.result = await runner(payload);
      job.status = "completed";
    } catch (error) {
      job.status = "failed";
      job.error = {
        message: error?.message || "Unexpected job error.",
        code: error?.code || error?.name || "job_error",
        details: error?.details || null,
      };
    } finally {
      job.finished_at = new Date().toISOString();
    }
  });

  return serializeAdminJob(job);
}

function getAdminJobOrThrow(jobId) {
  const job = adminJobs.get(jobId);
  if (!job) {
    throw notFound("Admin job not found.");
  }
  return serializeAdminJob(job);
}

async function handleAdminJobRequest(req, res, type, runner, validator = null) {
  const payload = req.body || {};
  const wait = parseBoolean(payload.wait ?? req.query.wait, false);

  if (validator) {
    validator(payload);
  }

  if (wait) {
    res.json(await runner(payload));
    return;
  }

  res.status(202).json(enqueueAdminJob(type, payload, runner));
}

function mapPlaceSummaryRow(row) {
  return {
    id: row.id,
    place_id: row.place_id,
    title: row.title,
    type_slug: row.type_slug,
    address: row.address,
    neighborhood: row.neighborhood,
    district: row.district,
    lat: coerceRowNumber(row.lat),
    lng: coerceRowNumber(row.lng),
    rating: coerceRowNumber(row.rating),
    reviews_count: row.reviews_count === null ? null : Number(row.reviews_count),
    cover_image: row.cover_image,
    amenities_preview: row.amenities_preview || [],
    nearest_landmarks: row.nearest_landmarks || [],
    requested_landmark_distance_m:
      row.requested_landmark_distance_m === null
        ? null
        : Number(row.requested_landmark_distance_m),
  };
}

function buildPlaceFilterContext(filters) {
  const bag = makeParamBag();
  const where = ["1=1"];
  let landmarkRef = null;

  if (filters.q) {
    const ref = bag.push(`%${filters.q}%`);
    where.push(`(
      COALESCE(p.title, '') ILIKE ${ref}
      OR COALESCE(p.address, '') ILIKE ${ref}
      OR COALESCE(p.neighborhood, '') ILIKE ${ref}
      OR COALESCE(p.district, '') ILIKE ${ref}
      OR COALESCE(p.category_name, '') ILIKE ${ref}
    )`);
  }

  if (filters.typeSlugs.length) {
    where.push(`p.type_slug = ANY(${bag.push(filters.typeSlugs)}::text[])`);
  }

  if (filters.districts.length) {
    where.push(`p.district = ANY(${bag.push(filters.districts)}::text[])`);
  }

  if (filters.neighborhoods.length) {
    where.push(`p.neighborhood = ANY(${bag.push(filters.neighborhoods)}::text[])`);
  }

  if (filters.minRating !== null) {
    where.push(`p.rating >= ${bag.push(filters.minRating)}`);
  }

  for (const amenityLabel of filters.amenityLabels) {
    const ref = bag.push(amenityLabel);
    where.push(`EXISTS (
      SELECT 1
      FROM place_amenities pa
      JOIN amenities a ON a.id = pa.amenity_id
      WHERE pa.place_id = p.id AND a.label = ${ref}
    )`);
  }

  if (filters.landmarkSlugs.length) {
    landmarkRef = bag.push(filters.landmarkSlugs);
    let distanceSql = "";
    if (filters.maxDistanceM !== null) {
      distanceSql = ` AND COALESCE(plm.distance_m, 999999999) <= ${bag.push(filters.maxDistanceM)}`;
    }

    where.push(`EXISTS (
      SELECT 1
      FROM place_landmark_metrics plm
      JOIN local_landmarks l ON l.id = plm.landmark_id
      WHERE plm.place_id = p.id
        AND l.slug = ANY(${landmarkRef}::text[])${distanceSql}
    )`);
  }

  return {
    params: bag.params,
    whereSql: where.join(" AND "),
    landmarkRef,
  };
}

function buildPlaceOrderSql(sort, landmarkRef) {
  switch (sort) {
    case "reviews_desc":
      return "p.reviews_count DESC NULLS LAST, p.rating DESC NULLS LAST, p.title ASC";
    case "title_asc":
      return "p.title ASC NULLS LAST";
    case "distance_asc":
      if (landmarkRef) {
        return "requested_landmark_distance_m ASC NULLS LAST, p.rating DESC NULLS LAST, p.reviews_count DESC NULLS LAST, p.title ASC";
      }
      return "p.rating DESC NULLS LAST, p.reviews_count DESC NULLS LAST, p.title ASC";
    case "rating_desc":
    default:
      return "p.rating DESC NULLS LAST, p.reviews_count DESC NULLS LAST, p.title ASC";
  }
}

async function listPlaces(filters, { mapMode = false, includeBatchKey = false } = {}) {
  const context = buildPlaceFilterContext(filters);
  const requestedDistanceSql = context.landmarkRef
    ? `(
        SELECT MIN(plm.distance_m)
        FROM place_landmark_metrics plm
        JOIN local_landmarks l ON l.id = plm.landmark_id
        WHERE plm.place_id = p.id
          AND l.slug = ANY(${context.landmarkRef}::text[])
      )`
    : "NULL::integer";

  const countResult = await query(
    `SELECT COUNT(*)::integer AS total
     FROM places p
     WHERE ${context.whereSql}`,
    context.params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  const bag = makeParamBag();
  const params = [...context.params];
  bag.params.push(...params);
  const limitRef = bag.push(filters.limit);
  const offsetRef = bag.push(filters.offset);
  const batchKeySql = includeBatchKey ? ", b.batch_key" : "";

  const result = await query(
    `SELECT
        p.id::text AS id,
        p.place_id,
        p.title,
        p.type_slug,
        p.address,
        p.neighborhood,
        p.district,
        p.lat,
        p.lng,
        p.rating,
        p.reviews_count,
        COALESCE(
          p.image_url,
          (
            SELECT pi.image_url
            FROM place_images pi
            WHERE pi.place_id = p.id
            ORDER BY pi.sort_order ASC, pi.id ASC
            LIMIT 1
          )
        ) AS cover_image,
        ARRAY(
          SELECT a.label
          FROM place_amenities pa
          JOIN amenities a ON a.id = pa.amenity_id
          WHERE pa.place_id = p.id
          ORDER BY a.label ASC
          LIMIT 8
        ) AS amenities_preview,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'landmark_slug', near.slug,
                'landmark_name', near.name,
                'distance_m', near.distance_m,
                'method', near.method,
                'anchor_label', near.anchor_label
              )
              ORDER BY near.distance_m ASC NULLS LAST, near.slug ASC
            )
            FROM (
              SELECT
                l.slug,
                l.name,
                plm.distance_m,
                plm.method,
                plm.anchor_label
              FROM place_landmark_metrics plm
              JOIN local_landmarks l ON l.id = plm.landmark_id
              WHERE plm.place_id = p.id
              ORDER BY plm.distance_m ASC NULLS LAST, l.slug ASC
              LIMIT 3
            ) AS near
          ),
          '[]'::json
        ) AS nearest_landmarks,
        ${requestedDistanceSql} AS requested_landmark_distance_m
        ${batchKeySql}
      FROM places p
      LEFT JOIN crawl_batches b ON b.id = p.batch_id
      WHERE ${context.whereSql}
      ORDER BY ${buildPlaceOrderSql(filters.sort, context.landmarkRef)}
      LIMIT ${limitRef}
      OFFSET ${offsetRef}`,
    bag.params,
  );

  const items = result.rows.map((row) => {
    const mapped = mapPlaceSummaryRow(row);
    if (includeBatchKey) {
      mapped.batch_key = row.batch_key;
    }
    return mapped;
  });

  if (mapMode) {
    const bounds = items.reduce(
      (acc, item) => {
        if (item.lat === null || item.lng === null) {
          return acc;
        }
        acc.min_lat = acc.min_lat === null ? item.lat : Math.min(acc.min_lat, item.lat);
        acc.max_lat = acc.max_lat === null ? item.lat : Math.max(acc.max_lat, item.lat);
        acc.min_lng = acc.min_lng === null ? item.lng : Math.min(acc.min_lng, item.lng);
        acc.max_lng = acc.max_lng === null ? item.lng : Math.max(acc.max_lng, item.lng);
        return acc;
      },
      { min_lat: null, max_lat: null, min_lng: null, max_lng: null },
    );

    return { total, items, bounds };
  }

  return {
    total,
    page: Math.floor(filters.offset / filters.limit) + 1,
    page_size: filters.limit,
    items,
  };
}

async function getPlaceDetail(identifier) {
  const result = await query(
    `SELECT
        p.id::text AS id,
        p.place_id,
        p.title,
        p.type_slug,
        p.type_label,
        p.description,
        p.category_name,
        p.address,
        p.neighborhood,
        p.district,
        p.city,
        p.phone,
        p.website,
        p.lat,
        p.lng,
        p.rating,
        p.reviews_count,
        p.price_text,
        p.hotel_description,
        p.opening_hours,
        p.additional_info,
        COALESCE(p.image_url, '') AS cover_image,
        COALESCE(
          (
            SELECT json_agg(pi.image_url ORDER BY pi.sort_order ASC, pi.id ASC)
            FROM place_images pi
            WHERE pi.place_id = p.id
          ),
          '[]'::json
        ) AS gallery,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'slug', a.slug,
                'label', a.label
              )
              ORDER BY a.label ASC
            )
            FROM place_amenities pa
            JOIN amenities a ON a.id = pa.amenity_id
            WHERE pa.place_id = p.id
          ),
          '[]'::json
        ) AS amenities,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'stars', sample.stars,
                'review_text', sample.review_text,
                'text_translated', sample.text_translated,
                'likes_count', sample.likes_count,
                'published_at', sample.published_at
              )
              ORDER BY sample.likes_count DESC NULLS LAST, sample.published_at DESC NULLS LAST
            )
            FROM (
              SELECT
                r.stars,
                r.review_text,
                r.text_translated,
                r.likes_count,
                r.published_at
              FROM reviews r
              WHERE r.place_id = p.id
              ORDER BY r.likes_count DESC NULLS LAST, r.published_at DESC NULLS LAST
              LIMIT 6
            ) AS sample
          ),
          '[]'::json
        ) AS reviews_sample,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'landmark_slug', lm.slug,
                'landmark_name', lm.name,
                'distance_m', plm.distance_m,
                'method', plm.method,
                'anchor_label', plm.anchor_label
              )
              ORDER BY plm.distance_m ASC NULLS LAST, lm.slug ASC
            )
            FROM place_landmark_metrics plm
            JOIN local_landmarks lm ON lm.id = plm.landmark_id
            WHERE plm.place_id = p.id
          ),
          '[]'::json
        ) AS landmark_metrics,
        (
          SELECT json_build_object(
            'summary_text', ars.summary_text,
            'bullets', ars.bullets,
            'model', ars.model,
            'prompt_version', ars.prompt_version,
            'source_review_count', ars.source_review_count,
            'metadata', ars.metadata,
            'updated_at', ars.updated_at
          )
          FROM ai_review_summaries ars
          WHERE ars.place_id = p.id
        ) AS ai_review_summary
      FROM places p
      WHERE p.id::text = $1 OR p.place_id = $1
      LIMIT 1`,
    [identifier],
  );

  const row = result.rows[0];
  if (!row) {
    throw notFound("Place not found.");
  }

  return {
    id: row.id,
    place_id: row.place_id,
    title: row.title,
    type_slug: row.type_slug,
    type_label: row.type_label,
    description: row.description,
    category_name: row.category_name,
    address: row.address,
    neighborhood: row.neighborhood,
    district: row.district,
    city: row.city,
    lat: coerceRowNumber(row.lat),
    lng: coerceRowNumber(row.lng),
    rating: coerceRowNumber(row.rating),
    reviews_count: row.reviews_count === null ? null : Number(row.reviews_count),
    cover_image: row.cover_image || null,
    gallery: row.gallery || [],
    phone: row.phone,
    website: row.website,
    opening_hours: row.opening_hours,
    additional_info: row.additional_info,
    price_text: row.price_text,
    hotel_description: row.hotel_description,
    amenities: row.amenities || [],
    reviews_sample: row.reviews_sample || [],
    landmark_metrics: row.landmark_metrics || [],
    ai_review_summary: row.ai_review_summary || null,
  };
}

async function getFiltersMeta() {
  const [types, districts, neighborhoods, amenities, landmarks, ratings] = await Promise.all([
    query(
      `SELECT
          type_slug AS value,
          COALESCE(MAX(type_label), type_slug) AS label,
          COUNT(*)::integer AS count
        FROM places
        GROUP BY type_slug
        ORDER BY count DESC, label ASC`,
    ),
    query(
      `SELECT district AS value, COUNT(*)::integer AS count
        FROM places
        WHERE district IS NOT NULL AND btrim(district) <> ''
        GROUP BY district
        ORDER BY count DESC, value ASC`,
    ),
    query(
      `SELECT neighborhood AS value, COUNT(*)::integer AS count
        FROM places
        WHERE neighborhood IS NOT NULL AND btrim(neighborhood) <> ''
        GROUP BY neighborhood
        ORDER BY count DESC, value ASC`,
    ),
    query(
      `SELECT
          a.slug,
          a.label,
          COUNT(pa.place_id)::integer AS count
        FROM amenities a
        LEFT JOIN place_amenities pa ON pa.amenity_id = a.id
        GROUP BY a.id, a.slug, a.label
        ORDER BY count DESC, a.label ASC`,
    ),
    query(
      `SELECT
          l.slug,
          l.name,
          COUNT(plm.place_id)::integer AS places_count
        FROM local_landmarks l
        LEFT JOIN place_landmark_metrics plm ON plm.landmark_id = l.id
        GROUP BY l.id, l.slug, l.name
        ORDER BY l.slug ASC`,
    ),
    query(
      `SELECT
          MIN(rating) AS min_rating,
          MAX(rating) AS max_rating
        FROM places
        WHERE rating IS NOT NULL`,
    ),
  ]);

  return {
    types: types.rows,
    districts: districts.rows,
    neighborhoods: neighborhoods.rows,
    amenities: amenities.rows,
    landmarks: landmarks.rows,
    rating_range: {
      min: coerceRowNumber(ratings.rows[0]?.min_rating),
      max: coerceRowNumber(ratings.rows[0]?.max_rating),
    },
  };
}

async function getLandmarks() {
  const result = await query(
    `SELECT
        l.id::text AS id,
        l.slug,
        l.name,
        l.kind,
        l.lat,
        l.lng,
        l.metadata,
        COUNT(plm.place_id)::integer AS places_count
      FROM local_landmarks l
      LEFT JOIN place_landmark_metrics plm ON plm.landmark_id = l.id
      GROUP BY l.id, l.slug, l.name, l.kind, l.lat, l.lng, l.metadata
      ORDER BY l.slug ASC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    lat: coerceRowNumber(row.lat),
    lng: coerceRowNumber(row.lng),
    metadata: row.metadata || {},
    places_count: Number(row.places_count || 0),
  }));
}

async function getPlaceSummariesByPlaceIds(placeIds) {
  return getPlaceSummariesByPlaceIdsWithMetrics(placeIds);
}

async function getPlaceSummariesByPlaceIdsWithMetrics(
  placeIds,
  { matchedLandmarkByPlaceId = new Map() } = {},
) {
  const cleaned = uniqueStrings(placeIds);
  if (!cleaned.length) {
    return [];
  }

  const result = await query(
    `SELECT
        p.id::text AS id,
        p.place_id,
        p.title,
        p.type_slug,
        p.address,
        p.neighborhood,
        p.district,
        p.lat,
        p.lng,
        p.rating,
        p.reviews_count,
        COALESCE(p.image_url, '') AS cover_image,
        ARRAY(
          SELECT a.label
          FROM place_amenities pa
          JOIN amenities a ON a.id = pa.amenity_id
          WHERE pa.place_id = p.id
          ORDER BY a.label ASC
          LIMIT 8
        ) AS amenities_preview,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'landmark_slug', near.slug,
                'landmark_name', near.name,
                'distance_m', near.distance_m,
                'method', near.method,
                'anchor_label', near.anchor_label
              )
              ORDER BY near.distance_m ASC NULLS LAST, near.slug ASC
            )
            FROM (
              SELECT
                l.slug,
                l.name,
                plm.distance_m,
                plm.method,
                plm.anchor_label
              FROM place_landmark_metrics plm
              JOIN local_landmarks l ON l.id = plm.landmark_id
              WHERE plm.place_id = p.id
              ORDER BY plm.distance_m ASC NULLS LAST, l.slug ASC
              LIMIT 3
            ) AS near
          ),
          '[]'::json
        ) AS nearest_landmarks
      FROM places p
      WHERE p.place_id = ANY($1::text[])`,
    [cleaned],
  );

  const order = new Map(cleaned.map((placeId, index) => [placeId, index]));
  return result.rows
    .map((row) => {
      const mapped = mapPlaceSummaryRow({ ...row, requested_landmark_distance_m: null });
      const matchedLandmark = matchedLandmarkByPlaceId.get(mapped.place_id) || null;
      if (matchedLandmark) {
        mapped.requested_landmark_distance_m = matchedLandmark.distance_m ?? null;
        mapped.matched_landmark = matchedLandmark;
      }
      return mapped;
    })
    .sort((left, right) => order.get(left.place_id) - order.get(right.place_id));
}

function buildRecommendedPlaceIdOrder(result, limit) {
  const orderedIds = [];

  for (const place of result.structured_candidates || []) {
    if (place?.place_id) {
      orderedIds.push(place.place_id);
    }
  }

  for (const match of result.semantic_matches || []) {
    const semanticPlaceId = match?.google_place_id || null;
    if (semanticPlaceId) {
      orderedIds.push(semanticPlaceId);
    }
  }

  return uniqueStrings(orderedIds).slice(0, limit);
}

async function fetchMatchedLandmarksForPlaces(placeIds, landmarkSlugs) {
  const cleanedPlaceIds = uniqueStrings(placeIds);
  const cleanedLandmarkSlugs = uniqueStrings(landmarkSlugs);

  if (!cleanedPlaceIds.length || !cleanedLandmarkSlugs.length) {
    return new Map();
  }

  const result = await query(
    `SELECT DISTINCT ON (p.place_id)
        p.place_id,
        lm.slug AS landmark_slug,
        lm.name AS landmark_name,
        plm.distance_m,
        plm.method,
        plm.anchor_label
      FROM places p
      JOIN place_landmark_metrics plm ON plm.place_id = p.id
      JOIN local_landmarks lm ON lm.id = plm.landmark_id
      WHERE p.place_id = ANY($1::text[])
        AND lm.slug = ANY($2::text[])
      ORDER BY p.place_id, plm.distance_m ASC NULLS LAST, lm.slug ASC`,
    [cleanedPlaceIds, cleanedLandmarkSlugs],
  );

  const metricsByPlaceId = new Map();
  for (const row of result.rows) {
    metricsByPlaceId.set(row.place_id, {
      landmark_slug: row.landmark_slug,
      landmark_name: row.landmark_name,
      distance_m: row.distance_m === null ? null : Number(row.distance_m),
      method: row.method,
      anchor_label: row.anchor_label,
    });
  }

  return metricsByPlaceId;
}

function buildFallbackAnswer(queryResult, recommendedPlaces) {
  if (!recommendedPlaces.length) {
    return "Mình chưa tìm được chỗ phù hợp từ dữ liệu hiện có. Bạn thử nới khoảng cách, giảm bớt tiện ích bắt buộc, hoặc đổi sang một landmark khác ở Đà Nẵng nhé.";
  }

  const lines = [
    `Mình tìm được ${recommendedPlaces.length} lựa chọn khá sát với nhu cầu của bạn trong dataset hiện tại.`,
  ];

  for (const place of recommendedPlaces.slice(0, 3)) {
    const landmark = place.matched_landmark || place.nearest_landmarks?.[0];
    const amenityPreview = (place.amenities_preview || []).slice(0, 3).join(", ");
    let line = `${place.title || place.place_id}`;
    if (place.rating !== null) {
      line += ` có điểm ${place.rating.toFixed(1)}/5`;
    }
    if (landmark?.distance_m !== undefined && landmark?.distance_m !== null) {
      line += `, gần ${landmark.landmark_name} khoảng ${formatDistance(landmark.distance_m)} theo đường chim bay`;
    }
    if (amenityPreview) {
      line += `, có các tiện ích như ${amenityPreview}`;
    }
    lines.push(line + ".");
  }

  if (queryResult.semantic_error) {
    lines.push("Phần trả lời AI đang thiếu lớp semantic retrieval vì cấu hình embeddings/chat chưa sẵn sàng, nên mình đang tóm tắt theo dữ liệu có cấu trúc.");
  } else {
    lines.push("Nếu bạn muốn, mình có thể tiếp tục thu hẹp theo khu vực, loại hình, hoặc mốc gần như Cầu Rồng, Mỹ Khê hay sân bay.");
  }

  return lines.join(" ");
}

function buildFollowUpPrompts(intent, recommendedPlaces) {
  const prompts = [];
  const topPlace = recommendedPlaces[0];
  const topLandmark =
    topPlace?.matched_landmark?.landmark_name || topPlace?.nearest_landmarks?.[0]?.landmark_name;

  if (intent.landmark_slugs?.length) {
    prompts.push("So sánh 3 chỗ phù hợp nhất theo cùng landmark này");
  }
  if (intent.amenity_labels?.length) {
    prompts.push("Giữ nguyên khu vực nhưng nới bớt yêu cầu tiện ích");
  }
  if (topLandmark) {
    prompts.push(`Chỗ nào gần ${topLandmark} nhất theo đường chim bay?`);
  }
  prompts.push("Gợi ý lựa chọn phù hợp cho gia đình");
  prompts.push("Gợi ý lựa chọn giá ổn và nhiều review");

  return uniqueStrings(prompts).slice(0, 4);
}

function formatAppliedFilters(intent) {
  return {
    type_slugs: intent.type_slugs || [],
    landmark_slugs: intent.landmark_slugs || [],
    zone_slugs: intent.zone_slugs || [],
    amenity_labels: intent.amenity_labels || [],
    min_rating: intent.min_rating ?? null,
    max_distance_m: intent.max_distance_m ?? null,
    signals: intent.signals || [],
  };
}

function runCommand(command, args, { cwd = config.rootDir } = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", rejectCommand);
    child.on("close", (code) => {
      if (code === 0) {
        resolveCommand({ stdout, stderr });
        return;
      }
      rejectCommand(
        new HttpError(
          502,
          `Command failed: ${command} ${args.join(" ")}`,
          stderr.trim() || stdout.trim(),
          "upstream_command_failed",
        ),
      );
    });
  });
}

async function runPhase2Json(args) {
  const { stdout } = await runCommand(config.pythonBin, [config.ragScriptPath, ...args]);
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new HttpError(
      502,
      "Phase 2 script returned invalid JSON.",
      stdout.trim().slice(0, 1000),
      "invalid_upstream_json",
    );
  }
}

async function runChatQuery(payload) {
  const queryText = String(payload.query || "").trim();
  if (!queryText) {
    throw badRequest("query is required.");
  }

  const generate = parseBoolean(payload.generate, config.chatGenerateDefault);
  const candidateLimit = parseInteger(payload.candidateLimit, 12, { min: 1, max: 30 });
  const semanticLimit = parseInteger(payload.semanticLimit, 8, { min: 1, max: 20 });
  const outputPlaces = parseInteger(payload.outputPlaces, 5, { min: 1, max: 10 });
  const outputMatches = parseInteger(payload.outputMatches, 5, { min: 1, max: 10 });

  const args = [
    "query",
    queryText,
    "--json",
    "--candidate-limit",
    String(candidateLimit),
    "--semantic-limit",
    String(semanticLimit),
    "--output-places",
    String(outputPlaces),
    "--output-matches",
    String(outputMatches),
  ];

  if (generate) {
    args.push("--generate");
  }

  const result = await runPhase2Json(args);
  const recommendedPlaceIds = buildRecommendedPlaceIdOrder(result, outputPlaces);
  const matchedLandmarkByPlaceId = await fetchMatchedLandmarksForPlaces(
    recommendedPlaceIds,
    result.intent?.landmark_slugs || [],
  );
  const recommendedPlaces = await getPlaceSummariesByPlaceIdsWithMetrics(recommendedPlaceIds, {
    matchedLandmarkByPlaceId,
  });
  const answer = result.generated_answer || buildFallbackAnswer(result, recommendedPlaces);

  return {
    answer,
    applied_filters: formatAppliedFilters(result.intent || {}),
    recommended_places: recommendedPlaces,
    local_context_used: (result.local_context_notes || []).map((note) => ({
      slug: note.slug,
      title: note.title,
      subject_kind: note.subject_kind,
      subject_slug: note.subject_slug,
      content: note.content,
      tags: note.tags || [],
    })),
    follow_up_prompts: buildFollowUpPrompts(result.intent || {}, recommendedPlaces),
    meta: {
      query: queryText,
      semantic_error: result.semantic_error || null,
      semantic_matches: (result.semantic_matches || []).slice(0, outputMatches),
    },
  };
}

async function findPlaceByIdentifier(identifier) {
  const result = await query(
    `SELECT id::text AS id, place_id, title
     FROM places
     WHERE id::text = $1 OR place_id = $1
     LIMIT 1`,
    [identifier],
  );

  return result.rows[0] || null;
}

async function getCachedReviewSummary(identifier) {
  const result = await query(
    `SELECT
        p.place_id,
        p.title,
        ars.summary_text,
        ars.bullets,
        ars.model,
        ars.prompt_version,
        ars.source_review_count,
        ars.metadata,
        ars.updated_at
      FROM ai_review_summaries ars
      JOIN places p ON p.id = ars.place_id
      WHERE p.id::text = $1 OR p.place_id = $1
      LIMIT 1`,
    [identifier],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    place_id: row.place_id,
    title: row.title,
    summary_text: row.summary_text,
    bullets: row.bullets || [],
    model: row.model,
    prompt_version: row.prompt_version,
    source_review_count: Number(row.source_review_count || 0),
    metadata: row.metadata || {},
    updated_at: row.updated_at,
    source: "cache",
  };
}

async function getOrGenerateReviewSummary(payload) {
  const identifier = String(payload.placeId || payload.place_id || payload.id || "").trim();
  const titleSearch = String(payload.titleSearch || "").trim();
  const refresh = parseBoolean(payload.refresh, false);
  const useLlm = parseBoolean(payload.useLlm, config.reviewSummaryUseLlmDefault);

  if (!identifier && !titleSearch) {
    throw badRequest("placeId or titleSearch is required.");
  }

  if (identifier && !refresh) {
    const cached = await getCachedReviewSummary(identifier);
    if (cached) {
      return cached;
    }
  }

  const args = ["review-summary"];
  if (identifier) {
    args.push("--place-id", identifier);
  } else if (titleSearch) {
    args.push("--title-search", titleSearch);
  }
  if (refresh) {
    args.push("--refresh");
  }
  if (useLlm) {
    args.push("--use-claude");
  }

  const generated = await runPhase2Json(args);
  return {
    place_id: generated.place_id,
    title: generated.title,
    summary_text: generated.summary_text,
    bullets: generated.bullets || [],
    model: generated.model,
    prompt_version: generated.prompt_version,
    source_review_count: Number(generated.source_review_count || 0),
    metadata: generated.metadata || {},
    source: generated.source || "generated",
  };
}

function requireAdmin(req, _res, next) {
  if (!config.adminApiToken) {
    next(serviceUnavailable("ADMIN_API_TOKEN is not configured."));
    return;
  }

  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  const token = bearer || headerToken;

  if (!token || token !== config.adminApiToken) {
    next(unauthorized("Admin token is missing or invalid."));
    return;
  }

  next();
}

function sanitizePlacePayload(payload, { forCreate = false } = {}) {
  const fields = {
    place_id: asNullableText(payload.place_id),
    type_slug: asNullableText(payload.type_slug),
    type_label: asNullableText(payload.type_label),
    title: asNullableText(payload.title),
    description: asNullableText(payload.description),
    category_name: asNullableText(payload.category_name),
    address: asNullableText(payload.address),
    neighborhood: asNullableText(payload.neighborhood),
    district: asNullableText(payload.district),
    city: asNullableText(payload.city),
    country_code: asNullableText(payload.country_code),
    phone: asNullableText(payload.phone),
    website: asNullableText(payload.website),
    lat: asNullableNumber(payload.lat),
    lng: asNullableNumber(payload.lng),
    rating: asNullableNumber(payload.rating),
    reviews_count: asNullableNumber(payload.reviews_count),
    price_text: asNullableText(payload.price_text),
    hotel_description: asNullableText(payload.hotel_description),
    image_url: asNullableText(payload.image_url),
    opening_hours: ensurePlainObject(payload.opening_hours, "opening_hours"),
    additional_info: ensurePlainObject(payload.additional_info, "additional_info"),
    categories: ensureArrayOfStrings(payload.categories, "categories"),
    crawl_category_labels: ensureArrayOfStrings(
      payload.crawl_category_labels,
      "crawl_category_labels",
    ),
    raw_payload: ensurePlainObject(payload.raw_payload, "raw_payload"),
  };

  const gallery = ensureArrayOfStrings(payload.gallery, "gallery");
  const amenityLabels = ensureArrayOfStrings(payload.amenity_labels, "amenity_labels");

  if (forCreate) {
    if (!fields.place_id) {
      throw badRequest("place_id is required for creating a place.");
    }
    if (!fields.type_slug) {
      throw badRequest("type_slug is required for creating a place.");
    }
  }

  const scalarFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );

  return {
    scalarFields,
    gallery,
    amenityLabels,
  };
}

async function syncPlaceImages(client, placeUuid, gallery) {
  if (gallery === undefined) {
    return;
  }

  await client.query("DELETE FROM place_images WHERE place_id = $1", [placeUuid]);
  for (const [index, imageUrl] of gallery.entries()) {
    await client.query(
      `INSERT INTO place_images (place_id, image_url, sort_order)
       VALUES ($1, $2, $3)`,
      [placeUuid, imageUrl, index],
    );
  }
}

async function syncPlaceAmenities(client, placeUuid, amenityLabels) {
  if (amenityLabels === undefined) {
    return;
  }

  await client.query("DELETE FROM place_amenities WHERE place_id = $1", [placeUuid]);
  for (const label of amenityLabels) {
    const slug = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const normalizedSlug = slug || label.toLowerCase();
    let amenityId;

    const existingAmenity = await client.query(
      `SELECT id
       FROM amenities
       WHERE label = $1 OR slug = $2
       LIMIT 1`,
      [label, normalizedSlug],
    );

    if (existingAmenity.rows[0]) {
      amenityId = existingAmenity.rows[0].id;
    } else {
      const amenityResult = await client.query(
        `INSERT INTO amenities (slug, label)
         VALUES ($1, $2)
         RETURNING id`,
        [normalizedSlug, label],
      );
      amenityId = amenityResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO place_amenities (place_id, amenity_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [placeUuid, amenityId],
    );
  }
}

async function createPlace(payload) {
  const parsed = sanitizePlacePayload(payload, { forCreate: true });
  const scalarEntries = Object.entries(parsed.scalarFields);

  const created = await withTransaction(async (client) => {
    const bag = makeParamBag();
    const columns = scalarEntries.map(([key]) => key);
    const placeholders = scalarEntries.map(([, value]) => bag.push(value));

    const result = await client.query(
      `INSERT INTO places (${columns.join(", ")})
       VALUES (${placeholders.join(", ")})
       RETURNING id::text AS id`,
      bag.params,
    );

    const placeUuid = result.rows[0].id;
    await syncPlaceImages(client, placeUuid, parsed.gallery);
    await syncPlaceAmenities(client, placeUuid, parsed.amenityLabels);
    return placeUuid;
  });

  return getPlaceDetail(created);
}

async function updatePlace(identifier, payload) {
  const existing = await findPlaceByIdentifier(identifier);
  if (!existing) {
    throw notFound("Place not found.");
  }

  const parsed = sanitizePlacePayload(payload);
  const scalarEntries = Object.entries(parsed.scalarFields);
  if (!scalarEntries.length && parsed.gallery === undefined && parsed.amenityLabels === undefined) {
    throw badRequest("No supported fields were provided for update.");
  }

  await withTransaction(async (client) => {
    if (scalarEntries.length) {
      const bag = makeParamBag();
      const setSql = scalarEntries
        .map(([key, value]) => `${key} = ${bag.push(value)}`)
        .join(", ");
      bag.push(existing.id);
      await client.query(`UPDATE places SET ${setSql} WHERE id::text = $${bag.params.length}`, bag.params);
    }

    await syncPlaceImages(client, existing.id, parsed.gallery);
    await syncPlaceAmenities(client, existing.id, parsed.amenityLabels);
  });

  return getPlaceDetail(existing.id);
}

async function deletePlace(identifier) {
  const existing = await findPlaceByIdentifier(identifier);
  if (!existing) {
    throw notFound("Place not found.");
  }

  await query("DELETE FROM places WHERE id::text = $1", [existing.id]);
  return { deleted: true, id: existing.id, place_id: existing.place_id };
}

function sanitizeLandmarkPayload(payload, { forCreate = false } = {}) {
  const cleaned = {
    slug: asNullableText(payload.slug),
    name: asNullableText(payload.name),
    kind: asNullableText(payload.kind),
    lat: asNullableNumber(payload.lat),
    lng: asNullableNumber(payload.lng),
    metadata: ensurePlainObject(payload.metadata, "metadata"),
  };

  if (forCreate) {
    if (!cleaned.slug || !cleaned.name) {
      throw badRequest("slug and name are required for creating a landmark.");
    }
  }

  return Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== undefined));
}

async function listAdminLandmarks() {
  const result = await query(
    `SELECT id::text AS id, slug, name, kind, lat, lng, metadata, created_at
     FROM local_landmarks
     ORDER BY slug ASC`,
  );
  return result.rows;
}

async function getAdminLandmark(identifier) {
  const result = await query(
    `SELECT id::text AS id, slug, name, kind, lat, lng, metadata, created_at
     FROM local_landmarks
     WHERE id::text = $1 OR slug = $1
     LIMIT 1`,
    [identifier],
  );
  if (!result.rows[0]) {
    throw notFound("Landmark not found.");
  }
  return result.rows[0];
}

async function createLandmark(payload) {
  const cleaned = sanitizeLandmarkPayload(payload, { forCreate: true });
  const entries = Object.entries(cleaned);
  const bag = makeParamBag();

  const result = await query(
    `INSERT INTO local_landmarks (${entries.map(([key]) => key).join(", ")})
     VALUES (${entries.map(([, value]) => bag.push(value)).join(", ")})
     RETURNING id::text AS id`,
    bag.params,
  );
  return getAdminLandmark(result.rows[0].id);
}

async function updateLandmark(identifier, payload) {
  const existing = await getAdminLandmark(identifier);
  const cleaned = sanitizeLandmarkPayload(payload);
  const entries = Object.entries(cleaned);
  if (!entries.length) {
    throw badRequest("No supported fields were provided for update.");
  }
  const bag = makeParamBag();
  const setSql = entries.map(([key, value]) => `${key} = ${bag.push(value)}`).join(", ");
  bag.push(identifier);
  await query(
    `UPDATE local_landmarks
     SET ${setSql}
     WHERE id::text = $${bag.params.length} OR slug = $${bag.params.length}`,
    bag.params,
  );
  return getAdminLandmark(existing.id);
}

async function deleteLandmark(identifier) {
  const existing = await getAdminLandmark(identifier);
  await query("DELETE FROM local_landmarks WHERE id::text = $1", [existing.id]);
  return { deleted: true, id: existing.id, slug: existing.slug };
}

function sanitizeContextNotePayload(payload, { forCreate = false } = {}) {
  const cleaned = {
    slug: asNullableText(payload.slug),
    title: asNullableText(payload.title),
    subject_kind: asNullableText(payload.subject_kind),
    subject_slug: asNullableText(payload.subject_slug),
    content: asNullableText(payload.content),
    tags: ensureArrayOfStrings(payload.tags, "tags"),
    metadata: ensurePlainObject(payload.metadata, "metadata"),
  };

  if (forCreate) {
    if (!cleaned.slug || !cleaned.title || !cleaned.subject_kind || !cleaned.content) {
      throw badRequest(
        "slug, title, subject_kind, and content are required for creating a local context note.",
      );
    }
  }

  return Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== undefined));
}

async function listContextNotes(filters) {
  const bag = makeParamBag();
  const where = ["1=1"];

  if (filters.q) {
    const ref = bag.push(`%${filters.q}%`);
    where.push(`(title ILIKE ${ref} OR content ILIKE ${ref} OR slug ILIKE ${ref})`);
  }
  if (filters.subjectKind) {
    where.push(`subject_kind = ${bag.push(filters.subjectKind)}`);
  }
  if (filters.subjectSlug) {
    where.push(`subject_slug = ${bag.push(filters.subjectSlug)}`);
  }

  const limitRef = bag.push(filters.limit);
  const offsetRef = bag.push(filters.offset);

  const result = await query(
    `SELECT id::text AS id, slug, title, subject_kind, subject_slug, content, tags, metadata, created_at
     FROM local_context_notes
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC, slug ASC
     LIMIT ${limitRef}
     OFFSET ${offsetRef}`,
    bag.params,
  );
  return result.rows;
}

async function getContextNote(identifier) {
  const result = await query(
    `SELECT id::text AS id, slug, title, subject_kind, subject_slug, content, tags, metadata, created_at
     FROM local_context_notes
     WHERE id::text = $1 OR slug = $1
     LIMIT 1`,
    [identifier],
  );
  if (!result.rows[0]) {
    throw notFound("Local context note not found.");
  }
  return result.rows[0];
}

async function createContextNote(payload) {
  const cleaned = sanitizeContextNotePayload(payload, { forCreate: true });
  const entries = Object.entries(cleaned);
  const bag = makeParamBag();
  const result = await query(
    `INSERT INTO local_context_notes (${entries.map(([key]) => key).join(", ")})
     VALUES (${entries.map(([, value]) => bag.push(value)).join(", ")})
     RETURNING id::text AS id`,
    bag.params,
  );
  return getContextNote(result.rows[0].id);
}

async function updateContextNote(identifier, payload) {
  const existing = await getContextNote(identifier);
  const cleaned = sanitizeContextNotePayload(payload);
  const entries = Object.entries(cleaned);
  if (!entries.length) {
    throw badRequest("No supported fields were provided for update.");
  }
  const bag = makeParamBag();
  const setSql = entries.map(([key, value]) => `${key} = ${bag.push(value)}`).join(", ");
  bag.push(identifier);
  await query(
    `UPDATE local_context_notes
     SET ${setSql}
     WHERE id::text = $${bag.params.length} OR slug = $${bag.params.length}`,
    bag.params,
  );
  return getContextNote(existing.id);
}

async function deleteContextNote(identifier) {
  const existing = await getContextNote(identifier);
  await query("DELETE FROM local_context_notes WHERE id::text = $1", [existing.id]);
  return { deleted: true, id: existing.id, slug: existing.slug };
}

async function resolveTargetPlaceIds({ batchKey, placeIds, limit = null }) {
  const cleanedPlaceIds = uniqueStrings(placeIds || []);
  const bag = makeParamBag();
  const where = ["1=1"];

  if (batchKey) {
    where.push(`b.batch_key = ${bag.push(batchKey)}`);
  }
  if (cleanedPlaceIds.length) {
    where.push(`p.place_id = ANY(${bag.push(cleanedPlaceIds)}::text[])`);
  }

  let limitSql = "";
  if (limit !== null) {
    limitSql = ` LIMIT ${bag.push(limit)}`;
  }

  const result = await query(
    `SELECT p.id::text AS id, p.place_id
     FROM places p
     LEFT JOIN crawl_batches b ON b.id = p.batch_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.title ASC NULLS LAST${limitSql}`,
    bag.params,
  );
  return result.rows;
}

async function rerunDistanceJob(payload) {
  const batchKey = asNullableText(payload.batchKey) || null;
  const placeIds = parseStringList(payload.placeIds);
  const landmarkSlugs = parseStringList(payload.landmarkSlugs);

  if (!batchKey && !placeIds.length) {
    throw badRequest("batchKey or placeIds is required for distance rebuild.");
  }

  const targets = await resolveTargetPlaceIds({ batchKey, placeIds });
  if (!targets.length) {
    throw notFound("No places matched the requested distance rebuild target.");
  }

  const result = await query(
    `SELECT public.refresh_place_landmark_metrics($1::uuid[], $2::text[]) AS affected_rows`,
    [
      targets.map((item) => item.id),
      landmarkSlugs.length ? landmarkSlugs : null,
    ],
  );

  return {
    job: "distance",
    batch_key: batchKey,
    place_count: targets.length,
    landmark_slugs: landmarkSlugs,
    affected_rows: Number(result.rows[0]?.affected_rows || 0),
  };
}

function ensureJobTarget(batchKey, placeIds, titleSearch = "") {
  if (!batchKey && !placeIds.length && !titleSearch) {
    throw badRequest("Provide batchKey, placeIds, or titleSearch for this job.");
  }
}

function validateDistanceJobPayload(payload) {
  const batchKey = asNullableText(payload.batchKey) || null;
  const placeIds = parseStringList(payload.placeIds);
  if (!batchKey && !placeIds.length) {
    throw badRequest("batchKey or placeIds is required for distance rebuild.");
  }
}

function validateChunkJobPayload(payload) {
  ensureJobTarget(
    asNullableText(payload.batchKey),
    parseStringList(payload.placeIds),
    asNullableText(payload.titleSearch),
  );
}

function validateEmbeddingJobPayload(payload) {
  ensureJobTarget(asNullableText(payload.batchKey), parseStringList(payload.placeIds));
}

function validateReviewSummaryJobPayload(payload) {
  ensureJobTarget(
    asNullableText(payload.batchKey),
    parseStringList(payload.placeIds),
    asNullableText(payload.titleSearch),
  );
}

async function rerunChunkJob(payload) {
  const batchKey = asNullableText(payload.batchKey);
  const placeIds = parseStringList(payload.placeIds);
  const titleSearch = asNullableText(payload.titleSearch);
  ensureJobTarget(batchKey, placeIds, titleSearch);

  const args = ["chunk"];
  if (batchKey) {
    args.push("--batch-key", batchKey);
  }
  for (const placeId of placeIds) {
    args.push("--place-id", placeId);
  }
  if (titleSearch) {
    args.push("--title-search", titleSearch);
  }
  if (payload.limit !== undefined) {
    args.push("--limit", String(parseInteger(payload.limit, 10, { min: 1, max: 5000 })));
  }
  if (payload.chunkSize !== undefined) {
    args.push("--chunk-size", String(parseInteger(payload.chunkSize, 1000, { min: 200, max: 4000 })));
  }
  if (payload.chunkOverlap !== undefined) {
    args.push(
      "--chunk-overlap",
      String(parseInteger(payload.chunkOverlap, 180, { min: 0, max: 1000 })),
    );
  }
  if (parseBoolean(payload.dryRun, false)) {
    args.push("--dry-run");
  }

  return {
    job: "chunk",
    ...(await runPhase2Json(args)),
  };
}

async function rerunEmbeddingJob(payload) {
  const batchKey = asNullableText(payload.batchKey);
  const placeIds = parseStringList(payload.placeIds);
  ensureJobTarget(batchKey, placeIds);

  const args = ["embed"];
  if (batchKey) {
    args.push("--batch-key", batchKey);
  }
  for (const placeId of placeIds) {
    args.push("--place-id", placeId);
  }
  if (payload.limit !== undefined) {
    args.push("--limit", String(parseInteger(payload.limit, 100, { min: 1, max: 5000 })));
  }
  if (payload.batchSize !== undefined) {
    args.push("--batch-size", String(parseInteger(payload.batchSize, 32, { min: 1, max: 256 })));
  }
  if (parseBoolean(payload.refresh, false)) {
    args.push("--refresh");
  }

  return {
    job: "embed",
    ...(await runPhase2Json(args)),
  };
}

async function rerunReviewSummaryJob(payload) {
  const batchKey = asNullableText(payload.batchKey);
  const placeIds = parseStringList(payload.placeIds);
  const titleSearch = asNullableText(payload.titleSearch);
  const refresh = parseBoolean(payload.refresh, false);
  const useLlm = parseBoolean(payload.useLlm, config.reviewSummaryUseLlmDefault);
  const limit = payload.limit === undefined ? null : parseInteger(payload.limit, 10, { min: 1, max: 5000 });

  ensureJobTarget(batchKey, placeIds, titleSearch);

  let targets = [];
  if (batchKey || placeIds.length) {
    targets = await resolveTargetPlaceIds({ batchKey, placeIds, limit });
  } else if (titleSearch) {
    const place = await findPlaceByIdentifier(titleSearch);
    if (place) {
      targets = [place];
    }
  }

  if (!targets.length && titleSearch) {
    const generated = await getOrGenerateReviewSummary({ titleSearch, refresh, useLlm });
    return { job: "review-summary", processed: 1, generated: 1, items: [generated] };
  }

  if (!targets.length) {
    throw notFound("No places matched the requested review summary target.");
  }

  const items = [];
  for (const target of targets) {
    items.push(
      await getOrGenerateReviewSummary({
        placeId: target.place_id,
        refresh,
        useLlm,
      }),
    );
  }

  return {
    job: "review-summary",
    batch_key: batchKey,
    processed: items.length,
    generated: items.filter((item) => item.source !== "cache").length,
    items,
  };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "stayfinder-backend",
    phase: 3,
  });
});

app.get(
  "/places",
  asyncRoute(async (req, res) => {
    const limit = parseInteger(req.query.limit, config.publicDefaultPageSize, {
      min: 1,
      max: config.publicMaxPageSize,
    });
    const page = parseInteger(req.query.page, 1, { min: 1 });
    const offset = parseInteger(req.query.offset, (page - 1) * limit, { min: 0 });

    const payload = await listPlaces({
      q: String(req.query.q || "").trim(),
      typeSlugs: parseStringList(req.query.type || req.query.type_slug),
      districts: parseStringList(req.query.district),
      neighborhoods: parseStringList(req.query.neighborhood),
      amenityLabels: parseStringList(req.query.amenity || req.query.amenities),
      landmarkSlugs: parseStringList(req.query.landmark || req.query.landmark_slug),
      minRating:
        req.query.min_rating === undefined
          ? null
          : parseFloatNumber(req.query.min_rating, null),
      maxDistanceM:
        req.query.max_distance_m === undefined
          ? null
          : parseInteger(req.query.max_distance_m, null, { min: 0 }),
      sort: String(req.query.sort || "rating_desc"),
      limit,
      offset,
    });

    res.json(payload);
  }),
);

app.get(
  "/places/map",
  asyncRoute(async (req, res) => {
    const limit = parseInteger(req.query.limit, config.publicDefaultMapSize, {
      min: 1,
      max: config.publicMaxMapSize,
    });
    const payload = await listPlaces(
      {
        q: String(req.query.q || "").trim(),
        typeSlugs: parseStringList(req.query.type || req.query.type_slug),
        districts: parseStringList(req.query.district),
        neighborhoods: parseStringList(req.query.neighborhood),
        amenityLabels: parseStringList(req.query.amenity || req.query.amenities),
        landmarkSlugs: parseStringList(req.query.landmark || req.query.landmark_slug),
        minRating:
          req.query.min_rating === undefined
            ? null
            : parseFloatNumber(req.query.min_rating, null),
        maxDistanceM:
          req.query.max_distance_m === undefined
            ? null
            : parseInteger(req.query.max_distance_m, null, { min: 0 }),
        sort: String(req.query.sort || "rating_desc"),
        limit,
        offset: 0,
      },
      { mapMode: true },
    );

    res.json(payload);
  }),
);

app.get(
  "/places/:id",
  asyncRoute(async (req, res) => {
    res.json(await getPlaceDetail(req.params.id));
  }),
);

app.get(
  "/filters/meta",
  asyncRoute(async (_req, res) => {
    res.json(await getFiltersMeta());
  }),
);

app.get(
  "/landmarks",
  asyncRoute(async (_req, res) => {
    res.json({ items: await getLandmarks() });
  }),
);

app.post(
  "/chat/query",
  asyncRoute(async (req, res) => {
    res.json(await runChatQuery(req.body || {}));
  }),
);

app.post(
  "/ai/review-summary",
  asyncRoute(async (req, res) => {
    res.json(await getOrGenerateReviewSummary(req.body || {}));
  }),
);

app.use("/admin", requireAdmin);

app.get(
  "/admin/jobs",
  asyncRoute(async (req, res) => {
    cleanupAdminJobs();
    const limit = parseInteger(req.query.limit, 20, { min: 1, max: 200 });
    const items = Array.from(adminJobs.values())
      .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
      .slice(0, limit)
      .map((job) => serializeAdminJob(job));
    res.json({ items });
  }),
);

app.get(
  "/admin/jobs/:id",
  asyncRoute(async (req, res) => {
    res.json(getAdminJobOrThrow(req.params.id));
  }),
);

app.get(
  "/admin/places",
  asyncRoute(async (req, res) => {
    const limit = parseInteger(req.query.limit, 25, { min: 1, max: 100 });
    const page = parseInteger(req.query.page, 1, { min: 1 });
    res.json(
      await listPlaces(
        {
          q: String(req.query.q || "").trim(),
          typeSlugs: parseStringList(req.query.type || req.query.type_slug),
          districts: parseStringList(req.query.district),
          neighborhoods: parseStringList(req.query.neighborhood),
          amenityLabels: parseStringList(req.query.amenity || req.query.amenities),
          landmarkSlugs: parseStringList(req.query.landmark || req.query.landmark_slug),
          minRating:
            req.query.min_rating === undefined
              ? null
              : parseFloatNumber(req.query.min_rating, null),
          maxDistanceM:
            req.query.max_distance_m === undefined
              ? null
              : parseInteger(req.query.max_distance_m, null, { min: 0 }),
          sort: String(req.query.sort || "rating_desc"),
          limit,
          offset: (page - 1) * limit,
        },
        { includeBatchKey: true },
      ),
    );
  }),
);

app.get(
  "/admin/places/:id",
  asyncRoute(async (req, res) => {
    res.json(await getPlaceDetail(req.params.id));
  }),
);

app.post(
  "/admin/places",
  asyncRoute(async (req, res) => {
    res.status(201).json(await createPlace(req.body || {}));
  }),
);

app.patch(
  "/admin/places/:id",
  asyncRoute(async (req, res) => {
    res.json(await updatePlace(req.params.id, req.body || {}));
  }),
);

app.delete(
  "/admin/places/:id",
  asyncRoute(async (req, res) => {
    res.json(await deletePlace(req.params.id));
  }),
);

app.get(
  "/admin/landmarks",
  asyncRoute(async (_req, res) => {
    res.json({ items: await listAdminLandmarks() });
  }),
);

app.get(
  "/admin/landmarks/:id",
  asyncRoute(async (req, res) => {
    res.json(await getAdminLandmark(req.params.id));
  }),
);

app.post(
  "/admin/landmarks",
  asyncRoute(async (req, res) => {
    res.status(201).json(await createLandmark(req.body || {}));
  }),
);

app.patch(
  "/admin/landmarks/:id",
  asyncRoute(async (req, res) => {
    res.json(await updateLandmark(req.params.id, req.body || {}));
  }),
);

app.delete(
  "/admin/landmarks/:id",
  asyncRoute(async (req, res) => {
    res.json(await deleteLandmark(req.params.id));
  }),
);

app.get(
  "/admin/local-context-notes",
  asyncRoute(async (req, res) => {
    res.json({
      items: await listContextNotes({
        q: String(req.query.q || "").trim(),
        subjectKind: asNullableText(req.query.subject_kind),
        subjectSlug: asNullableText(req.query.subject_slug),
        limit: parseInteger(req.query.limit, 50, { min: 1, max: 200 }),
        offset: parseInteger(req.query.offset, 0, { min: 0 }),
      }),
    });
  }),
);

app.get(
  "/admin/local-context-notes/:id",
  asyncRoute(async (req, res) => {
    res.json(await getContextNote(req.params.id));
  }),
);

app.post(
  "/admin/local-context-notes",
  asyncRoute(async (req, res) => {
    res.status(201).json(await createContextNote(req.body || {}));
  }),
);

app.patch(
  "/admin/local-context-notes/:id",
  asyncRoute(async (req, res) => {
    res.json(await updateContextNote(req.params.id, req.body || {}));
  }),
);

app.delete(
  "/admin/local-context-notes/:id",
  asyncRoute(async (req, res) => {
    res.json(await deleteContextNote(req.params.id));
  }),
);

app.post(
  "/admin/jobs/distance/rebuild",
  asyncRoute(async (req, res) => {
    await handleAdminJobRequest(
      req,
      res,
      "distance-rebuild",
      rerunDistanceJob,
      validateDistanceJobPayload,
    );
  }),
);

app.post(
  "/admin/jobs/chunks/rebuild",
  asyncRoute(async (req, res) => {
    await handleAdminJobRequest(
      req,
      res,
      "chunks-rebuild",
      rerunChunkJob,
      validateChunkJobPayload,
    );
  }),
);

app.post(
  "/admin/jobs/embeddings/rebuild",
  asyncRoute(async (req, res) => {
    await handleAdminJobRequest(
      req,
      res,
      "embeddings-rebuild",
      rerunEmbeddingJob,
      validateEmbeddingJobPayload,
    );
  }),
);

app.post(
  "/admin/jobs/review-summaries/rebuild",
  asyncRoute(async (req, res) => {
    await handleAdminJobRequest(
      req,
      res,
      "review-summaries-rebuild",
      rerunReviewSummaryJob,
      validateReviewSummaryJobPayload,
    );
  }),
);

app.use((_req, _res, next) => {
  next(notFound("Route not found."));
});

app.use(errorMiddleware);

const server = app.listen(config.port, config.host, () => {
  console.log(`StayFinder backend listening on http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    console.error(error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    console.error(error);
    process.exit(1);
  });
});

export {
  app,
  buildFallbackAnswer,
  buildFollowUpPrompts,
  getOrGenerateReviewSummary,
  listPlaces,
  runChatQuery,
};
