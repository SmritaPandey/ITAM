#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Asset — One-Command LAN Deployment Script
# ═══════════════════════════════════════════════════════════════
set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         QS Asset — Local LAN Deployment                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── Detect server IP ────────────────────────────────────────
if [ -z "$SERVER_IP" ]; then
  if command -v ip &>/dev/null; then
    SERVER_IP=$(ip route get 1 | awk '{print $7; exit}')
  elif command -v ifconfig &>/dev/null; then
    SERVER_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
  fi
fi

if [ -z "$SERVER_IP" ]; then
  echo "❌ Could not auto-detect server IP."
  echo "   Run with: SERVER_IP=192.168.x.x ./deploy.sh"
  exit 1
fi

echo "🖥️  Server IP: $SERVER_IP"
echo ""

# ─── Check Docker ────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found. Install Docker first:"
  echo "   https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "❌ Docker Compose not found."
  exit 1
fi

echo "✅ Docker $(docker --version | cut -d' ' -f3)"
echo "✅ Docker Compose $(docker compose version --short)"
echo ""

# ─── Ask about seed ──────────────────────────────────────────
SEED_DB="${SEED_DB:-false}"
if [ "$1" = "--seed" ] || [ "$1" = "-s" ]; then
  SEED_DB="true"
fi

if [ "$SEED_DB" = "true" ]; then
  echo "🌱 Seed mode: ON (demo data will be loaded)"
else
  echo "📦 Seed mode: OFF (clean database)"
  echo "   Add --seed flag to load demo data"
fi
echo ""

# ─── Build & Deploy ──────────────────────────────────────────
echo "🔨 Building containers (this may take 3-5 minutes on first run)..."
echo ""

export SERVER_IP
export SEED_DB
export DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-onprem}"
export DISABLE_PUBLIC_SIGNUP="${DISABLE_PUBLIC_SIGNUP:-true}"

docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# ─── Health Checks ───────────────────────────────────────────
echo ""
echo "🔍 Running health checks..."

# Check postgres
if docker exec qsasset-db pg_isready -U postgres &>/dev/null; then
  echo "  ✅ PostgreSQL — running"
else
  echo "  ❌ PostgreSQL — not ready (check: docker logs qsasset-db)"
fi

# Check API
sleep 3
if curl -s --max-time 5 http://localhost:4100/api/v1/health &>/dev/null || curl -s --max-time 5 http://localhost:4100/api/v1 &>/dev/null; then
  echo "  ✅ API Server — running on :4100"
else
  echo "  ⏳ API Server — still starting (check: docker logs qsasset-api)"
fi

# Check Web
if curl -s --max-time 5 http://localhost:3100 &>/dev/null; then
  echo "  ✅ Web Frontend — running on :3100"
else
  echo "  ⏳ Web Frontend — still starting (check: docker logs qsasset-web)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 🚀 QS Asset is LIVE!                    ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                         ║"
echo "║  Dashboard:  http://$SERVER_IP:3100                     "
echo "║  API:        http://$SERVER_IP:4100/api/v1              "
echo "║  Database:   localhost:5434                              ║"
echo "║                                                         ║"
if [ "$SEED_DB" = "true" ]; then
echo "║  Login:      admin@acme.com / Admin@123                  ║"
else
echo "║  On-prem:    OWNER_EMAIL / TENANT_ADMIN_EMAIL from env   ║"
echo "║  License:    Settings → Product License (.lic or key)   ║"
fi
echo "║                                                         ║"
echo "║  To scan LAN:                                           ║"
echo "║  → Dashboard → Discovery → New Scan                     ║"
echo "║  → Enter subnet: ${SERVER_IP%.*}.0/24                   "
echo "║                                                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Useful commands:"
echo "   docker compose -f docker-compose.prod.yml logs -f api    # API logs"
echo "   docker compose -f docker-compose.prod.yml logs -f web    # Web logs"
echo "   docker compose -f docker-compose.prod.yml down           # Stop all"
echo "   docker compose -f docker-compose.prod.yml down -v        # Stop + wipe DB"
echo ""
