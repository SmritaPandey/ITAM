#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — One-Click Launcher (Mac/Linux)
# ═══════════════════════════════════════════════════════════════
# Just double-click or run this script. No prompts, no questions.
# If config.json is missing, it tells you what to do.
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── macOS Gatekeeper bypass ────────────────────────────────
if [ "$(uname -s)" = "Darwin" ]; then
  xattr -dr com.apple.quarantine "$SCRIPT_DIR" 2>/dev/null || true
fi

# ─── Pretty banner ──────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     QS Discovery Agent  v2.0.0               ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ─── Check for config.json ──────────────────────────────────
if [ ! -f "$SCRIPT_DIR/config.json" ]; then
  echo "  ⚠️  No configuration found."
  echo ""
  echo "  To set up this agent:"
  echo "  ─────────────────────────────────────────────"
  echo "  1. Open 'setup.html' in your web browser"
  echo "  2. Enter your server address and credentials"
  echo "  3. Click 'Save Configuration'"
  echo "  4. Move the downloaded config.json here:"
  echo "     $SCRIPT_DIR/"
  echo "  5. Run this script again"
  echo ""
  
  # Try to open setup.html automatically
  if [ -f "$SCRIPT_DIR/setup.html" ]; then
    echo "  Opening setup wizard now..."
    if [ "$(uname -s)" = "Darwin" ]; then
      open "$SCRIPT_DIR/setup.html" 2>/dev/null
    elif command -v xdg-open &>/dev/null; then
      xdg-open "$SCRIPT_DIR/setup.html" 2>/dev/null
    fi
  fi
  exit 1
fi

# ─── Ensure Node.js is available ────────────────────────────
NODE_BIN=""

if command -v node &>/dev/null; then
  NODE_BIN="node"
elif [ -x "$SCRIPT_DIR/.node/bin/node" ]; then
  NODE_BIN="$SCRIPT_DIR/.node/bin/node"
else
  echo "  📦 Setting up runtime environment (one-time)..."
  
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  
  case "$OS" in
    darwin)
      [ "$ARCH" = "arm64" ] && URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-arm64.tar.gz" \
                             || URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-darwin-x64.tar.gz"
      ;;
    linux)
      if [ "$ARCH" = "x86_64" ]; then
        URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-x64.tar.gz"
      elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        URL="https://nodejs.org/dist/v20.11.1/node-v20.11.1-linux-arm64.tar.gz"
      else
        echo "  ❌ Unsupported system architecture: $ARCH"
        exit 1
      fi
      ;;
    *)
      echo "  ❌ Unsupported operating system: $OS"
      exit 1
      ;;
  esac

  TEMP_TAR="$SCRIPT_DIR/.node_temp.tar.gz"
  TEMP_DIR="$SCRIPT_DIR/.node_temp_dir"

  if command -v curl &>/dev/null; then
    curl -L -s --progress-bar "$URL" -o "$TEMP_TAR"
  elif command -v wget &>/dev/null; then
    wget -qO "$TEMP_TAR" "$URL"
  else
    echo "  ❌ Cannot download runtime. Please install curl or Node.js."
    exit 1
  fi

  mkdir -p "$TEMP_DIR"
  tar -xzf "$TEMP_TAR" -C "$TEMP_DIR" --strip-components=1
  mkdir -p "$SCRIPT_DIR/.node"
  mv "$TEMP_DIR"/* "$SCRIPT_DIR/.node/" 2>/dev/null
  rm -f "$TEMP_TAR"
  rm -rf "$TEMP_DIR"

  if [ -x "$SCRIPT_DIR/.node/bin/node" ]; then
    echo "  ✅ Runtime ready"
    NODE_BIN="$SCRIPT_DIR/.node/bin/node"
  else
    echo "  ❌ Runtime setup failed. Please install Node.js manually."
    exit 1
  fi
fi

# ─── Install as background service (silent, automatic) ──────
# Prefer packaging/install-service.sh (LaunchDaemon / systemd canonical paths)
if [ "${EUID:-$(id -u)}" -eq 0 ] && [ -x "${SCRIPT_DIR}/install-service.sh" ]; then
  if [ "$(uname -s)" = "Darwin" ] && [ ! -f /Library/LaunchDaemons/com.qs.discovery-agent.plist ]; then
    "${SCRIPT_DIR}/install-service.sh" 2>/dev/null && echo "  ✅ Installed as background service (starts on boot)" || true
  elif [ "$(uname -s)" = "Linux" ] && [ ! -f /etc/systemd/system/qs-discovery-agent.service ]; then
    "${SCRIPT_DIR}/install-service.sh" 2>/dev/null && echo "  ✅ Installed as background service (starts on boot)" || true
  fi
fi

# ─── Launch the agent ────────────────────────────────────────
echo "  🚀 Starting agent..."
echo ""
"$NODE_BIN" "$SCRIPT_DIR/qs-discovery-agent.js"
