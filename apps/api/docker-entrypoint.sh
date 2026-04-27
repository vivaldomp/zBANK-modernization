#!/bin/sh
set -e

echo "→ Running migrations..."
cd /app/packages/db
bun run src/migrate.ts

echo "→ Running seed..."
bun run src/seed.ts

echo "→ Starting API..."
cd /app/apps/api
exec bun run src/server.ts
