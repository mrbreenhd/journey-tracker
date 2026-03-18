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
  info "Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

info "Installing Python dependencies..."
pip install -q -r "$ROOT_DIR/backend/requirements.txt"

# ---------- database migrations ----------
info "Running database migrations..."
alembic upgrade head

# ---------- frontend build ----------
DIST_DIR="$ROOT_DIR/frontend/dist"
if [[ ! -d "$DIST_DIR" ]] || [[ "${REBUILD_FRONTEND:-0}" == "1" ]]; then
  info "Building frontend..."

  # Ensure we have a modern enough Node (>= 20)
  NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)
  if (( NODE_MAJOR < 20 )); then
    # Try loading nvm
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
    if command -v nvm &>/dev/null; then
      nvm use 20 2>/dev/null || nvm install 20
    else
      error "Node.js >= 20 is required. Found: $(node --version 2>/dev/null || echo 'none')"
      exit 1
    fi
  fi

  pushd "$ROOT_DIR/frontend" > /dev/null
  npm ci --prefer-offline 2>/dev/null || npm install
  npm run build
  popd > /dev/null
else
  info "Frontend already built (set REBUILD_FRONTEND=1 to force)"
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
