#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ENV_PATH="$ROOT_DIR/mobile/.env"
API_PORT="${1:-3001}"

detect_lan_ip() {
  ip -4 addr show scope global up \
    | awk '/inet / {print $2}' \
    | cut -d/ -f1 \
    | grep -E '^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)' \
    | head -n1
}

LAN_IP="${EXPO_PUBLIC_API_HOST:-$(detect_lan_ip)}"

if [[ -z "${LAN_IP:-}" ]]; then
  echo "Could not detect a LAN IPv4 address. Set EXPO_PUBLIC_API_HOST manually." >&2
  exit 1
fi

cat > "$MOBILE_ENV_PATH" <<EOF
EXPO_PUBLIC_API_BASE_URL=http://${LAN_IP}:${API_PORT}
EXPO_PUBLIC_API_PORT=${API_PORT}
EOF

echo "Wrote $MOBILE_ENV_PATH"
echo "EXPO_PUBLIC_API_BASE_URL=http://${LAN_IP}:${API_PORT}"
