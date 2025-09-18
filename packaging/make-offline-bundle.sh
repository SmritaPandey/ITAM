#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BUNDLE_DIR="$ROOT_DIR/dist-bundle"

rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

echo "Building frontend (requires Node/npm)..."
pushd "$ROOT_DIR/frontend" >/dev/null
npm ci --no-audit --no-fund
npm run build
popd >/dev/null

echo "Preparing backend virtualenv (requires Python3 + pip)..."
pushd "$ROOT_DIR/backend" >/dev/null
python3 -m venv venv
source venv/bin/activate
pip install --no-cache-dir -r requirements.txt
deactivate
popd >/dev/null

echo "Assembling bundle..."
mkdir -p "$BUNDLE_DIR/onprem-asset"
cp -r "$ROOT_DIR/backend" "$BUNDLE_DIR/onprem-asset/"
cp -r "$ROOT_DIR/backend/frontend-dist" "$BUNDLE_DIR/onprem-asset/backend/frontend-dist"
cp -r "$ROOT_DIR/packaging/linux/onprem-asset.service" "$BUNDLE_DIR/onprem-asset/"
cp -r "$ROOT_DIR/packaging/linux/installer-offline.sh" "$BUNDLE_DIR/onprem-asset/install.sh"

cat > "$BUNDLE_DIR/README.txt" << EOF
On-Prem Asset Management - Offline Bundle

Contents:
- onprem-asset/ (backend with prebuilt venv and frontend build)
- install.sh (Linux, offline installer)

Install (Linux):
  sudo bash onprem-asset/install.sh

Service URL: http://<host>:8080/
EOF

echo "Creating tar.gz bundle..."
tar -C "$BUNDLE_DIR" -czf "$ROOT_DIR/onprem-asset-offline-bundle.tar.gz" .
echo "Bundle created: $ROOT_DIR/onprem-asset-offline-bundle.tar.gz"

