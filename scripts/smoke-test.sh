#!/usr/bin/env bash
# End-to-end smoke checks against a running server (default http://localhost:8080).
# Start the app first:  cd web-chat && mvn spring-boot:run
#
# If you see HTTP 500 on /api/messages after a schema change, stop the app and remove
# the local H2 files so Hibernate can recreate tables:  rm -f web-chat/data/chatdb.*
#
# Usage:
#   chmod +x scripts/smoke-test.sh
#   ./scripts/smoke-test.sh
#   BASE_URL=http://127.0.0.1:9090 ./scripts/smoke-test.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
USER="smoke_$(openssl rand -hex 4 2>/dev/null || echo $$)"
PASS="smokepass12"

_hostport() {
  local u="${BASE_URL#*://}"
  echo "${u%%/*}"
}

echo "==> Base URL: $BASE_URL"
echo "==> Register user: $USER"

reg_body=$(curl -sS -w "\n%{http_code}" -X POST "${BASE_URL}/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USER}\",\"password\":\"${PASS}\"}")
reg_code=$(echo "$reg_body" | tail -n1)
reg_json=$(echo "$reg_body" | sed '$d')
if [[ "$reg_code" != "201" ]]; then
  echo "Register failed: HTTP $reg_code" >&2
  echo "$reg_json" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  TOKEN=$(echo "$reg_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
else
  TOKEN=$(echo "$reg_json" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi
if [[ -z "$TOKEN" ]]; then
  echo "Could not parse token from: $reg_json" >&2
  exit 1
fi
echo "==> Got JWT (${#TOKEN} chars)"

echo "==> GET /api/messages (authorized)"
msg_code=$(curl -sS -o /tmp/smoke-messages.json -w "%{http_code}" \
  "${BASE_URL}/api/messages?limit=5" \
  -H "Authorization: Bearer ${TOKEN}")
if [[ "$msg_code" != "200" ]]; then
  echo "Messages failed: HTTP $msg_code" >&2
  cat /tmp/smoke-messages.json >&2
  exit 1
fi
echo "==> Messages OK (first bytes): $(head -c 120 /tmp/smoke-messages.json)…"

HOSTPORT="$(_hostport)"
WS_URL="ws://${HOSTPORT}/chat?token=${TOKEN}"

if command -v websocat >/dev/null 2>&1; then
  echo "==> WebSocket (websocat, optional): ${WS_URL%%\?*}?token=…"
  if printf '%s\n' '{"type":"MESSAGE","content":"smoke","clientMessageId":"smoke-1"}' \
    | websocat -n1 "$WS_URL" 2>/dev/null | grep -q "smoke"; then
    echo "==> WebSocket OK"
  else
    echo "==> WebSocket: no 'smoke' in output (timing/tooling); verify manually if needed." >&2
  fi
else
  echo "==> Optional: install websocat (brew install websocat) to exercise WebSocket from this script."
fi

echo "==> Smoke checks passed (REST)."
