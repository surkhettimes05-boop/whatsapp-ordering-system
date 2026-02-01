#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "Running seed..."
  node scripts/seed.js
fi

echo "Starting application..."
exec node src/app.js
