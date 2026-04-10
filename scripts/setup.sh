#!/usr/bin/env bash
#
# Journey Tracker — one-time server setup
#
# Run as root (or with sudo) on a fresh server after cloning the repo.
#
# Usage:
#   sudo ./scripts/setup.sh
#
set -euo pipefail

INSTALL_DIR="/opt/journey-tracker"
SERVICE_USER="journey"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }
error() { echo -e "${RED}[setup]${NC} $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (use sudo)"
  exit 1
fi

# ---------- 1. system packages ----------
info "Installing system dependencies..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq
  apt-get install -y -qq python3 python3-venv python3-pip postgresql nodejs npm curl
elif command -v dnf &>/dev/null; then
  dnf install -y -q python3 python3-pip postgresql-server nodejs npm curl
elif command -v brew &>/dev/null; then
  warn "macOS detected — assuming Homebrew deps are already installed"
else
  warn "Unknown package manager — please ensure python3, node >= 20, and postgresql are installed"
fi

# ---------- 2. service user ----------
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Creating service user: $SERVICE_USER"
  useradd --system --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" "$SERVICE_USER"
fi

# ---------- 3. install to /opt ----------
if [[ "$REPO_DIR" != "$INSTALL_DIR" ]]; then
  info "Copying project to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
  rsync -a --exclude='node_modules' --exclude='.venv' --exclude='frontend/dist' \
    "$REPO_DIR/" "$INSTALL_DIR/"
fi

# ---------- 4. .env file ----------
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  if [[ -f "$INSTALL_DIR/.env.example" ]]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    warn "Created .env from .env.example — please edit $INSTALL_DIR/.env with real values"
  else
    cat > "$INSTALL_DIR/.env" <<'ENVEOF'
DATABASE_URL=postgresql+asyncpg://localhost:5432/journey_tracker
MAPBOX_TOKEN=
UPLOAD_DIR=/opt/journey-tracker/backend/uploads
ALLOWED_ORIGINS=["*"]
ENVEOF
    warn "Created default .env — please edit $INSTALL_DIR/.env with real values"
  fi
fi

# ---------- 5. database ----------
if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw journey_tracker; then
  info "Database 'journey_tracker' already exists"
else
  info "Creating database 'journey_tracker'..."
  sudo -u postgres createdb journey_tracker 2>/dev/null || warn "Could not auto-create DB — create it manually"
fi

# ---------- 6. uploads dir ----------
mkdir -p "$INSTALL_DIR/backend/uploads"

# ---------- 7. python venv ----------
if [[ ! -d "$INSTALL_DIR/backend/.venv" ]]; then
  info "Creating Python virtual environment..."
  python3 -m venv "$INSTALL_DIR/backend/.venv"
fi
info "Installing Python dependencies..."
"$INSTALL_DIR/backend/.venv/bin/pip" install -q -r "$INSTALL_DIR/backend/requirements.txt"

# ---------- 8. frontend build ----------
if [[ ! -d "$INSTALL_DIR/frontend/dist" ]] || [[ "${REBUILD_FRONTEND:-0}" == "1" ]]; then
  info "Building frontend..."
  NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)
  if (( NODE_MAJOR < 20 )); then
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
  pushd "$INSTALL_DIR/frontend" > /dev/null
  npm ci
  npm run build
  popd > /dev/null
else
  info "Frontend already built (set REBUILD_FRONTEND=1 to force rebuild)"
fi

# ---------- 9. permissions ----------
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/scripts/start.sh"

# ---------- 10. install systemd service ----------
info "Installing systemd service..."
cp "$INSTALL_DIR/scripts/journey-tracker.service" /etc/systemd/system/journey-tracker.service
systemctl daemon-reload
systemctl enable journey-tracker.service

info ""
info "Setup complete! Next steps:"
info "  1. Edit $INSTALL_DIR/.env with your database credentials"
info "  2. Start the service:  sudo systemctl start journey-tracker"
info "  3. Check status:       sudo systemctl status journey-tracker"
info "  4. View logs:          sudo journalctl -u journey-tracker -f"
info ""
