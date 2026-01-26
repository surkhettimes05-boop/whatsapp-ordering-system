#!/bin/bash

# Health Check Script
# Comprehensive health check for all services

set -euo pipefail

# Configuration
HEALTH_URL="${HEALTH_URL:-http://localhost:5000/health}"
METRICS_URL="${METRICS_URL:-http://localhost:5000/metrics}"
MAX_RETRIES=3
RETRY_DELAY=5

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

# Check HTTP endpoint
check_http() {
    local url=$1
    local name=$2
    
    for i in $(seq 1 ${MAX_RETRIES}); do
        if curl -f -s "${url}" > /dev/null 2>&1; then
            log "${name} is healthy"
            return 0
        else
            if [ $i -lt ${MAX_RETRIES} ]; then
                warn "${name} check failed, retrying... (${i}/${MAX_RETRIES})"
                sleep ${RETRY_DELAY}
            else
                error "${name} check failed after ${MAX_RETRIES} attempts"
                return 1
            fi
        fi
    done
}

# Check database connection
check_database() {
    log "Checking database connection..."
    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        log "Database is healthy"
        return 0
    else
        error "Database is not healthy"
        return 1
    fi
}

# Check Redis connection
check_redis() {
    log "Checking Redis connection..."
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        log "Redis is healthy"
        return 0
    else
        error "Redis is not healthy"
        return 1
    fi
}

# Check disk space
check_disk() {
    log "Checking disk space..."
    USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "${USAGE}" -lt 80 ]; then
        log "Disk space is healthy: ${USAGE}% used"
        return 0
    else
        warn "Disk space is getting low: ${USAGE}% used"
        return 1
    fi
}

# Check memory
check_memory() {
    log "Checking memory..."
    USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "${USAGE}" -lt 90 ]; then
        log "Memory is healthy: ${USAGE}% used"
        return 0
    else
        warn "Memory usage is high: ${USAGE}% used"
        return 1
    fi
}

# Main health check
main() {
    log "Starting comprehensive health check..."
    
    local exit_code=0
    
    # Check services
    check_http "${HEALTH_URL}" "Backend API" || exit_code=1
    check_http "${METRICS_URL}" "Metrics endpoint" || exit_code=1
    check_database || exit_code=1
    check_redis || exit_code=1
    
    # Check system resources
    check_disk || exit_code=1
    check_memory || exit_code=1
    
    if [ ${exit_code} -eq 0 ]; then
        log "All health checks passed!"
    else
        error "Some health checks failed!"
    fi
    
    exit ${exit_code}
}

main
