#!/usr/bin/env bash
# QS Assets — Linux appliance installer
#
# Installs the QS Assets stack (Postgres + Redis + API + Web + Caddy TLS)
# as a systemd-managed docker compose application.
#
#   sudo ./qsassets-install.sh \
#     --owner-email owner@example.com \
#     --owner-password 'S3cure!OwnerPass' \
#     --admin-password 'S3cure!AdminPass' \
#     --server-ip 192.168.1.50 \
#     --yes
#
# Layout after install:
#   /opt/qsassets/                  compose file, Caddyfile, qsassets CLI
#   /etc/qsassets/qsassets.env      generated secrets (root:root 600)
#   /etc/systemd/system/qsassets.service
#
# Works from either the release bundle (flat layout) or a repo checkout
# (installer/ subdirectory layout).

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants & defaults
# ---------------------------------------------------------------------------
INSTALL_DIR="/opt/qsassets"
ENV_DIR="/etc/qsassets"
ENV_FILE="${ENV_DIR}/qsassets.env"
UNIT_DST="/etc/systemd/system/qsassets.service"
COMPOSE_FILE="${INSTALL_DIR}/docker-compose.appliance.yml"
MIN_RAM_GB=4
MIN_DISK_GB=20
HEALTH_TIMEOUT_S=300

OWNER_EMAIL=""
OWNER_PASSWORD=""
ADMIN_PASSWORD=""
SERVER_IP=""
ASSUME_YES=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '\033[1;32m[qsassets]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[qsassets] WARN:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[qsassets] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  cat <<EOF
Flags:
  --owner-email EMAIL       Platform owner login email (default: owner@localhost)
  --owner-password PASS     Platform owner password (min 12 chars; generated if omitted)
  --admin-password PASS     Tenant admin password (min 12 chars; generated if omitted)
  --server-ip IP            LAN IP/hostname of this appliance (autodetected if omitted)
  --yes, -y                 Non-interactive; accept warnings and proceed
  --help, -h                Show this help
EOF
  exit "${1:-0}"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --owner-email)    OWNER_EMAIL="${2:?--owner-email requires a value}"; shift 2 ;;
    --owner-password) OWNER_PASSWORD="${2:?--owner-password requires a value}"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="${2:?--admin-password requires a value}"; shift 2 ;;
    --server-ip)      SERVER_IP="${2:?--server-ip requires a value}"; shift 2 ;;
    --yes|-y)         ASSUME_YES=1; shift ;;
    --help|-h)        usage 0 ;;
    *)                warn "Unknown flag: $1"; usage 1 ;;
  esac
done

confirm() {
  # confirm "question" — returns 0 on yes (always yes with --yes)
  [ "$ASSUME_YES" = "1" ] && return 0
  local reply
  read -r -p "$1 [y/N] " reply
  case "$reply" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "This installer must run as root (use sudo)."
[ "$(uname -s)" = "Linux" ] || die "The appliance installer supports Linux only."

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64|aarch64|arm64) log "Architecture: $ARCH" ;;
  *) die "Unsupported architecture: $ARCH (need x86_64 or aarch64)" ;;
esac

command -v docker >/dev/null 2>&1 \
  || die "Docker is not installed. Install it first: https://docs.docker.com/engine/install/"
docker info >/dev/null 2>&1 \
  || die "Docker daemon is not running or not reachable (is the service started?)."
docker compose version >/dev/null 2>&1 \
  || die "The 'docker compose' plugin (v2) is required. Install docker-compose-plugin."
command -v openssl >/dev/null 2>&1 \
  || die "openssl is required to generate secrets."
command -v systemctl >/dev/null 2>&1 \
  || die "systemd (systemctl) is required."

# RAM check (warn only)
TOTAL_RAM_KB="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
TOTAL_RAM_GB=$(( TOTAL_RAM_KB / 1024 / 1024 ))
if [ "$TOTAL_RAM_GB" -lt "$MIN_RAM_GB" ]; then
  warn "Only ${TOTAL_RAM_GB} GB RAM detected; ${MIN_RAM_GB} GB or more is recommended."
  confirm "Continue anyway?" || die "Aborted by user."
else
  log "Memory: ${TOTAL_RAM_GB} GB"
fi

# Disk check on the filesystem backing /opt (warn only)
AVAIL_DISK_GB="$(df -BG --output=avail /opt 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)"
if [ "${AVAIL_DISK_GB:-0}" -lt "$MIN_DISK_GB" ]; then
  warn "Only ${AVAIL_DISK_GB} GB free on /opt; ${MIN_DISK_GB} GB or more is recommended."
  confirm "Continue anyway?" || die "Aborted by user."
