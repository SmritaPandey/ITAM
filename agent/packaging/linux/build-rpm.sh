#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# QS Discovery Agent — RPM stub (documents / stages for rpmbuild)
# Full RPM requires rpmbuild; this script stages SPECS + sources.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION="${QS_AGENT_VERSION:-2.0.0}"
NAME="qs-discovery-agent"
DIST_DIR="${SCRIPT_DIR}/dist/rpm"
SPEC="${DIST_DIR}/SPECS/${NAME}.spec"
BUILDROOT_PREVIEW="${DIST_DIR}/BUILDROOT-preview/opt/qs-discovery-agent"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  QS Discovery Agent — RPM stub               ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}/SPECS" "${DIST_DIR}/SOURCES" "${BUILDROOT_PREVIEW}" \
  "${DIST_DIR}/BUILDROOT-preview/lib/systemd/system" \
  "${DIST_DIR}/BUILDROOT-preview/etc/logrotate.d" \
  "${DIST_DIR}/BUILDROOT-preview/var/log/qs-discovery-agent"

cp "${AGENT_ROOT}/qs-discovery-agent.js" "${BUILDROOT_PREVIEW}/"
cp "${AGENT_ROOT}/run-agent.sh" "${BUILDROOT_PREVIEW}/"
chmod +x "${BUILDROOT_PREVIEW}/run-agent.sh"
cp "${SCRIPT_DIR}/qs-discovery-agent.service" \
  "${DIST_DIR}/BUILDROOT-preview/lib/systemd/system/"
cp "${SCRIPT_DIR}/qs-discovery-agent.logrotate" \
  "${DIST_DIR}/BUILDROOT-preview/etc/logrotate.d/qs-discovery-agent"
cp "${SCRIPT_DIR}/qs-discovery-agent.service" "${DIST_DIR}/SOURCES/"
cp "${SCRIPT_DIR}/qs-discovery-agent.logrotate" "${DIST_DIR}/SOURCES/"

# Source tarball for rpmbuild
tar -C "${AGENT_ROOT}" -czf "${DIST_DIR}/SOURCES/${NAME}-${VERSION}.tar.gz" \
  qs-discovery-agent.js run-agent.sh setup.html QuickStart.txt install-service.sh \
  2>/dev/null || tar -C "${AGENT_ROOT}" -czf "${DIST_DIR}/SOURCES/${NAME}-${VERSION}.tar.gz" \
  qs-discovery-agent.js run-agent.sh

cat > "${SPEC}" << EOF
Name:           ${NAME}
Version:        ${VERSION}
Release:        1%{?dist}
Summary:        QS Discovery Agent always-on inventory reporter
License:        Proprietary
URL:            https://example.com/qs-asset
Source0:        %{name}-%{version}.tar.gz
BuildArch:      noarch
Requires:       systemd
Recommends:     nodejs >= 18

%description
Lightweight agent that reports hardware, OS, and network inventory
to the QS Asset server. Installs a systemd unit at boot.

%prep
%setup -q

%build
# no compile

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/qs-discovery-agent
mkdir -p %{buildroot}/lib/systemd/system
mkdir -p %{buildroot}/etc/logrotate.d
mkdir -p %{buildroot}/var/log/qs-discovery-agent
cp qs-discovery-agent.js run-agent.sh %{buildroot}/opt/qs-discovery-agent/
install -m 0755 %{_sourcedir}/../BUILDROOT-preview/opt/qs-discovery-agent/run-agent.sh \\
  %{buildroot}/opt/qs-discovery-agent/run-agent.sh || true
cat > %{buildroot}/opt/qs-discovery-agent/run-agent-service.sh << 'EOS'
#!/bin/bash
DIR=/opt/qs-discovery-agent
cd "\$DIR"
if command -v node >/dev/null 2>&1; then exec node "\$DIR/qs-discovery-agent.js"; fi
if [ -x "\$DIR/.node/bin/node" ]; then exec "\$DIR/.node/bin/node" "\$DIR/qs-discovery-agent.js"; fi
echo "Node.js not found" >&2; exit 1
EOS
chmod 755 %{buildroot}/opt/qs-discovery-agent/run-agent-service.sh
install -m 0644 %{_sourcedir}/qs-discovery-agent.service \\
  %{buildroot}/lib/systemd/system/qs-discovery-agent.service
install -m 0644 %{_sourcedir}/qs-discovery-agent.logrotate \\
  %{buildroot}/etc/logrotate.d/qs-discovery-agent

%post
systemctl daemon-reload >/dev/null 2>&1 || true
systemctl enable qs-discovery-agent.service >/dev/null 2>&1 || true
systemctl start qs-discovery-agent.service >/dev/null 2>&1 || true

%preun
if [ \$1 -eq 0 ]; then
  systemctl stop qs-discovery-agent.service >/dev/null 2>&1 || true
  systemctl disable qs-discovery-agent.service >/dev/null 2>&1 || true
fi

%files
/opt/qs-discovery-agent
/lib/systemd/system/qs-discovery-agent.service
/etc/logrotate.d/qs-discovery-agent
%dir /var/log/qs-discovery-agent

%changelog
* Mon Jul 13 2026 QS Asset <support@example.com> - ${VERSION}-1
- Initial packaging stub for QS Discovery Agent
EOF

echo "  Staged RPM tree: ${DIST_DIR}"
echo "  Spec file      : ${SPEC}"
echo ""

if command -v rpmbuild >/dev/null 2>&1; then
  echo "  rpmbuild detected. Example:"
  echo "    rpmbuild -ba --define \"_topdir ${DIST_DIR}\" '${SPEC}'"
  echo "  (You may need to adjust Source0 layout / %setup for a clean build.)"
else
  echo "  rpmbuild not found — stub only."
  echo "  On RHEL/Fedora/SLES:"
  echo "    1. dnf/yum install rpm-build rpmdevtools"
  echo "    2. Copy SOURCES + SPECS into ~/rpmbuild (or set _topdir)"
  echo "    3. rpmbuild -ba ${NAME}.spec"
  echo "  Prefer build-deb.sh on Debian/Ubuntu hosts."
fi
echo ""
