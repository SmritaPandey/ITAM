#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — Background Service Installer
# ═══════════════════════════════════════════════════════════════
# Installs the agent as a persistent background service.
# Requires root/sudo. Called automatically by run-agent.sh.
# ═══════════════════════════════════════════════════════════════
set -e

if [ "$EUID" -ne 0 ]; then
  echo "  🔐 Administrator permissions required."
  echo "  Run with: sudo ./install-service.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_PATH="${SCRIPT_DIR}/qs-discovery-agent.js"
OS_TYPE="$(uname -s | tr '[:upper:]' '[:lower:]')"

# Find Node.js
if command -v node &>/dev/null; then
  NODE_BIN="$(command -v node)"
elif [ -x "${SCRIPT_DIR}/.node/bin/node" ]; then
  NODE_BIN="${SCRIPT_DIR}/.node/bin/node"
else
  echo "  ❌ Node.js not found. Run './run-agent.sh' first to set up the runtime."
  exit 1
fi

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     Installing Background Service            ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

if [ "$OS_TYPE" = "darwin" ]; then
  PLIST_PATH="/Library/LaunchDaemons/com.qsasset.discovery.agent.plist"

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

  chown root:wheel "$PLIST_PATH"
  chmod 644 "$PLIST_PATH"
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  launchctl load "$PLIST_PATH"

  echo "  ✅ Background service installed and started!"
  echo "  📡 Agent runs silently and starts automatically on boot."
  echo "  📂 Logs: ${SCRIPT_DIR}/agent-service.log"

elif [ "$OS_TYPE" = "linux" ]; then
  SERVICE_PATH="/etc/systemd/system/qsasset-agent.service"

  cat <<EOF > "$SERVICE_PATH"
[Unit]
Description=QS Asset Discovery Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${NODE_BIN} ${AGENT_PATH}
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

  echo "  ✅ Background service installed and started!"
  echo "  📡 Agent runs silently and starts automatically on boot."
  echo "  📂 Logs: ${SCRIPT_DIR}/agent-service.log"
else
  echo "  ❌ Unsupported operating system: ${OS_TYPE}"
  exit 1
fi
