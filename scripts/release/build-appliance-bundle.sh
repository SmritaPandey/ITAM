#!/usr/bin/env bash
# build-appliance-bundle.sh — assemble the QS Assets Linux appliance bundle.
#
# Produces a self-contained tarball:
#   dist/appliance/qsassets-appliance-<version>.tar.gz
#     qsassets-appliance-<version>/
#       manifest.json
#       docker-compose.appliance.yml
#       Caddyfile
#       init-extensions.sql
#       qsassets-install.sh          (installer)
#       qsassets                     (management CLI)
#       verify-bundle.sh
#       qsassets.service
#       images/                      (optional: docker-saved api/web images)
#       SHA256SUMS
#
# Usage:
#   ./scripts/release/build-appliance-bundle.sh [--version v1.2.3]
#       [--with-images] [--platform linux/amd64] [--output DIR]
#
# Without --with-images (or when Docker is unavailable) the script still
# assembles the full skeleton bundle; the installer then builds images from
# source contexts or pulls them, depending on the target machine.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER_DIR="${REPO_ROOT}/installer"

VERSION=""
WITH_IMAGES=0
PLATFORM="linux/amd64"
OUT_DIR="${REPO_ROOT}/dist/appliance"

log()  { printf '\033[1;32m[bundle]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bundle] WARN:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[bundle] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version)     VERSION="${2:?}"; shift 2 ;;
    --with-images) WITH_IMAGES=1; shift ;;
    --platform)    PLATFORM="${2:?}"; shift 2 ;;
    --output)      OUT_DIR="${2:?}"; shift 2 ;;
    -h|--help)     sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)             die "Unknown flag: $1" ;;
  esac
done

# Version: flag > git tag > git describe > dev timestamp
if [ -z "$VERSION" ]; then
  VERSION="$(git -C "$REPO_ROOT" describe --tags --exact-match 2>/dev/null \
    || git -C "$REPO_ROOT" describe --tags --always 2>/dev/null \
    || echo "dev-$(date +%Y%m%d%H%M%S)")"
fi
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

BUNDLE_NAME="qsassets-appliance-${VERSION}"
STAGE="${OUT_DIR}/${BUNDLE_NAME}"

log "Version:  ${VERSION} (git ${GIT_SHA})"
log "Staging:  ${STAGE}"

rm -rf "$STAGE"
mkdir -p "$STAGE"

# ---------------------------------------------------------------------------
# Copy bundle files (flat layout — what qsassets-install.sh expects)
# ---------------------------------------------------------------------------
install -m 644 "${INSTALLER_DIR}/bundle/docker-compose.appliance.yml" "${STAGE}/docker-compose.appliance.yml"
install -m 644 "${INSTALLER_DIR}/caddy/Caddyfile"                     "${STAGE}/Caddyfile"
install -m 644 "${INSTALLER_DIR}/systemd/qsassets.service"            "${STAGE}/qsassets.service"
install -m 644 "${REPO_ROOT}/infra/docker/init-extensions.sql"        "${STAGE}/init-extensions.sql"
install -m 755 "${INSTALLER_DIR}/qsassets-install.sh"                 "${STAGE}/qsassets-install.sh"
install -m 755 "${INSTALLER_DIR}/qsassets"                            "${STAGE}/qsassets"
install -m 755 "${INSTALLER_DIR}/verify-bundle.sh"                    "${STAGE}/verify-bundle.sh"

# Guard against secrets sneaking into the bundle.
if grep -rlE '(PASSWORD|SECRET|_KEY)=[A-Za-z0-9+/]{16,}' "$STAGE" --include='*.env' 2>/dev/null | grep -q .; then
  die "Refusing to package: an env file with secret-looking values is in the stage dir."
fi

# ---------------------------------------------------------------------------
# Optionally build + export container images (skipped if Docker unavailable)
# ---------------------------------------------------------------------------
IMAGES_INCLUDED=false
if [ "$WITH_IMAGES" = "1" ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    mkdir -p "${STAGE}/images"
    build_and_save() {
      local name="$1" ctx="$2"; shift 2
      local tag="qsassets/${name}:${VERSION}"
      log "Building ${tag} for ${PLATFORM} ..."
      if docker buildx version >/dev/null 2>&1; then
        docker buildx build --platform "$PLATFORM" --load -t "$tag" "$@" "$ctx"
      else
        warn "buildx unavailable — plain docker build (host platform only)."
        docker build -t "$tag" "$@" "$ctx"
      fi
      docker tag "$tag" "qsassets/${name}:latest"
      log "Exporting ${tag} ..."
      docker save "$tag" "qsassets/${name}:latest" | gzip > "${STAGE}/images/qsassets-${name}.tar.gz"
    }
    build_and_save api "${REPO_ROOT}/apps/api"
    build_and_save web "${REPO_ROOT}/apps/web" --build-arg NEXT_PUBLIC_API_URL=/api/v1
    log "Exporting base images (postgres/redis/caddy) ..."
    for ref in postgis/postgis:16-3.4 redis:7-alpine caddy:2-alpine; do
      docker pull --platform "$PLATFORM" "$ref"
      fname="$(echo "$ref" | tr '/:' '--')"
      docker save "$ref" | gzip > "${STAGE}/images/${fname}.tar.gz"
    done
    IMAGES_INCLUDED=true
  else
    warn "Docker is not available — assembling skeleton bundle without images."
  fi
fi

# ---------------------------------------------------------------------------
# Manifest + checksums
# ---------------------------------------------------------------------------
cat > "${STAGE}/manifest.json" <<EOF
{
  "name": "qsassets-appliance",
  "version": "${VERSION}",
  "gitSha": "${GIT_SHA}",
  "platform": "${PLATFORM}",
  "imagesIncluded": ${IMAGES_INCLUDED},
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files": {
    "compose": "docker-compose.appliance.yml",
    "caddyfile": "Caddyfile",
    "installer": "qsassets-install.sh",
    "cli": "qsassets",
    "systemdUnit": "qsassets.service"
  }
}
EOF

log "Writing SHA256SUMS ..."
(
  cd "$STAGE"
  : > SHA256SUMS
  if command -v sha256sum >/dev/null 2>&1; then SUM=sha256sum; else SUM="shasum -a 256"; fi
  find . -type f ! -name SHA256SUMS | sed 's|^\./||' | sort | xargs $SUM >> SHA256SUMS
)

# ---------------------------------------------------------------------------
# Tarball
# ---------------------------------------------------------------------------
TARBALL="${OUT_DIR}/${BUNDLE_NAME}.tar.gz"
log "Creating ${TARBALL} ..."
tar -C "$OUT_DIR" -czf "$TARBALL" "$BUNDLE_NAME"

(
  cd "$OUT_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${BUNDLE_NAME}.tar.gz" > "${BUNDLE_NAME}.tar.gz.sha256"
  else
    shasum -a 256 "${BUNDLE_NAME}.tar.gz" > "${BUNDLE_NAME}.tar.gz.sha256"
  fi
)

log "Done."
log "  Bundle dir: ${STAGE}"
log "  Tarball:    ${TARBALL}"
log "  Checksum:   ${TARBALL}.sha256"
log "Install on the appliance with:"
log "  tar -xzf ${BUNDLE_NAME}.tar.gz && cd ${BUNDLE_NAME} && ./verify-bundle.sh && sudo ./qsassets-install.sh"
