#!/usr/bin/env bash
# deploy/setup.sh
# Run this script once on a fresh VPS to set up Libe Aios in production
# Usage: chmod +x deploy/setup.sh && ./deploy/setup.sh

set -e

echo "📦 Setting up Libe Aios Production Environment"
echo "================================================"

# 1. Load env
if [ ! -f .env.local ]; then
  echo "❌ .env.local not found! Please create it from .env.example"
  exit 1
fi

source .env.local

# 2. Start infrastructure services first
echo "🚀 Starting database and storage services..."
docker compose -f docker-compose.yml up -d postgres pgbouncer minio

# 3. Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U libe -d libe_aios; do
  sleep 2
done
echo "✅ PostgreSQL ready"

# 4. Run database migrations
echo "📊 Running Drizzle database migrations..."
npx drizzle-kit migrate
echo "✅ Migrations complete"

# 5. Seed database
echo "🌱 Seeding database with initial data..."
npx tsx src/server/db/seed.ts
echo "✅ Database seeded"

# 6. Setup MinIO bucket
echo "🪣 Setting up MinIO bucket..."
docker run --rm --network libe-aios_libe_net \
  minio/mc \
  --quiet \
  alias set myminio http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" && \
  mc mb --ignore-existing myminio/libe-aios-files && \
  mc anonymous set download myminio/libe-aios-files
echo "✅ MinIO bucket 'libe-aios-files' ready"

echo ""
echo "✅ Setup complete! Run the following to start all services:"
echo "   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
