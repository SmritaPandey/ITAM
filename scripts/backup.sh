#!/bin/bash
# QS Assets — Database Backup Script
# Usage: ./scripts/backup.sh
# Creates a timestamped PostgreSQL dump in ./backups/

set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/assetcommand_${TIMESTAMP}.sql.gz"
DB_CONTAINER=""

mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."
echo "   Target: ${BACKUP_FILE}"

if command -v docker &> /dev/null; then
  for name in qsasset-db assetcommand-db; do
    if docker ps --filter "name=^/${name}$" --format '{{.Names}}' | grep -qx "$name"; then
      DB_CONTAINER="$name"
      break
    fi
  done
fi

if [ -n "$DB_CONTAINER" ]; then
  echo "   Mode: Docker container ($DB_CONTAINER)"
  docker exec "$DB_CONTAINER" pg_dump -U postgres assetcommand | gzip > "$BACKUP_FILE"
else
  echo "   Mode: Direct connection (localhost:5434)"
  PGPASSWORD="${DB_PASSWORD:-postgres}" pg_dump -h localhost -p 5434 -U postgres assetcommand | gzip > "$BACKUP_FILE"
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup complete: ${BACKUP_FILE} (${SIZE})"

# Cleanup: keep only last 30 backups
ls -t "$BACKUP_DIR"/assetcommand_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm 2>/dev/null || true
echo "   Retained last 30 backups"
