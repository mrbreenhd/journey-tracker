#!/usr/bin/env bash
#
# Journey Tracker — production start script
#
# Builds the frontend (if needed), then runs the backend
# which serves both the API and the built SPA on a single port.
#
# Usage:
#   ./scripts/start.sh              # default: port 8000, 2 workers
#   PORT=3000 WORKERS=4 ./scripts/start.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ---------- configuration ----------
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
WORKERS="${WORKERS:-2}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# ---------- colours ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[start]${NC} $*"; }
warn()  { echo -e "${YELLOW}[start]${NC} $*"; }
error() { echo -e "${RED}[start]${NC} $*" >&2; }

# ---------- preflight checks ----------
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  warn "No .env file found — copying from .env.example if available"
  [[ -f "$ROOT_DIR/.env.example" ]] && cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

# ---------- python venv ----------
VENV_DIR="$ROOT_DIR/backend/.venv"
if [[ ! -d "$VENV_DIR" ]]; then
  error "Python venv not found at $VENV_DIR — run scripts/setup.sh first"
  exit 1
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# ---------- database migrations ----------
info "Running database migrations..."
alembic upgrade head

# ---------- frontend dist check ----------
DIST_DIR="$ROOT_DIR/frontend/dist"
if [[ ! -d "$DIST_DIR" ]]; then
  error "Frontend not built — run scripts/setup.sh first"
  exit 1
fi

# ---------- uploads dir ----------
mkdir -p "$ROOT_DIR/backend/uploads"

# ---------- launch ----------
info "Starting Journey Tracker on ${HOST}:${PORT} (${WORKERS} workers)..."
exec uvicorn backend.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers "$WORKERS" \
  --log-level "$LOG_LEVEL" \
  --proxy-headers \
  --forwarded-allow-ips='*'