else
  log "Disk: ${AVAIL_DISK_GB} GB free on /opt"
fi

# ---------------------------------------------------------------------------
# Locate bundle files (release bundle flat layout OR repo installer/ layout)
# ---------------------------------------------------------------------------
find_file() {
  # find_file <relative candidates...> — echoes first existing path
  local c
  for c in "$@"; do
    if [ -f "${SCRIPT_DIR}/${c}" ]; then echo "${SCRIPT_DIR}/${c}"; return 0; fi
  done
  return 1
}

SRC_COMPOSE="$(find_file docker-compose.appliance.yml bundle/docker-compose.appliance.yml)" \
  || die "docker-compose.appliance.yml not found next to the installer."
SRC_CADDY="$(find_file Caddyfile caddy/Caddyfile)" \
  || die "Caddyfile not found next to the installer."
SRC_UNIT="$(find_file qsassets.service systemd/qsassets.service)" \
  || die "qsassets.service not found next to the installer."
SRC_CLI="$(find_file qsassets)" || true
SRC_INITSQL="$(find_file init-extensions.sql ../infra/docker/init-extensions.sql)" || true

# ---------------------------------------------------------------------------
# Detect server IP
# ---------------------------------------------------------------------------
if [ -z "$SERVER_IP" ]; then
  SERVER_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
  [ -n "$SERVER_IP" ] || SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  [ -n "$SERVER_IP" ] || die "Could not autodetect the server IP; pass --server-ip."
  log "Autodetected server IP: ${SERVER_IP}"
fi

# ---------------------------------------------------------------------------
# Generate /etc/qsassets/qsassets.env (secrets never touch the repo/bundle)
# ---------------------------------------------------------------------------
gen_secret() { openssl rand -hex 32; }           # 64 hex chars
gen_password() {                                  # URL/shell-safe 20 chars
  openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20
}

if [ -f "$ENV_FILE" ]; then
  warn "${ENV_FILE} already exists — keeping existing secrets (delete it to regenerate)."
else
  log "Generating ${ENV_FILE} ..."
  mkdir -p "$ENV_DIR"

  DB_PASSWORD="$(gen_password)"
  JWT_SECRET="$(gen_secret)"
  JWT_REFRESH_SECRET="$(gen_secret)"
  VAULT_ENCRYPTION_KEY="$(gen_secret)"
  OWNER_EMAIL="${OWNER_EMAIL:-owner@localhost}"

  GENERATED_CREDS=""
  if [ -z "$OWNER_PASSWORD" ]; then
    OWNER_PASSWORD="$(gen_password)"
    GENERATED_CREDS="${GENERATED_CREDS}  Owner password:  ${OWNER_PASSWORD}\n"
  fi
  if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD="$(gen_password)"
    GENERATED_CREDS="${GENERATED_CREDS}  Admin password:  ${ADMIN_PASSWORD}\n"
  fi
  [ "${#OWNER_PASSWORD}" -ge 12 ] || die "--owner-password must be at least 12 characters."
  [ "${#ADMIN_PASSWORD}" -ge 12 ] || die "--admin-password must be at least 12 characters."

  umask 077
  cat > "$ENV_FILE" <<EOF
# QS Assets appliance environment — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Owner: root, mode 600. Back this file up: it holds the DB password and the
# vault encryption key. Losing VAULT_ENCRYPTION_KEY makes stored credentials
# unrecoverable.

# --- Core ---
DEPLOYMENT_MODE=onprem
NODE_ENV=production
SERVER_IP=${SERVER_IP}
QSASSETS_VERSION=latest

# --- Database / cache (compose-internal hostnames) ---
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/assetcommand?connection_limit=20&statement_timeout=30000
REDIS_URL=redis://redis:6379

# --- Secrets ---
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
VAULT_ENCRYPTION_KEY=${VAULT_ENCRYPTION_KEY}
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# --- Bootstrap accounts ---
OWNER_EMAIL=${OWNER_EMAIL}
OWNER_PASSWORD=${OWNER_PASSWORD}
TENANT_ADMIN_EMAIL=admin@localhost
TENANT_ADMIN_PASSWORD=${ADMIN_PASSWORD}
ONPREM_ORG_NAME=Enterprise Organization

