import { spawn } from "node:child_process";
import { createHash, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import cors from "cors";
import express from "express";

import {
  getAiConfig,
  getAiConfigEnv,
  getEffectiveProviderConfig,
  updateAiConfig,
} from "./aiConfig.js";
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
const AUTH_PASSWORD_ITERATIONS = 120_000;
const AUTH_PASSWORD_KEY_LENGTH = 32;
const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

const BLOCKED_IMAGE_URL_MARKERS = [
  "streetviewpixels-pa.googleapis.com",
  "/gps-cs-s/",
  "/geougc-cs/",
];

function isLikelyUsableImageUrl(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return false;
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    return false;
  }

  return !BLOCKED_IMAGE_URL_MARKERS.some((marker) => cleaned.includes(marker));
}

function normalizePublicImageUrls(values) {
  return uniqueStrings(values || []).filter((value) => isLikelyUsableImageUrl(value));
}

function pickBestPublicImageUrl(values) {
  const normalized = normalizePublicImageUrls(values);
  return normalized[0] || null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayName(value, fallbackEmail) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  if (cleaned) {
    return cleaned.slice(0, 80);
  }

  return fallbackEmail.split("@")[0]?.slice(0, 40) || "StayFinder user";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 128;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(
    password,
    salt,
    AUTH_PASSWORD_ITERATIONS,
    AUTH_PASSWORD_KEY_LENGTH,
    "sha256",
  ).toString("hex");

  return `pbkdf2_sha256$${AUTH_PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [algorithm, iterationsText, salt, expectedHash] = String(passwordHash || "").split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2_sha256" || !Number.isFinite(iterations) || !salt || !expectedHash) {
    return false;
  }

  const actualHash = pbkdf2Sync(
    password,
    salt,
    iterations,
    AUTH_PASSWORD_KEY_LENGTH,
    "sha256",
  ).toString("hex");

  const actualBuffer = Buffer.from(actualHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function serializeUser(row) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    created_at: row.created_at,
  };
}

function readBearerToken(req) {
  const value = String(req.headers.authorization || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function createAuthSession(client, userId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString();

  await client.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return {
    token,
    expires_at: expiresAt,
  };
}

async function getUserForSessionToken(token) {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const result = await query(
    `SELECT
        u.id::text AS id,
        u.email,
        u.display_name,
        u.created_at,
        s.id::text AS session_id,
        s.expires_at
      FROM user_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1`,
    [tokenHash],
  );

  return result.rows[0] || null;
}

async function requireAuthUser(req) {
  const token = readBearerToken(req);
  const sessionUser = await getUserForSessionToken(token);
  if (!sessionUser) {
    throw unauthorized("Phiên đăng nhập đã hết hạn.");
  }

  return sessionUser;
}

async function signupUser(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  if (!validateEmail(email)) {
    throw badRequest("Email không hợp lệ.");
  }
  if (!validatePassword(password)) {
    throw badRequest("Mật khẩu cần có ít nhất 6 ký tự.");
  }

  const displayName = normalizeDisplayName(payload.displayName ?? payload.display_name, email);
  return withTransaction(async (client) => {
    const existingUser = await client.query("SELECT 1 FROM app_users WHERE lower(email) = lower($1) LIMIT 1", [
      email,
    ]);
    if (existingUser.rowCount) {
      throw new HttpError(409, "Email này đã được đăng ký.", undefined, "email_taken");
    }

    const userResult = await client.query(
      `INSERT INTO app_users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id::text AS id, email, display_name, created_at`,
      [email, hashPassword(password), displayName],
    );
    const session = await createAuthSession(client, userResult.rows[0].id);
    return {
      user: serializeUser(userResult.rows[0]),
      session,
    };
  });
}

async function loginUser(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  if (!validateEmail(email) || !password) {
    throw unauthorized("Email hoặc mật khẩu không đúng.");
  }

  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id::text AS id, email, display_name, password_hash, created_at
       FROM app_users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw unauthorized("Email hoặc mật khẩu không đúng.");
    }

    const session = await createAuthSession(client, user.id);
    return {
      user: serializeUser(user),
      session,
    };
  });
}

async function logoutUser(req) {
  const token = readBearerToken(req);
  if (!token) {
    return { ok: true };
  }

  await query(
    `UPDATE user_sessions
     SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashSessionToken(token)],
  );

  return { ok: true };
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
  const coverImage = pickBestPublicImageUrl([row.cover_image]);
  const requestedDistance =
    row.requested_landmark_distance_m === null
      ? null
      : Number(row.requested_landmark_distance_m);

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
    price_text: row.price_text,
    cover_image: coverImage,
    amenities_preview: row.amenities_preview || [],
    nearest_landmarks: normalizeLandmarkMetricsForResponse(row.nearest_landmarks || []),
    requested_landmark_distance_m: requestedDistance,
  };
}

function normalizeLandmarkMetricsForResponse(metrics) {
  if (!Array.isArray(metrics)) {
    return [];
  }

  return metrics
    .map((metric) => normalizeMetricForResponse(metric))
    .sort((left, right) => {
      const leftDistance = resolveMetricDistance(left);
      const rightDistance = resolveMetricDistance(right);
      if (leftDistance === null && rightDistance === null) {
        return String(left.landmark_slug || "").localeCompare(String(right.landmark_slug || ""));
      }
      if (leftDistance === null) {
        return 1;
      }
      if (rightDistance === null) {
        return -1;
      }
      return leftDistance - rightDistance;
    });
}

function resolveMetricDistance(metric) {
  if (!metric || typeof metric !== "object") {
    return null;
  }

  if (metric.driving_distance_m !== null && metric.driving_distance_m !== undefined) {
    return Number(metric.driving_distance_m);
  }
  if (metric.walking_distance_m !== null && metric.walking_distance_m !== undefined) {
    return Number(metric.walking_distance_m);
  }
  if (metric.distance_m !== null && metric.distance_m !== undefined) {
    return Number(metric.distance_m);
  }
  return null;
}

function normalizeMetricForResponse(metric) {
  const normalized = { ...metric };
  normalized.display_distance_m = resolveMetricDistance(metric);
  normalized.distance_source =
    metric?.driving_distance_m !== null && metric?.driving_distance_m !== undefined
      ? "driving"
      : metric?.walking_distance_m !== null && metric?.walking_distance_m !== undefined
        ? "walking"
        : "straight_line";
  normalized.landmark_name = normalizeLandmarkDisplayName(normalized.landmark_name);
  normalized.anchor_label = normalizeLandmarkDisplayName(normalized.anchor_label);
  return normalized;
}

