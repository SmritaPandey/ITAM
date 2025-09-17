#!/usr/bin/env bash
set -euo pipefail

# Build images
docker compose build

# Save images to tar for offline move
IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'onprem-asset-frontend|backend|traefik|minio|postgres' | tr '\n' ' ')
docker save $IMAGES -o asset-suite-images.tar
echo "Saved images to asset-suite-images.tar"

