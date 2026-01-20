#!/bin/sh
# backend/start.sh

echo "🚀 Starting application..."

# Run migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Start application
echo "🟢 Starting Node.js server..."
npm start