const LANDMARK_DISPLAY_NAME_BY_SLUG = {
  "son-tra-peninsula": "Bán đảo Sơn Trà",
  "son-tra-night-market": "Chợ đêm Sơn Trà",
  "helio-night-market": "Chợ đêm Helio",
  "dragon-bridge": "Cầu Rồng",
  "da-nang-airport": "Sân bay Đà Nẵng",
  "east-sea-park": "Công viên Biển Đông",
  "con-market": "Chợ Cồn",
  "han-market": "Chợ Hàn",
};

const LANDMARK_DISPLAY_NAME_REPLACEMENTS = [
  ["Dragon Bridge (Cầu Rồng)", "Cầu Rồng"],
  ["Dragon Bridge", "Cầu Rồng"],
  ["Han River Bridge (Cầu Sông Hàn)", "Cầu Sông Hàn"],
  ["Han River Bridge", "Cầu Sông Hàn"],
  ["Han Bridge", "Cầu Sông Hàn"],
  ["Han Market (Chợ Hàn)", "Chợ Hàn"],
  ["Han Market", "Chợ Hàn"],
  ["Da Nang International Airport (DAD)", "Sân bay Đà Nẵng"],
  ["Da Nang International Airport", "Sân bay Đà Nẵng"],
  ["Da Nang Airport", "Sân bay Đà Nẵng"],
  ["Marble Mountains (Ngũ Hành Sơn)", "Ngũ Hành Sơn"],
  ["Marble Mountains", "Ngũ Hành Sơn"],
  ["My Khe Beach (Bãi biển Mỹ Khê)", "Bãi biển Mỹ Khê"],
  ["My Khe Beach Strip", "Dải biển Mỹ Khê"],
  ["My Khe Beach", "Bãi biển Mỹ Khê"],
  ["An Thuong Area", "Khu An Thượng"],
  ["An Thuong (An Thượng)", "An Thượng"],
  ["An Thuong", "An Thượng"],
  ["Son Tra Peninsula (Bán đảo Sơn Trà)", "Bán đảo Sơn Trà"],
  ["Son Tra Peninsula", "Bán đảo Sơn Trà"],
  ["Son Tra Area", "Khu Sơn Trà"],
  ["South Son Tra", "Khu Sơn Trà"],
  ["Son Tra Night Market", "Chợ đêm Sơn Trà"],
  ["Helio Night Market", "Chợ đêm Helio"],
  ["East Sea Park", "Công viên Biển Đông"],
  ["Con Market", "Chợ Cồn"],
];

