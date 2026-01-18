#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status

# Wait for DB if DATABASE_URL is provided and we can parse host
# In many cloud environments (Render, Railway), the DB is managed and we can skip this check
# or the DB is guaranteed to be available.
if [ -n "$DATABASE_URL" ]; then
  echo "Checking database connection..."
  # Simple logic to wait for DB if needed, but in most cloud providers 
  # it's better to let the app attempt connection and retry.
fi

# Apply Prisma migrations
echo "Applying database migrations..."
npx prisma migrate deploy

# Seed the database (checking if already seeded is handled in seed.js)
echo "Running database seed..."
node scripts/seed.js

# Start the application
echo "Starting application in $NODE_ENV mode..."
exec npm start
