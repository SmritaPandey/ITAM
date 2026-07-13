#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — simple .deb builder (no Docker required)
# Installs under /opt/qs-discovery-agent + systemd unit
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION="${QS_AGENT_VERSION:-2.0.0}"
ARCH="${QS_AGENT_ARCH:-amd64}"
PKG_NAME="qs-discovery-agent"
DIST_DIR="${SCRIPT_DIR}/dist"
BUILD_ROOT="${DIST_DIR}/${PKG_NAME}_${VERSION}_${ARCH}"
OPT_DIR="${BUILD_ROOT}/opt/qs-discovery-agent"
UNIT_DIR="${BUILD_ROOT}/lib/systemd/system"
DEBIAN_DIR="${BUILD_ROOT}/DEBIAN"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  QS Discovery Agent — Debian package builder ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

rm -rf "${BUILD_ROOT}"
mkdir -p "${OPT_DIR}" "${UNIT_DIR}" "${DEBIAN_DIR}" \
  "${BUILD_ROOT}/var/log/qs-discovery-agent"

cp "${AGENT_ROOT}/qs-discovery-agent.js" "${OPT_DIR}/"
cp "${AGENT_ROOT}/run-agent.sh" "${OPT_DIR}/"
chmod +x "${OPT_DIR}/run-agent.sh"
[ -f "${AGENT_ROOT}/setup.html" ] && cp "${AGENT_ROOT}/setup.html" "${OPT_DIR}/"
[ -f "${AGENT_ROOT}/QuickStart.txt" ] && cp "${AGENT_ROOT}/QuickStart.txt" "${OPT_DIR}/"
[ -f "${AGENT_ROOT}/Status Dashboard.html" ] && cp "${AGENT_ROOT}/Status Dashboard.html" "${OPT_DIR}/"
[ -f "${AGENT_ROOT}/install-service.sh" ] && cp "${AGENT_ROOT}/install-service.sh" "${OPT_DIR}/" && chmod +x "${OPT_DIR}/install-service.sh"

# Service launcher resolves node (system or bundled .node)
cat > "${OPT_DIR}/run-agent-service.sh" << 'EOF'
#!/bin/bash
set -e
DIR="/opt/qs-discovery-agent"
cd "$DIR"
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "${DIR}/.node/bin/node" ]; then
  NODE_BIN="${DIR}/.node/bin/node"
else
  echo "Node.js not found. Install Node 18+ or place a portable runtime in ${DIR}/.node" >&2
  exit 1
fi
exec "$NODE_BIN" "${DIR}/qs-discovery-agent.js"
EOF
chmod +x "${OPT_DIR}/run-agent-service.sh"

cp "${SCRIPT_DIR}/qs-discovery-agent.service" "${UNIT_DIR}/qs-discovery-agent.service"

cat > "${DEBIAN_DIR}/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: QS Asset <support@example.com>
Depends: adduser
Recommends: nodejs (>= 18)
Description: QS Discovery Agent — always-on inventory reporter
 Lightweight agent that reports hardware, OS, and network inventory
 to the QS Asset server. Runs as a systemd service at boot.
EOF

cat > "${DEBIAN_DIR}/postinst" << 'EOF'
#!/bin/bash
set -e
mkdir -p /var/log/qs-discovery-agent
chmod 755 /var/log/qs-discovery-agent
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload
  systemctl enable qs-discovery-agent.service
  # Do not fail install if config.json is missing yet
  systemctl start qs-discovery-agent.service || true
fi
echo "QS Discovery Agent installed under /opt/qs-discovery-agent"
echo "Place config.json there (from setup.html), then: systemctl restart qs-discovery-agent"
EOF
chmod 755 "${DEBIAN_DIR}/postinst"

cat > "${DEBIAN_DIR}/prerm" << 'EOF'
#!/bin/bash
set -e
if command -v systemctl >/dev/null 2>&1; then
  systemctl stop qs-discovery-agent.service 2>/dev/null || true
  systemctl disable qs-discovery-agent.service 2>/dev/null || true
fi
EOF
chmod 755 "${DEBIAN_DIR}/prerm"

DEB_OUT="${DIST_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"

if command -v dpkg-deb >/dev/null 2>&1; then
  # Ensure ownership-friendly permissions for packaging
  find "${BUILD_ROOT}" -type d -exec chmod 755 {} \;
  chmod 644 "${UNIT_DIR}/qs-discovery-agent.service"
  dpkg-deb --build --root-owner-group "${BUILD_ROOT}" "${DEB_OUT}"
  echo ""
  echo "  ✅ Built: ${DEB_OUT}"
  echo "  Install: sudo dpkg -i '${DEB_OUT}'"
  echo "  (Install Node 18+ if not present, or bundle .node under /opt/qs-discovery-agent)"
  echo ""
else
  echo "  ⚠️  dpkg-deb not found (run on Debian/Ubuntu, or install dpkg)."
  echo "  Package tree staged at: ${BUILD_ROOT}"
  echo ""
  echo "  Manual build when dpkg-deb is available:"
  echo "    dpkg-deb --build --root-owner-group '${BUILD_ROOT}' '${DEB_OUT}'"
  echo ""
  # Produce a portable tarball of the staged tree as a fallback artifact
  TAR_OUT="${DIST_DIR}/${PKG_NAME}_${VERSION}_${ARCH}-root.tar.gz"
  tar -C "${DIST_DIR}" -czf "${TAR_OUT}" "$(basename "${BUILD_ROOT}")"
  echo "  Fallback tarball: ${TAR_OUT}"
  echo ""
fi
