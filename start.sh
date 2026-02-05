#!/bin/sh
# backend/start.sh

echo "🚀 Starting application..."

# Check if DATABASE_URL is set (required for Railway/Render/etc)
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  echo "Please configure DATABASE_URL in your Railway service settings."
  echo "Railway automatically provides this when you add a PostgreSQL service."
  exit 1
fi

# Display database connection info (without password)
if [ -n "$DATABASE_URL" ]; then
  DB_INFO=$(echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/g')
  echo "📊 Database URL: $DB_INFO"
fi

# Wait for database to be ready (with retries for Railway)
echo "⏳ Checking database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if echo "SELECT 1" | npx prisma db execute --stdin > /dev/null 2>&1; then
    echo "✅ Database connection successful!"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "⏳ Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
  else
    echo "❌ Database connection failed after $MAX_RETRIES attempts"
    echo "Please check your DATABASE_URL and ensure PostgreSQL service is running."
    exit 1
  fi
done

# Run migrations
echo "📦 Running database migrations..."
if npx prisma migrate deploy; then
  echo "✅ Migrations completed successfully"
else
  echo "⚠️ Migration failed, but continuing (database might already be up to date)"
fi

# Start application
echo "🟢 Starting Node.js server..."
exec npm start
