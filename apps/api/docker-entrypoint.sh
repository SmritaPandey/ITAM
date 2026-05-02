#!/bin/sh
set -e

echo "🔧 ReconAPM API — Starting..."

# Apply database schema (works without migrations folder)
echo "📦 Applying database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || npx prisma db push --skip-generate

# Run seed if SEED_DB is set and this is first run
if [ "${SEED_DB}" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed || echo "⚠️  Seed skipped (may already exist)"
fi

echo "✅ Database ready. Starting API server..."
exec node dist/src/main.js
