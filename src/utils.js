import { badRequest } from "./errors.js";

export function parseStringList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  if (typeof value === "string") {
    return uniqueStrings(value.split(","));
  }

  return [];
}

export function uniqueStrings(values) {
  const seen = new Set();
  const output = [];

  for (const value of values || []) {
    const cleaned = String(value ?? "").trim();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    output.push(cleaned);
  }

  return output;
}

export function parseInteger(value, fallback, { min, max } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let result = parsed;
  if (Number.isFinite(min)) {
    result = Math.max(min, result);
  }
  if (Number.isFinite(max)) {
    result = Math.min(max, result);
  }
  return result;
}

export function parseFloatNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseBoolean(value, fallback = false) {
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

export function asNullableText(value) {
  if (value === undefined) {
    return undefined;
  }
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned : null;
}

export function asNullableNumber(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw badRequest("Expected a numeric value.");
  }
  return parsed;
}

export function ensureArrayOfStrings(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw badRequest(`${fieldName} must be an array of strings.`);
  }
  return uniqueStrings(value);
}

export function ensurePlainObject(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${fieldName} must be a JSON object.`);
  }
  return value;
}

export function formatDistance(distanceM) {
  if (!Number.isFinite(Number(distanceM))) {
    return "không rõ khoảng cách";
  }

  const numeric = Number(distanceM);
  if (numeric >= 1000) {
    return `${(numeric / 1000).toFixed(1)} km`;
  }
  return `${Math.round(numeric)} m`;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

export function coerceRowNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
