#!/bin/bash

# ============================================================================
# Docker Environment Validation Script
# ============================================================================
# Validates that your production environment is properly configured
# Usage: ./scripts/validate-prod-env.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ERRORS=$((ERRORS + 1))
}

# ============================================================================
# Check Required Commands
# ============================================================================

log_info "Checking required commands..."

for cmd in docker docker-compose curl nc; do
    if command -v "$cmd" &> /dev/null; then
        log_success "Found: $cmd"
    else
        log_error "Missing: $cmd"
    fi
done

# ============================================================================
# Check Docker Daemon
# ============================================================================

log_info "Checking Docker daemon..."

if docker info > /dev/null 2>&1; then
    VERSION=$(docker --version)
    log_success "Docker is running: $VERSION"
else
    log_error "Docker daemon not accessible"
fi

# ============================================================================
# Check Environment File
# ============================================================================

log_info "Checking environment configuration..."

ENV_FILE=".env.production"

if [ -f "$ENV_FILE" ]; then
    log_success "Found: $ENV_FILE"
else
    log_error "Missing: $ENV_FILE (copy from .env.production.example)"
fi

# Check required variables
REQUIRED_VARS=(
    "DB_USER"
    "DB_PASSWORD"
    "DB_NAME"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
)

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
        VALUE=$(grep "^${var}=" "$ENV_FILE" | cut -d= -f2)
        if [ -z "$VALUE" ] || [ "$VALUE" = "generate_strong_" ] || [ "$VALUE" = "fill_in_" ]; then
            log_error "Environment variable not set: $var"
        else
            log_success "Environment variable set: $var"
        fi
    else
        log_error "Environment variable not found: $var"
    fi
done

# ============================================================================
# Check Port Availability
# ============================================================================

log_info "Checking port availability..."

PORTS=(5000 5432 6379)

for port in "${PORTS[@]}"; do
    if nc -z localhost "$port" 2>/dev/null; then
        log_warning "Port $port already in use (running service?)"
    else
        log_success "Port $port is available"
    fi
done

# ============================================================================
# Check Disk Space
# ============================================================================

log_info "Checking disk space..."

AVAILABLE=$(df . | tail -1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE / 1024 / 1024))

if [ "$AVAILABLE_GB" -lt 10 ]; then
    log_error "Insufficient disk space: ${AVAILABLE_GB}GB (need at least 10GB)"
else
    log_success "Sufficient disk space: ${AVAILABLE_GB}GB"
fi

# ============================================================================
# Check Directories
# ============================================================================

log_info "Checking required directories..."

DIRS=(
    "data/postgres"
    "data/redis"
    "data/backups"
    "logs"
    "uploads"
    "scripts"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_success "Directory exists: $dir"
    else
        log_warning "Directory missing: $dir (will be created)"
    fi
done

# ============================================================================
# Check Files
# ============================================================================

log_info "Checking required files..."

FILES=(
    "Dockerfile.prod"
    "docker-compose.prod.yml"
    "scripts/deploy-prod.sh"
    "scripts/backup-db.sh"
    "scripts/init-db.sql"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "File exists: $file"
    else
        log_error "File missing: $file"
    fi
done

# ============================================================================
# Check File Permissions
# ============================================================================

log_info "Checking file permissions..."

SCRIPTS=(
    "scripts/deploy-prod.sh"
    "scripts/backup-db.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        log_success "Script executable: $script"
    else
        log_warning "Script not executable: $script (will be auto-executable)"
    fi
done

# ============================================================================
# Test Docker Build
# ============================================================================

log_info "Validating Dockerfile..."

if docker build -f Dockerfile.prod --dry-run . > /dev/null 2>&1; then
    log_success "Dockerfile syntax valid"
else
    log_error "Dockerfile has syntax errors"
fi

# ============================================================================
# Test docker-compose File
# ============================================================================

log_info "Validating docker-compose file..."

if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    log_success "docker-compose.prod.yml is valid"
else
    log_error "docker-compose.prod.yml has syntax errors"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "Validation Summary"
echo -e "${BLUE}========================================${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Errors:${NC} 0"
else
    echo -e "${RED}Errors:${NC} $ERRORS"
fi

if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}Warnings:${NC} 0"
else
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        log_success "All checks passed! Ready to deploy."
        echo ""
        echo "Next steps:"
        echo "  1. Create directories: mkdir -p data/{postgres,redis,backups} logs uploads"
        echo "  2. Make scripts executable: chmod +x scripts/*.sh"
        echo "  3. Deploy: ./scripts/deploy-prod.sh"
        exit 0
    else
        log_warning "$WARNINGS warning(s) found. Review above and proceed carefully."
        exit 0
    fi
else
    log_error "$ERRORS error(s) found. Fix issues before proceeding."
    exit 1
fi
