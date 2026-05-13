#!/usr/bin/env node
// Pre-generate AI review summaries for top N places (theo reviews_count DESC).
// Đọc credential DB từ .env, gọi scripts/phase2_rag.py review-summary cho từng place.
//
// Cách dùng:
//   node scripts/pregenerate_review_summaries.mjs                       # top 50 toàn DB
//   node scripts/pregenerate_review_summaries.mjs --limit 100
//   node scripts/pregenerate_review_summaries.mjs --batch-key <key> --limit 200
//   node scripts/pregenerate_review_summaries.mjs --refresh              # ghi đè cache
//   node scripts/pregenerate_review_summaries.mjs --no-llm               # chỉ dùng heuristic

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
dotenv.config({ path: resolve(rootDir, ".env") });

const args = parseArgs(process.argv.slice(2));
const limit = Math.max(1, Number.parseInt(String(args.limit ?? "50"), 10) || 50);
const batchKey = typeof args["batch-key"] === "string" ? args["batch-key"] : null;
const refresh = args.refresh === true || args.refresh === "true";
const useLlm = !(args["no-llm"] === true || args["no-llm"] === "true");

const localVenvPython = resolve(rootDir, ".venv/bin/python");
const pythonBin =
  process.env.PYTHON_BIN ||
  (existsSync(localVenvPython) ? localVenvPython : "python3");
const ragScript = resolve(rootDir, "scripts/phase2_rag.py");

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function buildPool() {
  if (!process.env.PGHOST || !process.env.PGUSER) {
    throw new Error(
      "Thiếu PGHOST/PGUSER trong .env. Hãy kiểm tra cấu hình DB trước khi chạy.",
    );
  }

  const sslMode = String(process.env.PGSSLMODE || "require").toLowerCase();
  const ssl =
    sslMode === "disable" || sslMode === "off"
      ? false
      : { rejectUnauthorized: false };

  return new pg.Pool({
    host: process.env.PGHOST,
    port: Number.parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "postgres",
    ssl,
  });
}

function runPython(forwardedArgs) {
  return new Promise((resolveCmd, rejectCmd) => {
    const child = spawn(pythonBin, [ragScript, ...forwardedArgs], {
      env: process.env,
      cwd: rootDir,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectCmd);
    child.on("close", (code) => {
      if (code === 0) {
        resolveCmd({ stdout, stderr });
        return;
      }
      rejectCmd(new Error(stderr.trim() || `Python exited with code ${code}`));
    });
  });
}

async function listTargetPlaces(pool) {
  const params = [];
  const where = ["1=1"];

  if (batchKey) {
    params.push(batchKey);
    where.push(`b.batch_key = $${params.length}`);
  }
  params.push(limit);

  const sql = `
    SELECT p.place_id, p.title, p.reviews_count
    FROM places p
    LEFT JOIN crawl_batches b ON b.id = p.batch_id
    WHERE ${where.join(" AND ")}
      AND p.place_id IS NOT NULL
      AND btrim(p.place_id) <> ''
    ORDER BY p.reviews_count DESC NULLS LAST, p.title ASC
    LIMIT $${params.length}
  `;

  const result = await pool.query(sql, params);
  return result.rows;
}

async function main() {
  if (!existsSync(ragScript)) {
    throw new Error(`Không thấy script Python tại ${ragScript}`);
  }

  console.log(
    `[pregenerate] limit=${limit}, batch=${batchKey || "(any)"}, refresh=${refresh}, useLlm=${useLlm}`,
  );

  const pool = buildPool();
  let rows;
  try {
    rows = await listTargetPlaces(pool);
  } finally {
    await pool.end().catch(() => undefined);
  }

  if (!rows.length) {
    console.log("[pregenerate] Không có place nào khớp filter.");
    return;
  }

  console.log(`[pregenerate] Sẽ xử lý ${rows.length} place. Bắt đầu...\n`);

  const counters = { processed: 0, generated: 0, cached: 0, failed: 0 };
  const startedAt = Date.now();

  for (const row of rows) {
    counters.processed += 1;
    const label = `[${counters.processed}/${rows.length}] ${row.place_id} - ${row.title || "(no title)"}`;
    const pythonArgs = ["review-summary", "--place-id", row.place_id];
    if (refresh) {
      pythonArgs.push("--refresh");
    }
    if (useLlm) {
      pythonArgs.push("--use-claude");
    }

    const placeStart = Date.now();
    try {
      const { stdout } = await runPython(pythonArgs);
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        parsed = { source: "generated" };
      }
      const duration = ((Date.now() - placeStart) / 1000).toFixed(1);
      if (parsed.source === "cache") {
        counters.cached += 1;
        console.log(`${label}  ⟶ CACHE (${duration}s)`);
      } else {
        counters.generated += 1;
        console.log(
          `${label}  ⟶ GEN model=${parsed.model || "?"} (${duration}s)`,
        );
      }
    } catch (error) {
      counters.failed += 1;
      console.error(`${label}  ⟶ FAIL: ${error.message}`);
    }
  }

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\n[pregenerate] Xong sau ${totalSec}s. processed=${counters.processed}, generated=${counters.generated}, cache=${counters.cached}, failed=${counters.failed}`,
  );
}

main().catch((error) => {
  console.error(`[pregenerate] Lỗi: ${error.message}`);
  process.exitCode = 1;
});
