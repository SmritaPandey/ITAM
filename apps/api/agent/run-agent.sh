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
echo "  ║     QS Discovery Agent  v1.1.0               ║"
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
install_service() {
  if [ "$(uname -s)" = "Darwin" ]; then
    PLIST_PATH="/Library/LaunchDaemons/com.qsasset.discovery.agent.plist"
    if [ ! -f "$PLIST_PATH" ] && [ "$EUID" -eq 0 ]; then
      cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.qsasset.discovery.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${SCRIPT_DIR}/qs-discovery-agent.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/agent-service.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/agent-service-error.log</string>
    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>
</dict>
</plist>
EOF
      chown root:wheel "$PLIST_PATH"
      chmod 644 "$PLIST_PATH"
      launchctl unload "$PLIST_PATH" 2>/dev/null || true
      launchctl load "$PLIST_PATH"
      echo "  ✅ Installed as background service (starts on boot)"
    fi
  elif [ "$(uname -s)" = "Linux" ]; then
    SERVICE_PATH="/etc/systemd/system/qsasset-agent.service"
    if [ ! -f "$SERVICE_PATH" ] && [ "$EUID" -eq 0 ]; then
      cat <<EOF > "$SERVICE_PATH"
[Unit]
Description=QS Asset Discovery Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${NODE_BIN} ${SCRIPT_DIR}/qs-discovery-agent.js
Restart=always
RestartSec=10
StandardOutput=append:${SCRIPT_DIR}/agent-service.log
StandardError=append:${SCRIPT_DIR}/agent-service-error.log

[Install]
WantedBy=multi-user.target
EOF
      systemctl daemon-reload
      systemctl enable qsasset-agent
      systemctl start qsasset-agent
      echo "  ✅ Installed as background service (starts on boot)"
    fi
  fi
}

# Silently install service if running as root
install_service 2>/dev/null

# ─── Launch the agent ────────────────────────────────────────
echo "  🚀 Starting agent..."
echo ""
"$NODE_BIN" "$SCRIPT_DIR/qs-discovery-agent.js"
