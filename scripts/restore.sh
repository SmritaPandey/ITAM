#!/bin/bash
# AssetCommand — Database Restore Script
# Usage: ./scripts/restore.sh [backup_file]
# If no file specified, restores from latest backup

set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"

if [ $# -eq 1 ]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/assetcommand_*.sql.gz 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ No backup file found"
  echo "   Usage: ./scripts/restore.sh [backup_file.sql.gz]"
  exit 1
fi

echo "⚠️  WARNING: This will replace all data in the database!"
echo "   Restoring from: ${BACKUP_FILE}"
read -p "   Continue? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "   Cancelled."
  exit 0
fi

echo "🔄 Restoring database..."

if command -v docker &> /dev/null && docker ps --filter name=assetcommand-db --format '{{.Names}}' | grep -q assetcommand-db; then
  echo "   Mode: Docker container"
  gunzip -c "$BACKUP_FILE" | docker exec -i assetcommand-db psql -U postgres assetcommand
else
  echo "   Mode: Direct connection (localhost:5434)"
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h localhost -p 5434 -U postgres assetcommand
fi

echo "✅ Restore complete!"
