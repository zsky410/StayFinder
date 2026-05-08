import pg from "pg";

import { config } from "./config.js";

const { Pool } = pg;

function shouldUseSsl(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "require" || normalized === "verify-full" || normalized === "verify-ca";
}

function buildPoolConfig() {
  if (config.databaseUrl) {
    return {
      connectionString: config.databaseUrl,
      ssl: shouldUseSsl(config.pgSslMode) ? { rejectUnauthorized: false } : undefined,
    };
  }

  if (!config.pgHost || !config.pgPassword) {
    throw new Error(
      "Set DATABASE_URL (or SUPABASE_DB_URL), or configure PGHOST/PGPASSWORD for the backend.",
    );
  }

  return {
    host: config.pgHost,
    port: config.pgPort,
    user: config.pgUser,
    password: config.pgPassword,
    database: config.pgDatabase,
    ssl: shouldUseSsl(config.pgSslMode) ? { rejectUnauthorized: false } : undefined,
  };
}

export const pool = new Pool(buildPoolConfig());

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
