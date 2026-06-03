import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPgConfig() {
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
    return {
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.PGHOST || process.env.SUPABASE_DB_HOST,
    port: parseInteger(process.env.PGPORT || process.env.SUPABASE_DB_PORT, 5432),
    user: process.env.PGUSER || process.env.SUPABASE_DB_USER || "postgres",
    password: process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.SUPABASE_DB_NAME || "postgres",
    ssl: { rejectUnauthorized: false },
  };
}

async function fetchOsrmRoute(baseUrl, profile, fromLng, fromLat, toLng, toLat, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `${baseUrl.replace(/\/$/, "")}/route/v1/${profile}/` +
      `${fromLng},${fromLat};${toLng},${toLat}?overview=false&steps=false`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "codex-crawl/1.0" },
    });
    if (!response.ok) {
      throw new Error(`OSRM ${profile} failed with ${response.status}`);
    }
    const payload = await response.json();
    const route = payload?.routes?.[0];
    if (!route) {
      throw new Error(`OSRM ${profile} missing route`);
    }
    return {
      distance_m: Math.round(route.distance),
      duration_s: Math.round(route.duration),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runConcurrent(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const limit = parseInteger(process.env.OSRM_ENRICH_LIMIT, 500);
  const onlyMissing = String(process.env.OSRM_ENRICH_ONLY_MISSING ?? "true") !== "false";
  const baseUrl = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
  const maxDistanceM = parseInteger(process.env.OSRM_ENRICH_MAX_DISTANCE_M, 15000);
  const timeoutMs = parseInteger(process.env.OSRM_TIMEOUT_MS, 8000);
  const concurrency = parseInteger(process.env.OSRM_ENRICH_CONCURRENCY, 3);

  const pool = new Pool({
    ...getPgConfig(),
    max: Math.max(4, concurrency + 1),
  });

  const result = await pool.query(
    `SELECT
        plm.id::text AS metric_id,
        p.place_id,
        p.title,
        l.slug AS landmark_slug,
        p.lat AS place_lat,
        p.lng AS place_lng,
        plm.anchor_lat,
        plm.anchor_lng
      FROM place_landmark_metrics plm
      JOIN places p ON p.id = plm.place_id
      JOIN local_landmarks l ON l.id = plm.landmark_id
      WHERE p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND plm.anchor_lat IS NOT NULL
        AND plm.anchor_lng IS NOT NULL
        AND ($1::boolean = false OR plm.driving_distance_m IS NULL)
        AND plm.distance_m <= $3
      ORDER BY plm.distance_m ASC NULLS LAST, plm.computed_at ASC NULLS FIRST
      LIMIT $2`,
    [onlyMissing, limit, maxDistanceM],
  );

  let updated = 0;
  let failed = 0;

  await runConcurrent(result.rows, concurrency, async (row) => {
    try {
      const [walkingResult, drivingResult] = await Promise.allSettled([
        fetchOsrmRoute(
          baseUrl,
          "foot",
          row.place_lng,
          row.place_lat,
          row.anchor_lng,
          row.anchor_lat,
          timeoutMs,
        ),
        fetchOsrmRoute(
          baseUrl,
          "driving",
          row.place_lng,
          row.place_lat,
          row.anchor_lng,
          row.anchor_lat,
          timeoutMs,
        ),
      ]);

      const walking = walkingResult.status === "fulfilled" ? walkingResult.value : null;
      const driving = drivingResult.status === "fulfilled" ? drivingResult.value : null;

      if (!walking && !driving) {
        throw new Error(
          [
            walkingResult.status === "rejected" ? `walking: ${walkingResult.reason.message}` : null,
            drivingResult.status === "rejected" ? `driving: ${drivingResult.reason.message}` : null,
          ]
            .filter(Boolean)
            .join("; "),
        );
      }

      if (!walking || !driving) {
        console.warn(
          `[route-enrich] partial metric=${row.metric_id} place=${row.place_id} landmark=${row.landmark_slug}: ` +
            `${walking ? "walking ok" : "walking missing"}, ${driving ? "driving ok" : "driving missing"}`,
        );
      }

      await pool.query(
        `UPDATE place_landmark_metrics
         SET walking_distance_m = $2,
             walking_duration_s = $3,
             driving_distance_m = $4,
             driving_duration_s = $5,
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
    } catch (error) {
      failed += 1;
      console.error(
        `[route-enrich] failed metric=${row.metric_id} place=${row.place_id} landmark=${row.landmark_slug}: ${error.message}`,
      );
    }
  });

  const coverage = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE walking_distance_m IS NOT NULL) AS with_walking,
        COUNT(*) FILTER (WHERE driving_distance_m IS NOT NULL) AS with_driving,
        COUNT(*) AS total
      FROM place_landmark_metrics plm
      JOIN local_landmarks l ON l.id = plm.landmark_id
      WHERE l.kind = 'point'`,
  );

  console.log(
    JSON.stringify(
      {
        selected: result.rows.length,
        updated,
        failed,
        concurrency,
        maxDistanceM,
        coverage: coverage.rows[0],
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
