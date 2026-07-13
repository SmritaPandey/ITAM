#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — Background Service Installer
# ═══════════════════════════════════════════════════════════════
# Installs the agent as a persistent boot-level service.
#   macOS  → LaunchDaemon (com.qs.discovery-agent)
#   Linux  → systemd (qs-discovery-agent.service)
# Requires root/sudo.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "  Administrator permissions required."
  echo "  Run with: sudo ./install-service.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_PATH="${SCRIPT_DIR}/qs-discovery-agent.js"
OS_TYPE="$(uname -s | tr '[:upper:]' '[:lower:]')"
PACKAGING_DIR="${SCRIPT_DIR}/packaging"

if [ ! -f "${AGENT_PATH}" ]; then
  echo "  ERROR: qs-discovery-agent.js not found in ${SCRIPT_DIR}"
  exit 1
fi

# Find Node.js (system or portable next to agent)
if command -v node &>/dev/null; then
  NODE_BIN="$(command -v node)"
elif [ -x "${SCRIPT_DIR}/.node/bin/node" ]; then
  NODE_BIN="${SCRIPT_DIR}/.node/bin/node"
elif [ -x "${SCRIPT_DIR}/.node/node" ]; then
  NODE_BIN="${SCRIPT_DIR}/.node/node"
else
  echo "  Node.js not found. Run './run-agent.sh' first to set up the runtime,"
  echo "  or install Node.js 18+ system-wide."
  exit 1
fi

