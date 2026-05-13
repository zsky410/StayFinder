const fs = require("node:fs");
const path = require("node:path");

function readPortFromRootEnv() {
  try {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) {
      return null;
    }
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const match = line.match(/^PORT\s*=\s*(.+)$/);
      if (match) {
        const value = match[1].replace(/^["']|["']$/g, "").trim();
        return value || null;
      }
    }
  } catch {
    // ignore - fall back to default
  }
  return null;
}

module.exports = ({ config }) => {
  const apiPort =
    String(process.env.EXPO_PUBLIC_API_PORT || "").trim() ||
    readPortFromRootEnv() ||
    "3000";

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      apiPort,
    },
  };
};