function normalizeLandmarkDisplayName(value) {
  let text = String(value || "").trim();
  if (!text) {
    return value;
  }
  for (const [from, to] of LANDMARK_DISPLAY_NAME_REPLACEMENTS) {
    text = text.replaceAll(from, to);
  }
  return text;
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
      distanceSql = ` AND COALESCE(plm.walking_distance_m, plm.driving_distance_m, plm.distance_m, 999999999) <= ${bag.push(filters.maxDistanceM)}`;
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
  const hasPriceSql = `(
    p.price_text IS NOT NULL
    AND btrim(p.price_text) <> ''
    AND lower(btrim(p.price_text)) NOT IN ('null', 'n/a', 'na', 'none', 'unknown')
  )`;

  switch (sort) {
    case "random":
      return "random()";
    case "price_available_desc":
      return `CASE WHEN ${hasPriceSql} THEN 0 ELSE 1 END, p.rating DESC NULLS LAST, p.reviews_count DESC NULLS LAST, p.title ASC`;
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

async function listPlaces(filters, { includeBatchKey = false } = {}) {
  const context = buildPlaceFilterContext(filters);
  const requestedDistanceSql = context.landmarkRef
    ? `(
        SELECT MIN(COALESCE(plm.walking_distance_m, plm.driving_distance_m, plm.distance_m))
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
        p.price_text,
        COALESCE(
          (
            SELECT pi.image_url
            FROM place_images pi
            WHERE pi.place_id = p.id
            ORDER BY
              CASE
                WHEN pi.image_url ILIKE '%/p/%' THEN 0
                WHEN pi.image_url ILIKE '%streetviewpixels-pa.googleapis.com%' THEN 3
                WHEN pi.image_url ILIKE '%/gps-cs-s/%' THEN 3
                WHEN pi.image_url ILIKE '%/geougc-cs/%' THEN 3
                ELSE 1
              END,
              pi.sort_order ASC,
              pi.id ASC
            LIMIT 1
          ),
          (
            SELECT review_image.image_url
            FROM reviews r
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(r.payload -> 'reviewImageUrls') = 'array'
                  THEN r.payload -> 'reviewImageUrls'
                ELSE '[]'::jsonb
              END
            ) AS review_image(image_url)
            WHERE r.place_id = p.id
              AND review_image.image_url NOT ILIKE '%streetviewpixels-pa.googleapis.com%'
              AND review_image.image_url NOT ILIKE '%/gps-cs-s/%'
              AND review_image.image_url NOT ILIKE '%/geougc-cs/%'
            ORDER BY r.likes_count DESC NULLS LAST, r.published_at DESC NULLS LAST
            LIMIT 1
          ),
          CASE
            WHEN COALESCE(p.image_url, '') = '' THEN NULL
            WHEN p.image_url ILIKE '%streetviewpixels-pa.googleapis.com%' THEN NULL
            WHEN p.image_url ILIKE '%/gps-cs-s/%' THEN NULL
            WHEN p.image_url ILIKE '%/geougc-cs/%' THEN NULL
            ELSE p.image_url
          END
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
                'distance_m', COALESCE(near.walking_distance_m, near.driving_distance_m, near.distance_m),
                'straight_line_distance_m', near.distance_m,
                'walking_distance_m', near.walking_distance_m,
                'walking_duration_s', near.walking_duration_s,
                'driving_distance_m', near.driving_distance_m,
                'driving_duration_s', near.driving_duration_s,
                'method', near.method,
                'anchor_label', near.anchor_label,
                'anchor_lat', near.anchor_lat,
                'anchor_lng', near.anchor_lng
              )
              ORDER BY near.distance_m ASC NULLS LAST, near.slug ASC
            )
            FROM (
              SELECT
                l.slug,
                l.name,
                plm.distance_m,
                plm.walking_distance_m,
                plm.walking_duration_s,
                plm.driving_distance_m,
                plm.driving_duration_s,
                plm.method,
                plm.anchor_label,
                plm.anchor_lat,
                plm.anchor_lng
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
        p.url,
        p.search_page_url,
        p.hotel_ads,
        COALESCE(
          (
            SELECT pi.image_url
            FROM place_images pi
            WHERE pi.place_id = p.id
              AND pi.image_url NOT ILIKE '%streetviewpixels-pa.googleapis.com%'
              AND pi.image_url NOT ILIKE '%/gps-cs-s/%'
              AND pi.image_url NOT ILIKE '%/geougc-cs/%'
            ORDER BY
              CASE
                WHEN pi.image_url ILIKE '%/p/%' THEN 0
                ELSE 1
              END,
              pi.sort_order ASC,
              pi.id ASC
            LIMIT 1
          ),
          (
            SELECT review_image.image_url
            FROM reviews r
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(r.payload -> 'reviewImageUrls') = 'array'
                  THEN r.payload -> 'reviewImageUrls'
                ELSE '[]'::jsonb
              END
            ) AS review_image(image_url)
            WHERE r.place_id = p.id
              AND review_image.image_url NOT ILIKE '%streetviewpixels-pa.googleapis.com%'
              AND review_image.image_url NOT ILIKE '%/gps-cs-s/%'
              AND review_image.image_url NOT ILIKE '%/geougc-cs/%'
            ORDER BY r.likes_count DESC NULLS LAST, r.published_at DESC NULLS LAST
            LIMIT 1
          ),
          p.image_url,
          ''
        ) AS cover_image,
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
                'published_at', sample.published_at,
                'images', sample.review_images
              )
              ORDER BY sample.likes_count DESC NULLS LAST, sample.published_at DESC NULLS LAST
            )
            FROM (
              SELECT
                r.stars,
                r.review_text,
                r.text_translated,
                r.likes_count,
                r.published_at,
                COALESCE(r.payload -> 'reviewImageUrls', '[]'::jsonb) AS review_images
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
                'distance_m', COALESCE(plm.walking_distance_m, plm.driving_distance_m, plm.distance_m),
                'straight_line_distance_m', plm.distance_m,
                'walking_distance_m', plm.walking_distance_m,
                'walking_duration_s', plm.walking_duration_s,
                'driving_distance_m', plm.driving_distance_m,
                'driving_duration_s', plm.driving_duration_s,
                'method', plm.method,
                'anchor_label', plm.anchor_label,
                'anchor_lat', plm.anchor_lat,
                'anchor_lng', plm.anchor_lng
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

  if (row.lat !== null && row.lng !== null) {
    await enrichRouteDistances({ placeIds: [row.id], onlyMissing: true });
  }

  const gallery = normalizePublicImageUrls(row.gallery || []);
  const coverImage = pickBestPublicImageUrl([row.cover_image, ...gallery]);

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
    cover_image: coverImage,
    gallery: uniqueStrings([coverImage, ...gallery].filter(Boolean)),
    phone: row.phone,
    website: row.website,
    source_url: row.url,
    search_page_url: row.search_page_url,
    hotel_ads: Array.isArray(row.hotel_ads) ? row.hotel_ads : [],
    opening_hours: row.opening_hours,
    additional_info: row.additional_info,
    price_text: row.price_text,
    hotel_description: row.hotel_description,
    amenities: row.amenities || [],
    reviews_sample: Array.isArray(row.reviews_sample)
      ? row.reviews_sample.map((review) => ({
          ...review,
          images: uniqueStrings(Array.isArray(review?.images) ? review.images : []),
        }))
      : [],
    landmark_metrics: await fetchPlaceLandmarkMetrics(row.id),
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
    landmarks: landmarks.rows.map((item) => ({
      ...item,
      name: normalizeLandmarkDisplayName(item.name),
    })),
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
    name: normalizeLandmarkDisplayName(row.name),
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
        COALESCE(
          (
            SELECT pi.image_url
            FROM place_images pi
            WHERE pi.place_id = p.id
              AND pi.image_url NOT ILIKE '%streetviewpixels-pa.googleapis.com%'
              AND pi.image_url NOT ILIKE '%/gps-cs-s/%'
              AND pi.image_url NOT ILIKE '%/geougc-cs/%'
            ORDER BY
              CASE
                WHEN pi.image_url ILIKE '%/p/%' THEN 0
                ELSE 1
              END,
              pi.sort_order ASC,
              pi.id ASC
            LIMIT 1
          ),
          (
            SELECT review_image.image_url
            FROM reviews r
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(r.payload -> 'reviewImageUrls') = 'array'
                  THEN r.payload -> 'reviewImageUrls'
                ELSE '[]'::jsonb
              END
            ) AS review_image(image_url)
            WHERE r.place_id = p.id
              AND review_image.image_url NOT ILIKE '%streetviewpixels-pa.googleapis.com%'
              AND review_image.image_url NOT ILIKE '%/gps-cs-s/%'
              AND review_image.image_url NOT ILIKE '%/geougc-cs/%'
            ORDER BY r.likes_count DESC NULLS LAST, r.published_at DESC NULLS LAST
            LIMIT 1
          ),
          p.image_url,
          ''
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
                'distance_m', COALESCE(near.walking_distance_m, near.driving_distance_m, near.distance_m),
                'straight_line_distance_m', near.distance_m,
                'walking_distance_m', near.walking_distance_m,
                'walking_duration_s', near.walking_duration_s,
                'driving_distance_m', near.driving_distance_m,
                'driving_duration_s', near.driving_duration_s,
                'method', near.method,
                'anchor_label', near.anchor_label,
                'anchor_lat', near.anchor_lat,
                'anchor_lng', near.anchor_lng
              )
              ORDER BY near.distance_m ASC NULLS LAST, near.slug ASC
            )
            FROM (
              SELECT
                l.slug,
                l.name,
                plm.distance_m,
                plm.walking_distance_m,
                plm.walking_duration_s,
                plm.driving_distance_m,
                plm.driving_duration_s,
                plm.method,
                plm.anchor_label,
                plm.anchor_lat,
                plm.anchor_lng
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

  for (const match of result.semantic_matches || []) {
    const semanticPlaceId = match?.google_place_id || null;
    if (semanticPlaceId) {
      orderedIds.push(semanticPlaceId);
    }
  }

  for (const place of result.structured_candidates || []) {
    if (place?.place_id) {
      orderedIds.push(place.place_id);
    }
  }

  return uniqueStrings(orderedIds).slice(0, limit);
}

function hasStayRecommendationIntent(queryText, intent = {}) {
  if (
    intent.type_slugs?.length ||
    intent.landmark_slugs?.length ||
    intent.zone_slugs?.length ||
    intent.amenity_labels?.length ||
    intent.min_rating !== null && intent.min_rating !== undefined ||
    intent.max_distance_m !== null && intent.max_distance_m !== undefined ||
    intent.signals?.length
  ) {
    return true;
  }

  const normalized = String(queryText || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return [
    "cho o",
    "luu tru",
    "khach san",
    "homestay",
    "hostel",
    "villa",
    "resort",
    "can ho",
    "nha nghi",
    "nha khach",
    "phong",
    "gan bien",
    "my khe",
    "an thuong",
    "san bay",
    "trung tam",
    "cau rong",
    "song han",
    "gia",
    "dem",
    "wifi",
    "bep",
    "do xe",
    "sach",
    "rong",
  ].some((keyword) => normalized.includes(keyword));
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
        COALESCE(plm.walking_distance_m, plm.driving_distance_m, plm.distance_m) AS distance_m,
        plm.distance_m AS straight_line_distance_m,
        plm.walking_distance_m,
        plm.driving_distance_m,
        plm.method,
        plm.anchor_label
      FROM places p
      JOIN place_landmark_metrics plm ON plm.place_id = p.id
      JOIN local_landmarks lm ON lm.id = plm.landmark_id
      WHERE p.place_id = ANY($1::text[])
        AND lm.slug = ANY($2::text[])
      ORDER BY p.place_id, COALESCE(plm.walking_distance_m, plm.driving_distance_m, plm.distance_m) ASC NULLS LAST, lm.slug ASC`,
    [cleanedPlaceIds, cleanedLandmarkSlugs],
  );

  const metricsByPlaceId = new Map();
  for (const row of result.rows) {
    metricsByPlaceId.set(row.place_id, {
      landmark_slug: row.landmark_slug,
      landmark_name: normalizeLandmarkDisplayName(row.landmark_name),
      distance_m: row.distance_m === null ? null : Number(row.distance_m),
      straight_line_distance_m:
        row.straight_line_distance_m === null ? null : Number(row.straight_line_distance_m),
      walking_distance_m:
        row.walking_distance_m === null ? null : Number(row.walking_distance_m),
      driving_distance_m:
        row.driving_distance_m === null ? null : Number(row.driving_distance_m),
      method: row.method,
      anchor_label: normalizeLandmarkDisplayName(row.anchor_label),
    });
  }

  return metricsByPlaceId;
}

function normalizeVietnamese(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

function buildNeedPhrase(intent) {
  const landmarkSlugs = intent.landmark_slugs || [];
  const zoneSlugs = intent.zone_slugs || [];
  const districtNames = intent.district_names || [];
  const amenityKeys = (intent.amenity_labels || []).map(normalizeVietnamese);
  const needs = [];

  if (districtNames.length) {
    needs.push(`khu vực ${districtNames[0]}`);
  }
  if (landmarkSlugs.includes("east-sea-park") || zoneSlugs.includes("my-khe-strip")) {
    needs.push("gần biển");
  }
  if (landmarkSlugs.includes("da-nang-airport") || zoneSlugs.includes("airport-corridor")) {
    needs.push("gần sân bay");
  }
  if (
    landmarkSlugs.includes("dragon-bridge") ||
    landmarkSlugs.includes("son-tra-night-market") ||
    landmarkSlugs.includes("helio-night-market") ||
    landmarkSlugs.includes("con-market") ||
    landmarkSlugs.includes("han-market")
  ) {
    needs.push("gần trung tâm");
  }
  if (amenityKeys.some((key) => key.includes("vat nuoi") || key.includes("thu cung"))) {
    needs.push("cho phép thú cưng");
  }
  if (amenityKeys.some((key) => key.includes("be boi") || key.includes("ho boi"))) {
    needs.push("có hồ bơi");
  }
  if (amenityKeys.some((key) => key.includes("tre em") || key.includes("gia dinh"))) {
    needs.push("phù hợp gia đình");
  }
  if (amenityKeys.some((key) => key.includes("bua sang"))) {
    needs.push("có bữa sáng");
  }
  if (intent.min_rating !== null && intent.min_rating !== undefined) {
    needs.push("đánh giá cao");
  }

  const top = uniqueStrings(needs).slice(0, 3);
  if (!top.length) {
    return "";
  }
  if (top.length === 1) {
    return top[0];
  }
  return `${top.slice(0, -1).join(", ")} và ${top[top.length - 1]}`;
}

function hasDistrictAreaIntent(intent) {
  return Boolean((intent.district_names || []).length);
}

function detectCapacityRequest(queryText) {
  const normalized = normalizeVietnamese(queryText);
  const numberMatch = normalized.match(/(\d+)\s*(?:nguoi|khach|adults?|people|pax|guests?)/);
  if (numberMatch) {
    return `${numberMatch[1]} người`;
  }
  if (/gia dinh|family/.test(normalized)) {
    return "gia đình";
  }
  if (/nhom ban|group/.test(normalized)) {
    return "nhóm bạn";
  }
  if (/cap doi|couple|honeymoon/.test(normalized)) {
    return "cặp đôi";
  }
  return null;
}

function buildAmenityHighlightLines(amenities) {
  const lines = [];
  const seen = new Set();
  const push = (emoji, text) => {
    if (seen.has(emoji)) {
      return;
    }
    seen.add(emoji);
    lines.push(`${emoji} ${text}`);
  };

  for (const label of amenities || []) {
    const key = normalizeVietnamese(label);
    if (key.includes("vat nuoi") || key.includes("thu cung") || key.includes("pet")) {
      push("🐶", "Cho phép thú cưng");
    } else if (key.includes("bua sang") || key.includes("breakfast")) {
      push("🍳", "Có bữa sáng");
    } else if (key.includes("be boi") || key.includes("ho boi") || key.includes("pool")) {
      push("🏊", "Có hồ bơi");
    } else if (key.includes("tre em") || key.includes("gia dinh")) {
      push("👨‍👩‍👧", "Phù hợp gia đình");
    } else if (key.includes("wifi") || key.includes("wi fi")) {
      push("📶", "Wi-Fi miễn phí");
    } else if (key.includes("do xe") || key.includes("parking")) {
      push("🅿️", "Có chỗ đỗ xe");
    } else if (key.includes("san bay")) {
      push("🚐", "Đưa đón sân bay");
    }
  }

  return lines.slice(0, 3);
}

function resolvePlaceLocationLine(place, intent = {}) {
  if (hasDistrictAreaIntent(intent)) {
    return place.district || place.neighborhood
      ? `📍 Khu vực ${place.district || place.neighborhood}`
      : null;
  }

  const landmark = place.matched_landmark || place.nearest_landmarks?.[0];
  if (landmark && landmark.distance_m !== null && landmark.distance_m !== undefined) {
    const distance = Number(landmark.distance_m);
    if (Number.isFinite(distance) && distance <= 3500) {
      return `📍 Cách ${landmark.landmark_name} khoảng ${formatDistance(distance)}`;
    }
  }

  return place.district || place.neighborhood
    ? `📍 Khu vực ${place.district || place.neighborhood}`
    : null;
}

function buildPlaceBlock(place, intent = {}) {
  const lines = [`🏨 ${place.title || place.place_id}`];
  if (typeof place.rating === "number") {
    lines.push(`⭐ ${place.rating.toFixed(1)}/5`);
  }
  const locationLine = resolvePlaceLocationLine(place, intent);
  if (locationLine) {
    lines.push(locationLine);
  }
  for (const line of buildAmenityHighlightLines(place.amenities_preview)) {
    lines.push(line);
  }
  return lines.join("\n");
}

function buildCaveatBullets(queryText, recommendedPlaces) {
  const bullets = [];
  const capacity = detectCapacityRequest(queryText);
  if (capacity) {
    bullets.push(`Chưa có dữ liệu sức chứa phòng nên chưa thể xác nhận phòng cho ${capacity}`);
  }
  if (recommendedPlaces.length === 1) {
    bullets.push("Hiện chỉ có 1 chỗ khớp sát tiêu chí; bạn có thể nới điều kiện để có thêm lựa chọn");
  }
  return bullets;
}

function buildFallbackAnswer(queryResult, recommendedPlaces) {
  const intent = queryResult.intent || {};
  const queryText = queryResult.query || "";

  if (!recommendedPlaces.length) {
    if (!hasStayRecommendationIntent(queryText, intent)) {
      return buildConversationalReply("greeting", queryText).answer;
    }
    return [
      "Mình chưa tìm thấy chỗ nào khớp đủ tiêu chí này trong dữ liệu hiện có. 🙏",
      "Bạn thử nới một chút nhé — ví dụ bỏ bớt một tiện ích bắt buộc, mở rộng khu vực, hoặc đổi sang mốc gần như Cầu Rồng, biển Mỹ Khê hay sân bay.",
    ].join("\n\n");
  }

  const topPlaces = recommendedPlaces.slice(0, 3);
  const needPhrase = buildNeedPhrase(intent);
  const sections = [];

  if (needPhrase) {
    sections.push(
      topPlaces.length === 1
        ? `Mình tìm được 1 lựa chọn phù hợp với yêu cầu ${needPhrase}:`
        : `Mình tìm được ${topPlaces.length} lựa chọn phù hợp với yêu cầu ${needPhrase}:`,
    );
  } else {
    sections.push(
      topPlaces.length === 1
        ? `Mình tìm được 1 lựa chọn phù hợp cho bạn:`
        : `Mình tìm được ${topPlaces.length} lựa chọn phù hợp cho bạn:`,
    );
  }

  sections.push(topPlaces.map((place) => buildPlaceBlock(place, intent)).join("\n\n"));

  const caveats = buildCaveatBullets(queryText, recommendedPlaces);
  if (caveats.length) {
    sections.push(["Điểm cần lưu ý:", ...caveats.map((item) => `• ${item}`)].join("\n"));
  }

  return sections.join("\n\n");
}

function buildFollowUpPrompts(intent, recommendedPlaces) {
  if (recommendedPlaces.length) {
    return [];
  }

  const landmarkSlugs = intent.landmark_slugs || [];
  const zoneSlugs = intent.zone_slugs || [];
  const amenityKeys = (intent.amenity_labels || []).map(normalizeVietnamese);
  const hasBeach =
    landmarkSlugs.includes("east-sea-park") ||
    zoneSlugs.includes("my-khe-strip") ||
    /bien|beach/.test(normalizeVietnamese(intent.normalized_query || ""));
  const hasPet = amenityKeys.some((key) => key.includes("vat nuoi") || key.includes("thu cung"));

  const prompts = [];
  if (hasPet && hasBeach) {
    prompts.push("🐶 Chỗ cho thú cưng gần biển nhất");
  } else if (hasPet) {
    prompts.push("🐶 Chỗ cho thú cưng đánh giá cao");
  }
  if (hasBeach) {
    prompts.push("🏖️ Chỗ gần Công viên Biển Đông nhất");
  }
  prompts.push("👨‍👩‍👧‍👦 Chỗ hợp gia đình, đánh giá cao");
  prompts.push("💰 Chỗ giá tốt trong khu vực");
  if (recommendedPlaces.length) {
    prompts.push("🏊 Chỗ có hồ bơi");
  }

  return uniqueStrings(prompts).slice(0, 4);
}

const QUICK_INTENT_REPLIES = {
  greeting: {
    answer: [
      "Xin chào 👋",
      "Mình là StayFinder AI, có thể giúp bạn tìm chỗ ở tại Đà Nẵng:",
      ["• Khách sạn gần biển", "• Homestay cho gia đình", "• Chỗ ở gần sân bay", "• Resort có hồ bơi"].join("\n"),
      "Bạn đang tìm loại hình nào?",
    ].join("\n\n"),
    prompts: [
      "🏖️ Khách sạn gần biển",
      "👨‍👩‍👧‍👦 Homestay cho gia đình",
      "✈️ Chỗ ở gần sân bay",
      "🏊 Resort có hồ bơi",
    ],
  },
  thanks: {
    answer: "Rất vui được giúp bạn! 😊 Khi cần tìm thêm chỗ ở nào ở Đà Nẵng, bạn cứ nhắn mình nhé.",
    prompts: [
      "🏖️ Khách sạn gần biển",
      "👨‍👩‍👧‍👦 Homestay cho gia đình",
      "🏊 Resort có hồ bơi",
    ],
  },
  capability: {
    answer: [
      "Mình là StayFinder AI 🤖 — trợ lý tìm chỗ ở tại Đà Nẵng.",
      "Bạn có thể hỏi mình theo nhu cầu thực tế, ví dụ:",
      ["• \"Khách sạn gần biển cho gia đình\"", "• \"Homestay yên tĩnh gần An Thượng\"", "• \"Chỗ ở gần sân bay, có chỗ đỗ xe\""].join("\n"),
      "Mình sẽ gợi ý và giải thích vì sao chỗ đó phù hợp.",
    ].join("\n\n"),
    prompts: [
      "🏖️ Khách sạn gần biển",
      "👨‍👩‍👧‍👦 Homestay cho gia đình",
      "✈️ Chỗ ở gần sân bay",
    ],
  },
  smalltalk: {
    answer: "Mình ở đây để giúp bạn tìm chỗ ở tại Đà Nẵng 🙂 Bạn muốn tìm chỗ gần biển, gần trung tâm hay gần sân bay?",
    prompts: [
      "🏖️ Khách sạn gần biển",
      "🌉 Chỗ ở gần trung tâm",
      "✈️ Chỗ ở gần sân bay",
    ],
  },
};

function detectQuickIntent(queryText) {
  const normalized = normalizeVietnamese(queryText).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  const words = normalized.split(" ");

  if (/(^|\s)(cam on|thank|thanks|thank you|tks|ty)(\s|$)/.test(normalized)) {
    return "thanks";
  }
  if (
    /(ban la ai|ban ten gi|ban lam duoc gi|ban giup duoc gi|giup duoc gi|lam duoc nhung gi|what can you do|who are you|how can you help)/.test(
      normalized,
    )
  ) {
    return "capability";
  }
  if (
    words.length <= 4 &&
    /(^|\s)(hi|hii|hey|helo|hello|hallo|halo|chao|xin chao|alo|a lo|yo|good morning|good evening|good afternoon)(\s|$)/.test(
      normalized,
    )
  ) {
    return "greeting";
  }
  if (words.length <= 3 && /(^|\s)(ok|oke|okay|okie|uh|um|umm|hmm|vang|u|uhm|yes|no|haha|hihi)(\s|$)/.test(normalized)) {
    return "smalltalk";
  }
  return null;
}

function buildConversationalReply(intentKind, queryText) {
  const template = QUICK_INTENT_REPLIES[intentKind] || QUICK_INTENT_REPLIES.greeting;
  return {
    answer: template.answer,
    applied_filters: formatAppliedFilters({}),
    recommended_places: [],
    local_context_used: [],
    follow_up_prompts: template.prompts.slice(0, 4),
    meta: {
      query: queryText,
      should_recommend_places: false,
      conversation_intent: intentKind,
      semantic_error: null,
      semantic_matches: [],
    },
  };
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

function runCommand(command, args, { cwd = config.rootDir, env = process.env } = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd,
      env,
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
  const envOverrides = await getAiConfigEnv();
  const { stdout } = await runCommand(config.pythonBin, [config.ragScriptPath, ...args], {
    env: { ...process.env, ...envOverrides },
  });
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

  if (!hasStayRecommendationIntent(queryText, {})) {
    const quickIntent = detectQuickIntent(queryText);
    if (quickIntent) {
      return buildConversationalReply(quickIntent, queryText);
    }
  }

  const { config: aiConfig } = await getAiConfig();
  const generate = parseBoolean(payload.generate, aiConfig.chat_generate);
  const candidateLimit = parseInteger(payload.candidateLimit, aiConfig.chat_candidate_limit, {
    min: 1,
    max: 30,
  });
  const semanticLimit = parseInteger(payload.semanticLimit, aiConfig.chat_semantic_limit, {
    min: 1,
    max: 20,
  });
  const outputPlaces = parseInteger(payload.outputPlaces, aiConfig.chat_output_places, {
    min: 1,
    max: 10,
  });
  const outputMatches = parseInteger(payload.outputMatches, aiConfig.chat_output_matches, {
    min: 1,
    max: 10,
  });

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
  const shouldRecommendPlaces = hasStayRecommendationIntent(queryText, result.intent || {});
  const recommendedPlaceIds = shouldRecommendPlaces
    ? buildRecommendedPlaceIdOrder(result, outputPlaces)
    : [];
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
      should_recommend_places: shouldRecommendPlaces,
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

function isFallbackReviewSummary(summary) {
  if (!summary) {
    return false;
  }

  const model = String(summary.model || "").toLowerCase();
  const strategy = String(summary.metadata?.strategy || "").toLowerCase();
  return (
    model === "heuristic-fallback" ||
    strategy === "fallback" ||
    strategy.startsWith("fallback-after-llm-error")
  );
}

async function getOrGenerateReviewSummary(payload) {
  const identifier = String(payload.placeId || payload.place_id || payload.id || "").trim();
  const titleSearch = String(payload.titleSearch || "").trim();
  const refresh = parseBoolean(payload.refresh, false);
  const { config: aiConfig } = await getAiConfig();
  const useLlm = parseBoolean(payload.useLlm, aiConfig.review_summary_use_llm);

  if (!identifier && !titleSearch) {
    throw badRequest("placeId or titleSearch is required.");
  }

  if (identifier && !refresh) {
    const cached = await getCachedReviewSummary(identifier);
    if (cached && !(useLlm && isFallbackReviewSummary(cached))) {
      return cached;
    }
  }

  let canonicalPlaceId = identifier;
  if (identifier) {
    const place = await findPlaceByIdentifier(identifier);
    if (!place) {
      throw notFound("Không tìm thấy địa điểm này trong database hiện tại để tạo tóm tắt AI.");
    }
    canonicalPlaceId = place.place_id;
  }

  const args = ["review-summary"];
  if (canonicalPlaceId) {
    args.push("--place-id", canonicalPlaceId);
  } else if (titleSearch) {
    args.push("--title-search", titleSearch);
  }
  if (refresh) {
    args.push("--refresh");
  }
  if (useLlm) {
    args.push("--use-llm");
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
  return result.rows.map((row) => ({
    ...row,
    name: normalizeLandmarkDisplayName(row.name),
  }));
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
  return {
    ...result.rows[0],
    name: normalizeLandmarkDisplayName(result.rows[0].name),
  };
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

async function listAppUsers(filters) {
  const bag = makeParamBag();
  const where = ["1=1"];

  if (filters.q) {
    const ref = bag.push(`%${filters.q}%`);
    where.push(`(u.email ILIKE ${ref} OR u.display_name ILIKE ${ref})`);
  }

  const countResult = await query(
    `SELECT COUNT(*)::integer AS total FROM app_users u WHERE ${where.join(" AND ")}`,
    bag.params,
  );
  const total = countResult.rows[0]?.total ?? 0;

  const listBag = makeParamBag();
  listBag.params.push(...bag.params);
  const limitRef = listBag.push(filters.limit);
  const offsetRef = listBag.push(filters.offset);

  const result = await query(
    `SELECT
        u.id::text AS id,
        u.email,
        u.display_name,
        u.created_at,
        u.updated_at,
        COUNT(s.id) FILTER (
          WHERE s.revoked_at IS NULL AND s.expires_at > now()
        )::integer AS active_sessions
      FROM app_users u
      LEFT JOIN user_sessions s ON s.user_id = u.id
      WHERE ${where.join(" AND ")}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${limitRef}
      OFFSET ${offsetRef}`,
    listBag.params,
  );

  return {
    total,
    page: Math.floor(filters.offset / filters.limit) + 1,
    page_size: filters.limit,
    items: result.rows,
  };
}

async function getAppUser(id) {
  const result = await query(
    `SELECT
        u.id::text AS id,
        u.email,
        u.display_name,
        u.created_at,
        u.updated_at,
        COUNT(s.id) FILTER (
          WHERE s.revoked_at IS NULL AND s.expires_at > now()
        )::integer AS active_sessions
      FROM app_users u
      LEFT JOIN user_sessions s ON s.user_id = u.id
      WHERE u.id::text = $1
      GROUP BY u.id
      LIMIT 1`,
    [id],
  );
  if (!result.rows[0]) {
    throw notFound("Không tìm thấy người dùng.");
  }
  return result.rows[0];
}

async function updateAppUser(id, payload) {
  await getAppUser(id);

  const updates = {};
  if (payload.display_name !== undefined) {
    const cleaned = String(payload.display_name || "").trim();
    if (!cleaned) {
      throw badRequest("Tên hiển thị không được để trống.");
    }
    updates.display_name = cleaned.slice(0, 80);
  }

  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);
    if (!validateEmail(email)) {
      throw badRequest("Email không hợp lệ.");
    }
    const existing = await query(
      "SELECT 1 FROM app_users WHERE lower(email) = lower($1) AND id::text <> $2 LIMIT 1",
      [email, id],
    );
    if (existing.rowCount) {
      throw new HttpError(409, "Email này đã được người khác sử dụng.", undefined, "email_taken");
    }
    updates.email = email;
  }

  if (payload.password !== undefined && payload.password !== "") {
    if (!validatePassword(String(payload.password))) {
      throw badRequest("Mật khẩu cần có ít nhất 6 ký tự.");
    }
    updates.password_hash = hashPassword(String(payload.password));
  }

  const entries = Object.entries(updates);
  if (!entries.length) {
    throw badRequest("Không có trường hợp lệ nào để cập nhật.");
  }

  const bag = makeParamBag();
  const setSql = entries.map(([key, value]) => `${key} = ${bag.push(value)}`).join(", ");
  bag.push(id);
  await query(`UPDATE app_users SET ${setSql} WHERE id::text = $${bag.params.length}`, bag.params);

  return getAppUser(id);
}

async function deleteAppUser(id) {
  const user = await getAppUser(id);
  await query("DELETE FROM app_users WHERE id::text = $1", [id]);
  return { deleted: true, id: user.id, email: user.email };
}

async function revokeAppUserSessions(id) {
  const user = await getAppUser(id);
  const result = await query(
    `UPDATE user_sessions
     SET revoked_at = now()
     WHERE user_id = $1::uuid AND revoked_at IS NULL`,
    [user.id],
  );
  return { ok: true, id: user.id, revoked_sessions: result.rowCount || 0 };
}

const AI_TEST_TIMEOUT_MS = 45_000;

async function testAiConnection(payload) {
  const queryText = String(payload.query || "").trim() || "Xin chào, bạn có đang hoạt động không?";
  const provider = await getEffectiveProviderConfig();
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TEST_TIMEOUT_MS);

  const baseResult = {
    query: queryText,
    provider: provider.provider,
    model: provider.chat_model || null,
  };

  try {
    if (!provider.api_key) {
      throw new Error("Chưa cấu hình API key cho provider.");
    }

    let url;
    let headers;
    let body;
    let extractAnswer;

    if (provider.provider === "anthropic") {
      const base = (provider.base_url || "https://api.anthropic.com").replace(/\/+$/, "");
      url = `${base}/v1/messages`;
      headers = {
        "Content-Type": "application/json",
        "x-api-key": provider.api_key,
        "anthropic-version": "2023-06-01",
      };
      body = {
        model: provider.chat_model,
        max_tokens: 1024,
        messages: [{ role: "user", content: queryText }],
      };
      if (provider.temperature) {
        const t = Number(provider.temperature);
        if (Number.isFinite(t)) body.temperature = t;
      }
      extractAnswer = (data) =>
        Array.isArray(data?.content)
          ? data.content.map((part) => part?.text).filter(Boolean).join("\n") || null
          : null;
    } else {
      if (!provider.base_url) {
        throw new Error("Chưa cấu hình Base URL cho provider.");
      }
      const base = provider.base_url.replace(/\/+$/, "");
      url = `${base}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      };
      body = {
        model: provider.chat_model,
        messages: [{ role: "user", content: queryText }],
      };
      if (provider.temperature) {
        const t = Number(provider.temperature);
        if (Number.isFinite(t)) body.temperature = t;
      }
      extractAnswer = (data) => data?.choices?.[0]?.message?.content ?? null;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    const latency = Date.now() - start;

    if (!response.ok) {
      const detail = data ? JSON.stringify(data) : text;
      return {
        ...baseResult,
        ok: false,
        endpoint: url,
        status: response.status,
        answer: null,
        error: `HTTP ${response.status} ${response.statusText}`.trim(),
        details: String(detail || "").slice(0, 800),
        latency_ms: latency,
      };
    }

    const answer = data ? extractAnswer(data) : null;
    return {
      ...baseResult,
      ok: Boolean(answer),
      endpoint: url,
      status: response.status,
      answer: answer || null,
      error: answer ? null : "Endpoint phản hồi nhưng không có nội dung trả về.",
      details: answer ? null : String(text || "").slice(0, 800),
      latency_ms: latency,
    };
  } catch (error) {
    return {
      ...baseResult,
      ok: false,
      answer: null,
      error:
        error?.name === "AbortError"
          ? `Timeout sau ${AI_TEST_TIMEOUT_MS / 1000}s.`
          : error?.message || "Test kết nối AI thất bại.",
      latency_ms: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
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

  const routedPairs = await enrichRouteDistances({
    placeIds: targets.map((item) => item.id),
    landmarkSlugs: landmarkSlugs.length ? landmarkSlugs : null,
  });

  return {
    job: "distance",
    batch_key: batchKey,
    place_count: targets.length,
    landmark_slugs: landmarkSlugs,
    affected_rows: Number(result.rows[0]?.affected_rows || 0),
    routed_pairs: routedPairs,
  };
}

async function fetchOsrmRoute(profile, fromLng, fromLat, toLng, toLat) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.osrmTimeoutMs);
  try {
    const url = `${config.osrmBaseUrl.replace(/\/$/, "")}/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=false&steps=false`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "codex-crawl/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`OSRM ${profile} request failed with ${response.status}`);
    }
    const payload = await response.json();
    const route = payload?.routes?.[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      throw new Error(`OSRM ${profile} response missing route data`);
    }
    return {
      distance_m: Math.round(route.distance),
      duration_s: Math.round(route.duration),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichRouteDistances({ placeIds, landmarkSlugs = null, onlyMissing = true }) {
  const result = await query(
    `SELECT
        plm.id::text AS metric_id,
        p.lat AS place_lat,
        p.lng AS place_lng,
        plm.anchor_lat,
        plm.anchor_lng
      FROM place_landmark_metrics plm
      JOIN places p ON p.id = plm.place_id
      JOIN local_landmarks l ON l.id = plm.landmark_id
      WHERE plm.place_id = ANY($1::uuid[])
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND plm.anchor_lat IS NOT NULL
        AND plm.anchor_lng IS NOT NULL
        AND ($2::text[] IS NULL OR l.slug = ANY($2::text[]))
        AND ($4::boolean = false OR plm.driving_distance_m IS NULL)
      ORDER BY plm.distance_m ASC NULLS LAST
      LIMIT $3`,
    [placeIds, landmarkSlugs, config.osrmMaxPairsPerRebuild, onlyMissing],
  );

  let updated = 0;
  for (const row of result.rows) {
    try {
      const [walkingResult, drivingResult] = await Promise.allSettled([
        fetchOsrmRoute("foot", row.place_lng, row.place_lat, row.anchor_lng, row.anchor_lat),
        fetchOsrmRoute("driving", row.place_lng, row.place_lat, row.anchor_lng, row.anchor_lat),
      ]);

      const walking = walkingResult.status === "fulfilled" ? walkingResult.value : null;
      const driving = drivingResult.status === "fulfilled" ? drivingResult.value : null;

      if (!walking && !driving) {
        continue;
      }

      await query(
        `UPDATE place_landmark_metrics
         SET walking_distance_m = COALESCE($2, walking_distance_m),
             walking_duration_s = COALESCE($3, walking_duration_s),
             driving_distance_m = COALESCE($4, driving_distance_m),
             driving_duration_s = COALESCE($5, driving_duration_s),
             source = 'osrm',
             computed_at = now()
         WHERE id = $1::uuid`,
        [
          row.metric_id,
          walking?.distance_m ?? null,
          walking?.duration_s ?? null,
          driving?.distance_m ?? null,
          driving?.duration_s ?? null,
        ],
      );
      updated += 1;
    } catch (_error) {
      // Keep geodesic fallback for rows that fail OSRM enrichment.
    }
  }

  return updated;
}

async function fetchPlaceLandmarkMetrics(placeUuid) {
  const result = await query(
    `SELECT json_agg(
        json_build_object(
          'landmark_slug', lm.slug,
          'landmark_name', lm.name,
          'distance_m', plm.distance_m,
          'straight_line_distance_m', plm.distance_m,
          'walking_distance_m', plm.walking_distance_m,
          'walking_duration_s', plm.walking_duration_s,
          'driving_distance_m', plm.driving_distance_m,
          'driving_duration_s', plm.driving_duration_s,
          'method', plm.method,
          'anchor_label', plm.anchor_label,
          'anchor_lat', plm.anchor_lat,
          'anchor_lng', plm.anchor_lng
        )
        ORDER BY COALESCE(plm.driving_distance_m, plm.walking_distance_m, plm.distance_m) ASC NULLS LAST,
                 lm.slug ASC
      ) AS landmark_metrics
      FROM place_landmark_metrics plm
      JOIN local_landmarks lm ON lm.id = plm.landmark_id
      WHERE plm.place_id = $1::uuid`,
    [placeUuid],
  );

  return normalizeLandmarkMetricsForResponse(result.rows[0]?.landmark_metrics || []);
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

app.post(
  "/auth/signup",
  asyncRoute(async (req, res) => {
    res.status(201).json(await signupUser(req.body || {}));
  }),
);

app.post(
  "/auth/login",
  asyncRoute(async (req, res) => {
    res.json(await loginUser(req.body || {}));
  }),
);

app.get(
  "/auth/me",
  asyncRoute(async (req, res) => {
    const user = await requireAuthUser(req);
    res.json({ user: serializeUser(user) });
  }),
);

app.post(
  "/auth/logout",
  asyncRoute(async (req, res) => {
    res.json(await logoutUser(req));
  }),
);

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

app.get(
  "/admin/ai-config",
  asyncRoute(async (_req, res) => {
    res.json(await getAiConfig());
  }),
);

app.put(
  "/admin/ai-config",
  asyncRoute(async (req, res) => {
    res.json(await updateAiConfig((req.body && req.body.config) || req.body || {}));
  }),
);

app.post(
  "/admin/ai-config/test",
  asyncRoute(async (req, res) => {
    res.json(await testAiConnection(req.body || {}));
  }),
);

app.get(
  "/admin/users",
  asyncRoute(async (req, res) => {
    const limit = parseInteger(req.query.limit, 25, { min: 1, max: 100 });
    const page = parseInteger(req.query.page, 1, { min: 1 });
    res.json(
      await listAppUsers({
        q: String(req.query.q || "").trim(),
        limit,
        offset: (page - 1) * limit,
      }),
    );
  }),
);

app.get(
  "/admin/users/:id",
  asyncRoute(async (req, res) => {
    res.json(await getAppUser(req.params.id));
  }),
);

app.patch(
  "/admin/users/:id",
  asyncRoute(async (req, res) => {
    res.json(await updateAppUser(req.params.id, req.body || {}));
  }),
);

app.delete(
  "/admin/users/:id",
  asyncRoute(async (req, res) => {
    res.json(await deleteAppUser(req.params.id));
  }),
);

app.post(
  "/admin/users/:id/revoke-sessions",
  asyncRoute(async (req, res) => {
    res.json(await revokeAppUserSessions(req.params.id));
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
