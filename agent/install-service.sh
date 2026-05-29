#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — Persistent Background Service Installer
# ═══════════════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_PATH="${SCRIPT_DIR}/qs-discovery-agent.js"
OS_TYPE="$(uname -s | tr '[:upper:]' '[:lower:]')"

echo "⚙️  Installing QS Discovery Agent as a persistent background service..."
echo ""

# Find active node binary path
if command -v node &>/dev/null; then
  NODE_BIN="$(command -v node)"
else
  NODE_BIN="${SCRIPT_DIR}/.node/bin/node"
fi

if [ ! -f "$NODE_BIN" ]; then
  echo "⚙️  Initializing runtime environment first..."
  # Run launcher in background just to let it bootstrap Node if missing
  chmod +x "${SCRIPT_DIR}/run-agent.sh"
  NODE_BIN="${SCRIPT_DIR}/.node/bin/node"
fi

if [ "$OS_TYPE" = "darwin" ]; then
  # 🍏 macOS LaunchAgent installation
  PLIST_DIR="${HOME}/Library/LaunchAgents"
  PLIST_PATH="${PLIST_DIR}/com.qsasset.discovery.agent.plist"
  
  mkdir -p "${PLIST_DIR}"
  
  echo "🍏 Generating macOS LaunchAgent plist at ${PLIST_PATH}..."
  
  cat <<EOF > "${PLIST_PATH}"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.qsasset.discovery.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${AGENT_PATH}</string>
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

  echo "🚀 Loading and starting LaunchAgent..."
  # Unload first if already loaded
  launchctl unload "${PLIST_PATH}" 2>/dev/null || true
  launchctl load "${PLIST_PATH}"
  
  echo "✅ LaunchAgent installed and loaded successfully!"
  echo "📡 The agent will run silently in the background and start automatically on login."
  echo "📂 Service logs are located at: ${SCRIPT_DIR}/agent-service.log"

elif [ "$OS_TYPE" = "linux" ]; then
  # 🐧 Linux systemd installation
  SERVICE_PATH="/etc/systemd/system/qsasset-agent.service"
  
  echo "🐧 Installing systemd service daemon (requires sudo permissions)..."
  
  sudo bash -c "cat <<EOF > ${SERVICE_PATH}
[Unit]
Description=QS Asset Discovery & Telemetry Agent
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${NODE_BIN} ${AGENT_PATH}
Restart=always
RestartSec=10
StandardOutput=append:${SCRIPT_DIR}/agent-service.log
StandardError=append:${SCRIPT_DIR}/agent-service-error.log

[Install]
WantedBy=multi-user.target
EOF"

  echo "🚀 Enabling and starting systemd service..."
  sudo systemctl daemon-reload
  sudo systemctl enable qsasset-agent
  sudo systemctl start qsasset-agent
  
  echo "✅ systemd service installed and started successfully!"
  echo "📡 The agent will run in the background and start automatically on boot."
  echo "📂 Service logs are located at: ${SCRIPT_DIR}/agent-service.log"
else
  echo "❌ Unsupported operating system: ${OS_TYPE}"
  exit 1
fi
