#!/bin/bash

# ============================================================================
# Production Deployment Script
# ============================================================================
# Usage: ./scripts/deploy-prod.sh
# 
# This script:
# 1. Validates environment configuration
# 2. Creates required directories
# 3. Builds Docker images
# 4. Starts services with health checks
# 5. Runs database migrations
# 6. Verifies all systems operational
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed"
        exit 1
    fi
}

wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=0

    log_info "Waiting for $service to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if nc -z localhost "$port" 2>/dev/null; then
            log_success "$service is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 1
    done
    
    log_error "$service failed to start within timeout"
    return 1
}

# ============================================================================
# Pre-flight Checks
# ============================================================================

log_info "Starting production deployment..."

# Check required commands
log_info "Checking dependencies..."
check_command docker
check_command docker-compose
check_command curl
check_command nc

log_success "All dependencies installed"

# ============================================================================
# Environment Validation
# ============================================================================

log_info "Validating environment configuration..."

if [ ! -f "$PROJECT_DIR/.env.production" ]; then
    log_error ".env.production not found!"
    log_info "Copy .env.production.example to .env.production and fill in values"
    exit 1
fi

# Check required environment variables
required_vars=(
    "DB_USER"
    "DB_PASSWORD"
    "DB_NAME"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
)

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" "$PROJECT_DIR/.env.production"; then
        log_error "Missing required environment variable: $var"
        exit 1
    fi
done

log_success "Environment variables validated"

# ============================================================================
# Create Required Directories
# ============================================================================

log_info "Creating data directories..."

mkdir -p "$PROJECT_DIR/data/postgres"
mkdir -p "$PROJECT_DIR/data/redis"
mkdir -p "$PROJECT_DIR/data/backups"
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/uploads"

# Set appropriate permissions
chmod 755 "$PROJECT_DIR/data/postgres"
chmod 755 "$PROJECT_DIR/data/redis"
chmod 755 "$PROJECT_DIR/data/backups"

log_success "Directories created"

# ============================================================================
# Build Docker Images
# ============================================================================

log_info "Building Docker images..."

docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" build --no-cache app

log_success "Docker images built"

# ============================================================================
# Stop Existing Services (if running)
# ============================================================================

log_info "Checking for existing services..."

if docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps | grep -q "Up"; then
    log_warning "Stopping existing services..."
    docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" down
    sleep 5
fi

# ============================================================================
# Start Services
# ============================================================================

log_info "Starting services..."

docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" up -d

log_success "Services started"

# ============================================================================
# Wait for Services to Be Ready
# ============================================================================

log_info "Waiting for services to be healthy..."

# Wait for PostgreSQL
wait_for_service "PostgreSQL" 5432

# Wait for Redis
wait_for_service "Redis" 6379

# Wait for App
wait_for_service "App" 5000

sleep 5

# ============================================================================
# Health Check
# ============================================================================

log_info "Running health checks..."

# Check Docker Compose status
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps

# Test API health
log_info "Testing API health endpoint..."
if curl -sf http://localhost:5000/health > /dev/null; then
    log_success "API health check passed"
else
    log_error "API health check failed"
    log_info "View logs with: docker compose -f docker-compose.prod.yml logs app"
    exit 1
fi

# Test Database
log_info "Testing database connection..."
if docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U postgres -d whatsapp_ordering -c "SELECT 1" > /dev/null 2>&1; then
    log_success "Database connection successful"
else
    log_error "Database connection failed"
    log_info "View logs with: docker compose -f docker-compose.prod.yml logs postgres"
    exit 1
fi

# Test Redis
log_info "Testing Redis connection..."
db_password=$(grep "^DB_PASSWORD=" "$PROJECT_DIR/.env.production" | cut -d= -f2)
if docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T redis \
    redis-cli ping > /dev/null 2>&1; then
    log_success "Redis connection successful"
else
    log_error "Redis connection failed"
    log_info "View logs with: docker compose -f docker-compose.prod.yml logs redis"
    exit 1
fi

# ============================================================================
# Run Database Migrations
# ============================================================================

log_info "Running database migrations..."

if docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T app npm run db:migrate; then
    log_success "Database migrations completed"
else
    log_error "Database migrations failed"
    log_info "View logs with: docker compose -f docker-compose.prod.yml logs app"
    exit 1
fi

# ============================================================================
# Verify Application Status
# ============================================================================

log_info "Final verification..."

log_info "Service Status:"
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps

log_info "Disk Usage:"
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    du -sh /var/lib/postgresql/data || true

log_info "Redis Memory Usage:"
docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T redis \
    redis-cli info memory | grep used_memory_human || true

# ============================================================================
# Post-Deployment Information
# ============================================================================

log_success "Deployment completed successfully!"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Production Environment Ready${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "API Endpoint:     http://localhost:5000"
echo "Health Check:     curl http://localhost:5000/health"
echo ""
echo "Services:"
echo "  PostgreSQL:     localhost:5432"
echo "  Redis:          localhost:6379"
echo "  Node.js App:    localhost:5000"
echo ""
echo "Useful Commands:"
echo "  View logs:      docker compose -f docker-compose.prod.yml logs -f app"
echo "  Stop:           docker compose -f docker-compose.prod.yml stop"
echo "  Restart:        docker compose -f docker-compose.prod.yml restart"
echo "  Down:           docker compose -f docker-compose.prod.yml down"
echo ""
echo "Documentation:    See DOCKER_PRODUCTION_SETUP.md"
echo ""

log_success "Ready for traffic"
