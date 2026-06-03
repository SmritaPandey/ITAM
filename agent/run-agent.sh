#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — Mac/Linux Launcher (Zero-Dependency Wizard Mode)
# ═══════════════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      QS Discovery Agent — Mac/Linux Launcher         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 🔐 Check for privileges to run deep scan commands
if [ "$EUID" -ne 0 ]; then
  echo "🔒 QS Discovery Agent works best with administrative permissions to retrieve deep telemetry"
  echo "   (like pending software updates, complete listening ports, and hardware serials)."
  read -p "🚀 Do you want to run the agent with administrator (sudo) privileges? (y/n): " Elevate
  if [[ "$Elevate" =~ ^[Yy]$ ]]; then
    exec sudo "$0" "$@"
  fi
  echo "⚠️  Running without root privileges. Some telemetry collections (like system updates) will be skipped."
  echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 🍏 macOS Gatekeeper Auto-Bypass: Strip quarantine flags recursively so non-technical users can launch without alerts
if [ "$(uname -s)" = "Darwin" ]; then
  xattr -dr com.apple.quarantine "$SCRIPT_DIR" 2>/dev/null || true
fi

# Function to ensure Node.js is present (system-wide or portable local)
ensure_node() {
  if command -v node &>/dev/null; then
    NODE_BIN="node"
    return 0
  fi

  NODE_DIR="$SCRIPT_DIR/.node"
  if [ -x "$NODE_DIR/bin/node" ]; then
    NODE_BIN="$NODE_DIR/bin/node"
    return 0
  fi

  echo "⚙️  Node.js runtime not found on this system."
  echo "🚀 Setting up a lightweight, portable Node.js environment automatically..."
  echo ""

  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  
  case "$OS" in
    darwin)
      if [ "$ARCH" = "arm64" ]; then
        URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-arm64.tar.gz"
      else
        URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-x64.tar.gz"
      fi
      ;;
    linux)
      if [ "$ARCH" = "x86_64" ]; then
        URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.gz"
      elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-arm64.tar.gz"
      else
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
      fi
      ;;
    *)
      echo "❌ Unsupported operating system: $OS"
      exit 1
      ;;
  esac

  TEMP_TAR="$SCRIPT_DIR/node_temp.tar.gz"
  TEMP_DIR="$SCRIPT_DIR/node_temp_dir"

  echo "📥 Downloading portable Node.js binary from official mirrors..."
  if command -v curl &>/dev/null; then
    curl -L -s "$URL" -o "$TEMP_TAR"
  elif command -v wget &>/dev/null; then
    wget -qO "$TEMP_TAR" "$URL"
  else
    echo "❌ Neither curl nor wget found. Please install curl or wget first."
    exit 1
  fi

  if [ ! -f "$TEMP_TAR" ]; then
    echo "❌ Download failed. Please check your internet connection."
    exit 1
  fi

  echo "📦 Extracting Node.js package..."
  mkdir -p "$TEMP_DIR"
  tar -xzf "$TEMP_TAR" -C "$TEMP_DIR" --strip-components=1

  mkdir -p "$NODE_DIR"
  mv "$TEMP_DIR"/* "$NODE_DIR"/ 2>/dev/null || mv "$TEMP_DIR"/{*,.*} "$NODE_DIR"/ 2>/dev/null

  # Cleanup
  rm -f "$TEMP_TAR"
  rm -rf "$TEMP_DIR"

  if [ -x "$NODE_DIR/bin/node" ]; then
    echo "✅ Lightweight Node.js runtime sandboxed inside ./.node/"
    NODE_BIN="$NODE_DIR/bin/node"
    echo ""
    return 0
  else
    echo "❌ Extraction failed or binary not executable."
    exit 1
  fi
}

# Ensure Node.js runtime is available
ensure_node

if [ -f "$SCRIPT_DIR/config.json" ]; then
  echo "🚀 Launching pre-configured QS Discovery Agent..."
  echo ""
  "$NODE_BIN" "$SCRIPT_DIR/qs-discovery-agent.js"
  exit $?
fi

SERVER_IP="${1:-$QS_AGENT_SERVER_IP}"
USER_EMAIL="${2:-$QS_AGENT_USER}"
USER_PASS="${3:-$QS_AGENT_PASS}"

if [ -z "$SERVER_IP" ]; then
  read -p "Enter QS Discovery server IP (e.g., 192.168.1.50): " SERVER_IP
fi
if [ -z "$USER_EMAIL" ]; then
  read -p "Enter your email: " USER_EMAIL
fi
if [ -z "$USER_PASS" ]; then
  read -sp "Enter your password: " USER_PASS
  echo ""
fi

echo "✅ Node.js $("$NODE_BIN" --version)"
echo ""
echo "🚀 Starting QS Discovery Agent..."
echo "   Server: http://$SERVER_IP:4100"
echo "   User:   $USER_EMAIL"
echo ""

"$NODE_BIN" "$SCRIPT_DIR/qs-discovery-agent.js" --server "http://$SERVER_IP:4100" --user "$USER_EMAIL" --pass "$USER_PASS"
