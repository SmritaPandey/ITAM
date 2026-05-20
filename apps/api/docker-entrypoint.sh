#!/bin/sh
set -e

echo "🔧 QS Asset API — Starting..."

# Apply database schema (works without migrations folder)
echo "📦 Applying database schema..."
# Deduplicate discovered_devices before schema push (handles migration to unique constraint)
echo "DELETE FROM discovered_devices a USING discovered_devices b WHERE a.created_at < b.created_at AND a.tenant_id = b.tenant_id AND a.ip_address = b.ip_address;" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>/dev/null || true

npx prisma db push --skip-generate --accept-data-loss

# Run seed if SEED_DB is set and this is first run
if [ "${SEED_DB}" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed || echo "⚠️  Seed skipped (may already exist)"
fi

echo "✅ Database ready. Starting API server..."
exec node dist/src/main.js
