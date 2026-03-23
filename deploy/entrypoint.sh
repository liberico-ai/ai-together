#!/bin/sh
set -e

echo "⏳ Running database migrations..."
npx drizzle-kit migrate --config ./drizzle.config.ts 2>&1 || echo "⚠️  Migration skipped or failed (may already be applied)"
echo "✅ Migration step complete"

echo "🚀 Starting application..."
exec node server.js
