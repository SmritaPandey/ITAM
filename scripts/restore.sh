#!/bin/bash
# QS Assets — Database Restore Script
# Usage: ./scripts/restore.sh [backup_file] [--no-confirm]
# If no file specified, restores from latest backup

set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"
NO_CONFIRM=false
BACKUP_FILE=""

for arg in "$@"; do
  if [ "$arg" = "--no-confirm" ]; then
    NO_CONFIRM=true
  elif [ -z "$BACKUP_FILE" ]; then
    BACKUP_FILE="$arg"
  fi
done

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/assetcommand_*.sql.gz 2>/dev/null | head -1 || true)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "No backup file found"
  echo "   Usage: ./scripts/restore.sh [backup_file.sql.gz] [--no-confirm]"
  exit 1
fi

echo "WARNING: This will replace all data in the database!"
echo "   Restoring from: ${BACKUP_FILE}"
if [ "$NO_CONFIRM" != "true" ]; then
  read -p "   Continue? (y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "   Cancelled."
    exit 0
  fi
fi

echo "Restoring database..."

DB_CONTAINER=""
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
  gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U postgres assetcommand
else
  echo "   Mode: Direct connection (localhost:5434)"
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h localhost -p 5434 -U postgres assetcommand
fi

echo "Restore complete!"