# --- Web / proxy ---
# Browser calls the API same-origin through Caddy.
NEXT_PUBLIC_API_URL=/api/v1
CORS_ORIGIN=https://${SERVER_IP},https://localhost
# Set to a DNS name (e.g. assets.example.com) for Let's Encrypt via Caddy.
QSASSETS_SITE_ADDRESS=:443

# --- Behaviour ---
DISABLE_PUBLIC_SIGNUP=true
SEED_DB=false
PROCESS_ROLE=all

# --- Licensing (fill in from your NeurQ entitlement) ---
LICENSE_PUBLIC_KEY=
LICENSE_SERVER_URL=
EOF
  chmod 600 "$ENV_FILE"
  log "Wrote ${ENV_FILE} (mode 600)."
fi

# ---------------------------------------------------------------------------
# Install files to /opt/qsassets
# ---------------------------------------------------------------------------
log "Installing files to ${INSTALL_DIR} ..."
mkdir -p "$INSTALL_DIR"
install -m 644 "$SRC_COMPOSE" "$COMPOSE_FILE"
install -m 644 "$SRC_CADDY"   "${INSTALL_DIR}/Caddyfile"
if [ -n "${SRC_INITSQL:-}" ]; then
  install -m 644 "$SRC_INITSQL" "${INSTALL_DIR}/init-extensions.sql"
else
  # Minimal fallback so the compose bind-mount always resolves.
  cat > "${INSTALL_DIR}/init-extensions.sql" <<'SQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
SQL
fi
if [ -n "${SRC_CLI:-}" ]; then
  install -m 755 "$SRC_CLI" "${INSTALL_DIR}/qsassets"
  ln -sf "${INSTALL_DIR}/qsassets" /usr/local/bin/qsassets
  log "Installed 'qsassets' CLI (/usr/local/bin/qsassets)."
fi

# Preload container images if the bundle ships them (offline install).
if [ -d "${SCRIPT_DIR}/images" ]; then
  for img in "${SCRIPT_DIR}/images"/*.tar "${SCRIPT_DIR}/images"/*.tar.gz "${SCRIPT_DIR}/images"/*.tar.zst; do
    [ -e "$img" ] || continue
    log "Loading container image $(basename "$img") ..."
    case "$img" in
      *.tar.zst) zstd -dc "$img" | docker load ;;
      *.tar.gz)  gzip -dc "$img" | docker load ;;
      *)         docker load -i "$img" ;;
    esac
  done
fi

# ---------------------------------------------------------------------------
# systemd unit
# ---------------------------------------------------------------------------
log "Installing systemd unit ..."
install -m 644 "$SRC_UNIT" "$UNIT_DST"
systemctl daemon-reload
systemctl enable qsassets.service >/dev/null

# ---------------------------------------------------------------------------
# Start the stack
# ---------------------------------------------------------------------------
compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

log "Starting QS Assets (docker compose up -d) ..."
if ! compose up -d --no-build 2>/dev/null; then
  warn "Images not preloaded — building from source contexts (this can take a while)."
  compose up -d --build
fi

# ---------------------------------------------------------------------------
# Wait for API health
# ---------------------------------------------------------------------------
log "Waiting for the API to become healthy (up to ${HEALTH_TIMEOUT_S}s) ..."
deadline=$(( $(date +%s) + HEALTH_TIMEOUT_S ))
healthy=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' qsassets-api 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then healthy=1; break; fi
  if curl -fsSk "https://127.0.0.1/api/v1/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 5
done

if [ "$healthy" -ne 1 ]; then
  warn "API did not report healthy within ${HEALTH_TIMEOUT_S}s."
  warn "Inspect with: qsassets status && qsassets logs api"
  compose ps || true
  exit 1
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
log "QS Assets appliance is up."
echo
echo "=============================================================="
echo "  URL:            https://${SERVER_IP}/"
echo "  Owner login:    ${OWNER_EMAIL:-owner@localhost} (see ${ENV_FILE})"
echo "  Tenant admin:   admin@localhost (see ${ENV_FILE})"
if [ -n "${GENERATED_CREDS:-}" ]; then
  echo "  Generated credentials (stored in ${ENV_FILE}):"
  printf "%b" "$GENERATED_CREDS"
fi
echo
echo "  TLS is self-signed by default; the browser will warn once."
echo "  See docs/APPLIANCE-INSTALL.md for real certificates."
echo
echo "  Manage with:    qsassets status|logs|backup|restore|upgrade|uninstall"
echo "=============================================================="
