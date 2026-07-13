#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — macOS .pkg builder (pkgbuild)
# Stages to /Library/Application Support/QS-Discovery-Agent
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION="${QS_AGENT_VERSION:-2.0.0}"
IDENTIFIER="com.qs.discovery-agent"
PKG_NAME="QS-Discovery-Agent-${VERSION}.pkg"
DIST_DIR="${SCRIPT_DIR}/dist"
STAGE_ROOT="${DIST_DIR}/root"
SUPPORT_DIR="${STAGE_ROOT}/Library/Application Support/QS-Discovery-Agent"
DAEMON_DIR="${STAGE_ROOT}/Library/LaunchDaemons"
LOGS_DIR="${STAGE_ROOT}/Library/Logs/QS-Discovery-Agent"
SCRIPTS_DIR="${DIST_DIR}/scripts"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  QS Discovery Agent — macOS pkgbuild         ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
echo "  Agent root: ${AGENT_ROOT}"
echo "  Version   : ${VERSION}"
echo ""

rm -rf "${DIST_DIR}"
mkdir -p "${SUPPORT_DIR}" "${DAEMON_DIR}" "${LOGS_DIR}" "${SCRIPTS_DIR}"

# Stage agent payload
cp "${AGENT_ROOT}/qs-discovery-agent.js" "${SUPPORT_DIR}/"
cp "${AGENT_ROOT}/run-agent.sh" "${SUPPORT_DIR}/"
chmod +x "${SUPPORT_DIR}/run-agent.sh"
[ -f "${AGENT_ROOT}/setup.html" ] && cp "${AGENT_ROOT}/setup.html" "${SUPPORT_DIR}/"
[ -f "${AGENT_ROOT}/QuickStart.txt" ] && cp "${AGENT_ROOT}/QuickStart.txt" "${SUPPORT_DIR}/"
[ -f "${AGENT_ROOT}/Status Dashboard.html" ] && cp "${AGENT_ROOT}/Status Dashboard.html" "${SUPPORT_DIR}/"
[ -f "${AGENT_ROOT}/install-service.sh" ] && cp "${AGENT_ROOT}/install-service.sh" "${SUPPORT_DIR}/" && chmod +x "${SUPPORT_DIR}/install-service.sh"

# LaunchDaemon plist (node path rewritten at postinstall if system node exists)
cp "${SCRIPT_DIR}/com.qs.discovery-agent.plist" "${DAEMON_DIR}/com.qs.discovery-agent.plist"
chmod 644 "${DAEMON_DIR}/com.qs.discovery-agent.plist"

# postinstall: resolve node, download portable if needed, bootstrap daemon
cat > "${SCRIPTS_DIR}/postinstall" << 'POST'
#!/bin/bash
set -e
SUPPORT="/Library/Application Support/QS-Discovery-Agent"
PLIST="/Library/LaunchDaemons/com.qs.discovery-agent.plist"
LOGDIR="/Library/Logs/QS-Discovery-Agent"
mkdir -p "$LOGDIR"
chmod 755 "$LOGDIR"

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "${SUPPORT}/.node/bin/node" ]; then
  NODE_BIN="${SUPPORT}/.node/bin/node"
else
  # Optional: IT can pre-bundle .node; otherwise leave path and document
  NODE_BIN="/usr/local/bin/node"
  if [ ! -x "$NODE_BIN" ] && [ -x /opt/homebrew/bin/node ]; then
    NODE_BIN="/opt/homebrew/bin/node"
  fi
fi

# Rewrite ProgramArguments[0] in plist via PlistBuddy if available
if [ -x /usr/libexec/PlistBuddy ] && [ -n "$NODE_BIN" ]; then
  /usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 ${NODE_BIN}" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :ProgramArguments:1 ${SUPPORT}/qs-discovery-agent.js" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :WorkingDirectory ${SUPPORT}" "$PLIST" 2>/dev/null || true
fi

chown root:wheel "$PLIST"
chmod 644 "$PLIST"

# Unload old label if present
if launchctl print "system/com.qs.discovery-agent" >/dev/null 2>&1; then
  launchctl bootout system/"$PLIST" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
fi
# Also clear legacy label from older installers
if [ -f /Library/LaunchDaemons/com.qsasset.discovery.agent.plist ]; then
  launchctl bootout system /Library/LaunchDaemons/com.qsasset.discovery.agent.plist 2>/dev/null || \
    launchctl unload /Library/LaunchDaemons/com.qsasset.discovery.agent.plist 2>/dev/null || true
fi

if launchctl help 2>&1 | grep -q bootstrap; then
  launchctl bootstrap system "$PLIST" 2>/dev/null || launchctl load -w "$PLIST"
else
  launchctl load -w "$PLIST"
fi

exit 0
POST
chmod +x "${SCRIPTS_DIR}/postinstall"

if ! command -v pkgbuild >/dev/null 2>&1; then
  echo "  ⚠️  pkgbuild not found (install Xcode Command Line Tools)."
  echo "  Staging is ready at:"
  echo "    ${STAGE_ROOT}"
  echo ""
  echo "  Manual steps:"
  echo "    1. Copy '${SUPPORT_DIR}' contents to /Library/Application Support/QS-Discovery-Agent"
  echo "    2. Copy LaunchDaemon plist to /Library/LaunchDaemons/"
  echo "    3. sudo bash ${SCRIPTS_DIR}/postinstall"
  echo "  Or on a Mac with CLT:"
  echo "    pkgbuild --root '${STAGE_ROOT}' --scripts '${SCRIPTS_DIR}' \\"
  echo "      --identifier '${IDENTIFIER}' --version '${VERSION}' \\"
  echo "      --install-location / '${DIST_DIR}/${PKG_NAME}'"
  echo ""
  exit 0
fi

pkgbuild \
  --root "${STAGE_ROOT}" \
  --scripts "${SCRIPTS_DIR}" \
  --identifier "${IDENTIFIER}" \
  --version "${VERSION}" \
  --install-location / \
  "${DIST_DIR}/${PKG_NAME}"

echo ""
echo "  ✅ Built: ${DIST_DIR}/${PKG_NAME}"
echo "  Install: sudo installer -pkg '${DIST_DIR}/${PKG_NAME}' -target /"
echo "  Ensure Node 18+ is on PATH (or bundle .node under Application Support)."
echo ""