resolve_node_abs() {
  # Prefer absolute path for LaunchDaemon / systemd
  if [ -x "$1" ] && [[ "$1" = /* ]]; then
    echo "$1"
  else
    command -v "$1" 2>/dev/null || echo "$1"
  fi
}
NODE_BIN="$(resolve_node_abs "${NODE_BIN}")"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     Installing Background Service            ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
echo "  Node : ${NODE_BIN}"
echo "  Agent: ${AGENT_PATH}"
echo ""

if [ "$OS_TYPE" = "darwin" ]; then
  # Prefer packaged install layout when present / requested
  SUPPORT_DIR="/Library/Application Support/QS-Discovery-Agent"
  LOG_DIR="/Library/Logs/QS-Discovery-Agent"
  PLIST_LABEL="com.qs.discovery-agent"
  PLIST_PATH="/Library/LaunchDaemons/${PLIST_LABEL}.plist"
  TEMPLATE="${PACKAGING_DIR}/macos/com.qs.discovery-agent.plist"
  LEGACY_PLIST="/Library/LaunchDaemons/com.qsasset.discovery.agent.plist"

  # If we are not already under Application Support, offer to stage there
  INSTALL_ROOT="${SCRIPT_DIR}"
  if [[ "${SCRIPT_DIR}" != "${SUPPORT_DIR}"* ]]; then
    mkdir -p "${SUPPORT_DIR}"
    cp -f "${AGENT_PATH}" "${SUPPORT_DIR}/qs-discovery-agent.js"
    [ -f "${SCRIPT_DIR}/config.json" ] && cp -f "${SCRIPT_DIR}/config.json" "${SUPPORT_DIR}/config.json"
    [ -f "${SCRIPT_DIR}/run-agent.sh" ] && cp -f "${SCRIPT_DIR}/run-agent.sh" "${SUPPORT_DIR}/" && chmod +x "${SUPPORT_DIR}/run-agent.sh"
    # Copy portable node if present
    if [ -d "${SCRIPT_DIR}/.node" ] && [ ! -d "${SUPPORT_DIR}/.node" ]; then
      cp -R "${SCRIPT_DIR}/.node" "${SUPPORT_DIR}/.node"
    fi
    INSTALL_ROOT="${SUPPORT_DIR}"
    AGENT_PATH="${SUPPORT_DIR}/qs-discovery-agent.js"
    if [ -x "${SUPPORT_DIR}/.node/bin/node" ]; then
      NODE_BIN="${SUPPORT_DIR}/.node/bin/node"
    fi
    echo "  Staged agent to: ${SUPPORT_DIR}"
  fi

  mkdir -p "${LOG_DIR}"
  chmod 755 "${LOG_DIR}"

  # Remove legacy LaunchDaemon if present
  if [ -f "${LEGACY_PLIST}" ]; then
    launchctl bootout system "${LEGACY_PLIST}" 2>/dev/null || launchctl unload "${LEGACY_PLIST}" 2>/dev/null || true
    rm -f "${LEGACY_PLIST}"
    echo "  Removed legacy LaunchDaemon com.qsasset.discovery.agent"
  fi

  if [ -f "${TEMPLATE}" ]; then
    cp "${TEMPLATE}" "${PLIST_PATH}"
    if [ -x /usr/libexec/PlistBuddy ]; then
      /usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 ${NODE_BIN}" "${PLIST_PATH}"
      /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 ${AGENT_PATH}" "${PLIST_PATH}"
      /usr/libexec/PlistBuddy -c "Set :WorkingDirectory ${INSTALL_ROOT}" "${PLIST_PATH}"
      /usr/libexec/PlistBuddy -c "Set :StandardOutPath ${LOG_DIR}/agent-service.log" "${PLIST_PATH}" 2>/dev/null || true
      /usr/libexec/PlistBuddy -c "Set :StandardErrorPath ${LOG_DIR}/agent-service-error.log" "${PLIST_PATH}" 2>/dev/null || true
    fi
  else
    cat <<EOF > "${PLIST_PATH}"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${AGENT_PATH}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/agent-service.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/agent-service-error.log</string>
    <key>WorkingDirectory</key>
    <string>${INSTALL_ROOT}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>QS_AGENT_SILENT</key>
        <string>true</string>
    </dict>
</dict>
</plist>
EOF
  fi

  chown root:wheel "${PLIST_PATH}"
  chmod 644 "${PLIST_PATH}"

  # Prefer modern bootstrap; fall back to load
  if launchctl print "system/${PLIST_LABEL}" >/dev/null 2>&1; then
    launchctl bootout system/"${PLIST_LABEL}" 2>/dev/null || launchctl unload "${PLIST_PATH}" 2>/dev/null || true
  fi
  if launchctl help 2>&1 | grep -q bootstrap; then
    launchctl bootstrap system "${PLIST_PATH}" 2>/dev/null || launchctl load -w "${PLIST_PATH}"
    launchctl enable "system/${PLIST_LABEL}" 2>/dev/null || true
    launchctl kickstart -k "system/${PLIST_LABEL}" 2>/dev/null || true
  else
    launchctl unload "${PLIST_PATH}" 2>/dev/null || true
    launchctl load -w "${PLIST_PATH}"
  fi

  echo "  Background LaunchDaemon installed and started."
  echo "  Label: ${PLIST_LABEL}"
  echo "  Agent runs at boot (KeepAlive)."
  echo "  Logs: ${LOG_DIR}/agent-service.log"

elif [ "$OS_TYPE" = "linux" ]; then
  INSTALL_ROOT="/opt/qs-discovery-agent"
  SERVICE_NAME="qs-discovery-agent"
  SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
  UNIT_TEMPLATE="${PACKAGING_DIR}/linux/qs-discovery-agent.service"
  LEGACY_SERVICE="/etc/systemd/system/qsasset-agent.service"
  LOG_DIR="/var/log/qs-discovery-agent"

  mkdir -p "${INSTALL_ROOT}" "${LOG_DIR}"
  cp -f "${AGENT_PATH}" "${INSTALL_ROOT}/qs-discovery-agent.js"
  [ -f "${SCRIPT_DIR}/config.json" ] && cp -f "${SCRIPT_DIR}/config.json" "${INSTALL_ROOT}/config.json"
  [ -f "${SCRIPT_DIR}/run-agent.sh" ] && cp -f "${SCRIPT_DIR}/run-agent.sh" "${INSTALL_ROOT}/" && chmod +x "${INSTALL_ROOT}/run-agent.sh"
  if [ -d "${SCRIPT_DIR}/.node" ] && [ ! -d "${INSTALL_ROOT}/.node" ]; then
    cp -R "${SCRIPT_DIR}/.node" "${INSTALL_ROOT}/.node"
  fi
  if [ -x "${INSTALL_ROOT}/.node/bin/node" ]; then
    NODE_BIN="${INSTALL_ROOT}/.node/bin/node"
  fi

  cat > "${INSTALL_ROOT}/run-agent-service.sh" << EOF
#!/bin/bash
set -e
cd "${INSTALL_ROOT}"
NODE_BIN="${NODE_BIN}"
if [ ! -x "\$NODE_BIN" ]; then
  if command -v node >/dev/null 2>&1; then NODE_BIN="\$(command -v node)"; fi
fi
if [ ! -x "\$NODE_BIN" ] && [ -x "${INSTALL_ROOT}/.node/bin/node" ]; then
  NODE_BIN="${INSTALL_ROOT}/.node/bin/node"
fi
exec "\$NODE_BIN" "${INSTALL_ROOT}/qs-discovery-agent.js"
EOF
  chmod +x "${INSTALL_ROOT}/run-agent-service.sh"

  # Disable legacy unit if present
  if [ -f "${LEGACY_SERVICE}" ]; then
    systemctl stop qsasset-agent 2>/dev/null || true
    systemctl disable qsasset-agent 2>/dev/null || true
    rm -f "${LEGACY_SERVICE}"
    echo "  Removed legacy unit qsasset-agent.service"
  fi

  if [ -f "${UNIT_TEMPLATE}" ]; then
    cp "${UNIT_TEMPLATE}" "${SERVICE_PATH}"
  else
    cat <<EOF > "${SERVICE_PATH}"
[Unit]
Description=QS Discovery Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_ROOT}
ExecStart=${INSTALL_ROOT}/run-agent-service.sh
Restart=always
RestartSec=10
StandardOutput=append:${LOG_DIR}/agent-service.log
StandardError=append:${LOG_DIR}/agent-service-error.log
Environment=QS_AGENT_SILENT=true

[Install]
WantedBy=multi-user.target
EOF
  fi

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}" || systemctl start "${SERVICE_NAME}" || true

  echo "  systemd service installed and started."
  echo "  Unit: ${SERVICE_NAME}.service"
  echo "  Install root: ${INSTALL_ROOT}"
  echo "  Logs: ${LOG_DIR}/agent-service.log"
else
  echo "  Unsupported operating system: ${OS_TYPE}"
  exit 1
fi
