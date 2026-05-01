#!/bin/bash
# AssetCommand — Database Backup Script
# Usage: ./scripts/backup.sh
# Creates a timestamped PostgreSQL dump in ./backups/

set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/assetcommand_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."
echo "   Target: ${BACKUP_FILE}"

# Check if running in Docker or direct
if command -v docker &> /dev/null && docker ps --filter name=assetcommand-db --format '{{.Names}}' | grep -q assetcommand-db; then
  echo "   Mode: Docker container"
  docker exec assetcommand-db pg_dump -U postgres assetcommand | gzip > "$BACKUP_FILE"
else
  echo "   Mode: Direct connection (localhost:5434)"
  PGPASSWORD="${DB_PASSWORD:-postgres}" pg_dump -h localhost -p 5434 -U postgres assetcommand | gzip > "$BACKUP_FILE"
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup complete: ${BACKUP_FILE} (${SIZE})"

# Cleanup: keep only last 30 backups
ls -t "$BACKUP_DIR"/assetcommand_*.sql.gz | tail -n +31 | xargs -r rm
echo "   Retained last 30 backups"
