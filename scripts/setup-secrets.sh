#!/bin/bash

# Secrets Management Setup Script
# Sets up secrets for production deployment

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    log "Creating .env file from template..."
    cp .env.example .env
    warn "Please update .env with your production secrets!"
fi

# Generate secrets if not set
log "Checking and generating secrets..."

# Generate JWT secret if not set
if ! grep -q "JWT_SECRET=" .env || grep -q "JWT_SECRET=$" .env; then
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
    log "Generated JWT_SECRET"
fi

# Generate database password if not set
if ! grep -q "DB_PASSWORD=" .env || grep -q "DB_PASSWORD=$" .env; then
    DB_PASSWORD=$(openssl rand -base64 24)
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" .env
    log "Generated DB_PASSWORD"
fi

# Generate Redis password if not set
if ! grep -q "REDIS_PASSWORD=" .env || grep -q "REDIS_PASSWORD=$" .env; then
    REDIS_PASSWORD=$(openssl rand -base64 24)
    sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" .env
    log "Generated REDIS_PASSWORD"
fi

# Set proper permissions
chmod 600 .env
log "Set .env file permissions to 600"

# Create secrets directory for Docker secrets (if using Docker Swarm)
if [ -d "/var/lib/docker/swarm" ]; then
    log "Docker Swarm detected, creating secrets..."
    
    # Create secrets (requires Docker Swarm)
    echo "${JWT_SECRET}" | docker secret create jwt_secret - 2>/dev/null || warn "JWT secret already exists"
    echo "${DB_PASSWORD}" | docker secret create db_password - 2>/dev/null || warn "DB password secret already exists"
    echo "${REDIS_PASSWORD}" | docker secret create redis_password - 2>/dev/null || warn "Redis password secret already exists"
    
    log "Docker secrets created"
fi

log "Secrets setup completed"
warn "IMPORTANT: Store .env file securely and never commit it to version control!"
