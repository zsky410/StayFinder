import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const localVenvPython = resolve(rootDir, ".venv/bin/python");

export const config = {
  rootDir,
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: parseInteger(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "",
  pgHost: process.env.PGHOST || process.env.SUPABASE_DB_HOST || "",
  pgPort: parseInteger(process.env.PGPORT || process.env.SUPABASE_DB_PORT, 5432),
  pgUser: process.env.PGUSER || process.env.SUPABASE_DB_USER || "postgres",
  pgPassword: process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD || "",
  pgDatabase: process.env.PGDATABASE || process.env.SUPABASE_DB_NAME || "postgres",
  pgSslMode: process.env.PGSSLMODE || "require",
  corsOrigins: parseCsv(process.env.CORS_ORIGIN),
  adminApiToken: process.env.ADMIN_API_TOKEN || "",
  pythonBin: process.env.PYTHON_BIN || (existsSync(localVenvPython) ? localVenvPython : "python3"),
  ragScriptPath: resolve(rootDir, process.env.RAG_SCRIPT_PATH || "scripts/phase2_rag.py"),
  defaultBatchKey:
    process.env.DEFAULT_BATCH_KEY || "danang_accommodations_batch_20260323_082743",
  chatGenerateDefault: parseBoolean(process.env.CHAT_GENERATE_DEFAULT, true),
  reviewSummaryUseLlmDefault: parseBoolean(
    process.env.REVIEW_SUMMARY_USE_LLM_DEFAULT,
    false,
  ),
  publicDefaultPageSize: parseInteger(process.env.PUBLIC_DEFAULT_PAGE_SIZE, 20),
  publicMaxPageSize: parseInteger(process.env.PUBLIC_MAX_PAGE_SIZE, 50),
  osrmBaseUrl: process.env.OSRM_BASE_URL || "https://router.project-osrm.org",
  osrmTimeoutMs: parseInteger(process.env.OSRM_TIMEOUT_MS, 8000),
  osrmMaxPairsPerRebuild: parseInteger(process.env.OSRM_MAX_PAIRS_PER_REBUILD, 200),
};
