#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ReconAPM Agent — Mac/Linux Launcher
# ═══════════════════════════════════════════════════════════════
# Usage: ./run-agent.sh 192.168.1.50 staff@acme.com Staff@123

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         ReconAPM Agent — Mac/Linux Setup             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

SERVER_IP="${1:-$RECONAPM_SERVER_IP}"
USER_EMAIL="${2:-$RECONAPM_USER}"
USER_PASS="${3:-$RECONAPM_PASS}"

if [ -z "$SERVER_IP" ]; then
  read -p "Enter ReconAPM server IP (e.g., 192.168.1.50): " SERVER_IP
fi
if [ -z "$USER_EMAIL" ]; then
  read -p "Enter your email: " USER_EMAIL
fi
if [ -z "$USER_PASS" ]; then
  read -sp "Enter your password: " USER_PASS
  echo ""
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Install with: brew install node (macOS) or apt install nodejs (Linux)"
  exit 1
fi

echo "✅ Node.js $(node --version)"
echo ""
echo "🚀 Starting ReconAPM Agent..."
echo "   Server: http://$SERVER_IP:4100"
echo "   User:   $USER_EMAIL"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/reconapm-agent.js" --server "http://$SERVER_IP:4100" --user "$USER_EMAIL" --pass "$USER_PASS"
