#!/bin/sh
set -e

echo "🔧 QS Asset API — Starting... (build $(date +%Y%m%d-%H%M%S))"

echo "📦 Applying database migrations..."
npx prisma migrate deploy || {
  echo "⚠️  migrate deploy failed — falling back to db push..."
  npx prisma db push --skip-generate || echo "⚠️  Schema push failed — continuing with existing schema"
}

if [ "${SEED_DB}" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed || echo "⚠️  Seed skipped (may already exist)"
fi

echo "✅ Database ready. Starting API server on PORT=${PORT:-4100}..."
if [ -f dist/main.js ]; then
  exec node dist/main.js
elif [ -f dist/src/main.js ]; then
  exec node dist/src/main.js
else
  echo "❌ No compiled main.js found under dist/"
  ls -laR dist 2>/dev/null | head -80 || true
  exit 1
fi
