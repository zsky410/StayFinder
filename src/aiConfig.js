import { config } from "./config.js";
import { query } from "./db.js";
import { badRequest } from "./errors.js";

const SETTINGS_KEY = "ai_config";

function env(name, fallback = "") {
  const value = process.env[name];
  return value === undefined || value === null ? fallback : String(value);
}

// Behavioral + presentation fields (an toàn để hiển thị / chỉnh sửa).
const FIELD_SCHEMA = {
  // Chat
  chat_generate: { type: "boolean", default: () => config.chatGenerateDefault },
  chat_candidate_limit: { type: "integer", default: () => 12, min: 1, max: 30 },
  chat_semantic_limit: { type: "integer", default: () => 8, min: 1, max: 20 },
  chat_output_places: { type: "integer", default: () => 5, min: 1, max: 10 },
  chat_output_matches: { type: "integer", default: () => 5, min: 1, max: 10 },
  review_summary_use_llm: { type: "boolean", default: () => config.reviewSummaryUseLlmDefault },
  welcome_message: { type: "text", default: () => "" },
  suggested_prompts: { type: "string_array", default: () => [] },

  // Provider / kết nối (override env khi có giá trị)
  chat_provider: { type: "text", default: () => env("RAG_CHAT_PROVIDER", "openai_compatible"), envKey: "RAG_CHAT_PROVIDER" },
  chat_base_url: {
    type: "text",
    default: () => env("RAG_CHAT_BASE_URL") || env("OPENAI_BASE_URL") || "",
    envKey: "RAG_CHAT_BASE_URL",
  },
  chat_model: { type: "text", default: () => env("RAG_CHAT_MODEL", "gpt-5.4"), envKey: "RAG_CHAT_MODEL" },
  embed_model: {
    type: "text",
    default: () => env("RAG_EMBED_MODEL", "text-embedding-3-small"),
    envKey: "RAG_EMBED_MODEL",
  },
  chat_temperature: { type: "text", default: () => env("RAG_CHAT_TEMPERATURE", ""), envKey: "RAG_CHAT_TEMPERATURE" },
};

// API key được xử lý riêng (secret): không bao giờ trả raw ra ngoài.
const SECRET_FIELD = "chat_api_key";
const SECRET_ENV_KEY = "RAG_CHAT_API_KEY";

let tableReady = false;

async function ensureSettingsTable() {
  if (tableReady) {
    return;
  }
  await query(
    `CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  tableReady = true;
}

function coerceValue(key, spec, rawValue) {
  switch (spec.type) {
    case "boolean":
      return Boolean(rawValue);
    case "integer": {
      const parsed = Number.parseInt(String(rawValue), 10);
      if (!Number.isFinite(parsed)) {
        throw badRequest(`${key} phải là số nguyên.`);
      }
      let value = parsed;
      if (Number.isFinite(spec.min)) value = Math.max(spec.min, value);
      if (Number.isFinite(spec.max)) value = Math.min(spec.max, value);
      return value;
    }
    case "text":
      return String(rawValue ?? "").slice(0, 2000);
    case "string_array":
      if (!Array.isArray(rawValue)) {
        throw badRequest(`${key} phải là mảng chuỗi.`);
      }
      return rawValue
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 12);
    default:
      return rawValue;
  }
}

async function readStored() {
  await ensureSettingsTable();
  const result = await query("SELECT value, updated_at FROM app_settings WHERE key = $1", [
    SETTINGS_KEY,
  ]);
  return {
    stored: result.rows[0]?.value || {},
    updated_at: result.rows[0]?.updated_at || null,
  };
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  const tail = text.slice(-4);
  return `••••••${tail}`;
}

function effectiveSecret(stored) {
  return stored[SECRET_FIELD] || env(SECRET_ENV_KEY) || env("OPENAI_API_KEY") || "";
}

export async function getAiConfig() {
  const { stored, updated_at } = await readStored();

  const merged = {};
  for (const [key, spec] of Object.entries(FIELD_SCHEMA)) {
    if (stored[key] !== undefined && stored[key] !== null) {
      try {
        merged[key] = coerceValue(key, spec, stored[key]);
      } catch {
        merged[key] = spec.default();
      }
    } else {
      merged[key] = spec.default();
    }
  }

  const secret = effectiveSecret(stored);
  merged.chat_api_key_set = Boolean(secret);
  merged.chat_api_key_hint = maskSecret(secret);
  merged.chat_api_key_source = stored[SECRET_FIELD] ? "admin" : secret ? "env" : "none";

  return { config: merged, updated_at };
}

export async function updateAiConfig(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw badRequest("Payload cấu hình AI không hợp lệ.");
  }

  const { stored } = await readStored();
  const next = { ...stored };

  for (const [key, rawValue] of Object.entries(patch)) {
    if (key === SECRET_FIELD) {
      const text = String(rawValue ?? "").trim();
      if (text) {
        next[SECRET_FIELD] = text; // chỉ ghi đè khi có giá trị mới
      }
      continue;
    }
    const spec = FIELD_SCHEMA[key];
    if (!spec) {
      continue; // bỏ qua key không hợp lệ (kể cả *_hint, *_set)
    }
    next[key] = coerceValue(key, spec, rawValue);
  }

  await ensureSettingsTable();
  await query(
    `INSERT INTO app_settings (key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(next)],
  );

  return getAiConfig();
}

// Config provider hiệu lực (raw, CHỈ dùng phía server - vd test kết nối trực tiếp).
export async function getEffectiveProviderConfig() {
  const { stored } = await readStored();
  const pick = (key) => {
    const value = stored[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
    return FIELD_SCHEMA[key].default();
  };

  return {
    provider: (pick("chat_provider") || "openai_compatible").trim().toLowerCase(),
    base_url: pick("chat_base_url").trim(),
    chat_model: pick("chat_model").trim(),
    temperature: pick("chat_temperature").trim(),
    api_key: effectiveSecret(stored),
  };
}

// Env override truyền xuống subprocess Python (RAG). Chỉ set khi admin đã cấu hình.
export async function getAiConfigEnv() {
  const { stored } = await readStored();
  const overrides = {};

  for (const [key, spec] of Object.entries(FIELD_SCHEMA)) {
    if (!spec.envKey) {
      continue;
    }
    const value = stored[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      overrides[spec.envKey] = String(value);
    }
  }

  if (stored[SECRET_FIELD]) {
    overrides[SECRET_ENV_KEY] = String(stored[SECRET_FIELD]);
  }

  return overrides;
}
