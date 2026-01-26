#!/bin/bash

# ============================================================================
# NGINX + Let's Encrypt HTTPS Setup Script
# ============================================================================
# Usage: ./scripts/setup-https.sh domain.com admin@domain.com
#
# This script:
# 1. Generates SSL certificate with Let's Encrypt
# 2. Configures NGINX for HTTPS
# 3. Sets up auto-renewal with certbot
# ============================================================================

set -e

DOMAIN=${1:-api.yourdomain.com}
EMAIL=${2:-admin@domain.com}
NGINX_CONTAINER="nginx"
CERTBOT_CONTAINER="certbot"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================================================
# Validation
# ============================================================================

log_info "Setting up HTTPS for domain: $DOMAIN"
log_info "Email for Let's Encrypt: $EMAIL"

if ! command -v docker &> /dev/null; then
    log_error "Docker not found"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose not found"
    exit 1
fi

# ============================================================================
# Generate Diffie-Hellman Parameters (for security)
# ============================================================================

log_info "Generating Diffie-Hellman parameters (this may take 5 minutes)..."

if [ ! -f "nginx/dhparam.pem" ]; then
    openssl dhparam -out nginx/dhparam.pem 2048
    log_success "DH parameters generated"
else
    log_success "DH parameters already exist"
fi

# ============================================================================
# Create Certbot Container for Initial Certificate
# ============================================================================

log_info "Creating initial Let's Encrypt certificate..."

# Certonly mode: obtain certificate without modifying NGINX config
docker run --rm -it \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot:latest \
  certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

if [ $? -eq 0 ]; then
    log_success "Certificate obtained successfully"
else
    log_error "Failed to obtain certificate"
    exit 1
fi

# ============================================================================
# Update NGINX Configuration
# ============================================================================

log_info "Updating NGINX configuration..."

# Replace domain placeholder in nginx.conf
sed -i.bak "s/api.yourdomain.com/$DOMAIN/g" nginx/nginx.conf

log_success "NGINX configuration updated"

# ============================================================================
# Start/Restart NGINX with New Configuration
# ============================================================================

log_info "Restarting NGINX..."

if docker-compose -f docker-compose.prod.yml exec nginx nginx -t &> /dev/null; then
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    log_success "NGINX reloaded with new configuration"
else
    log_error "NGINX configuration test failed"
    log_info "Rolling back changes..."
    cp nginx/nginx.conf.bak nginx/nginx.conf
    exit 1
fi

# ============================================================================
# Setup Auto-Renewal
# ============================================================================

log_info "Setting up auto-renewal with certbot..."

# Create renewal timer
cat > scripts/renew-cert.sh <<'EOF'
#!/bin/bash
# Auto-renewal script for Let's Encrypt certificate

DOMAIN=$1
CERTBOT_CONTAINER="certbot"

echo "[$(date)] Starting certificate renewal..."

docker run --rm \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot:latest \
  renew --quiet

if [ $? -eq 0 ]; then
    echo "[$(date)] Certificate renewed successfully"
    # Reload NGINX
    docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
else
    echo "[$(date)] Certificate renewal failed"
    exit 1
fi
EOF

chmod +x scripts/renew-cert.sh
log_success "Renewal script created"

# ============================================================================
# Setup Cron Job
# ============================================================================

log_info "Setting up cron job for auto-renewal..."

CRON_JOB="0 3 * * * cd $(pwd) && ./scripts/renew-cert.sh >> logs/certbot.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "renew-cert.sh"; then
    log_success "Cron job already exists"
else
    # Add cron job (runs daily at 3 AM)
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    log_success "Cron job created (runs daily at 3 AM)"
fi

# ============================================================================
# Verification
# ============================================================================

log_info "Verifying setup..."

# Test HTTPS endpoint
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health)

if [ "$RESPONSE" = "200" ]; then
    log_success "HTTPS endpoint responding"
else
    log_error "HTTPS endpoint not responding (HTTP $RESPONSE)"
fi

# Check certificate validity
echo ""
log_info "Certificate Information:"
echo ""

openssl x509 -in nginx/certbot/conf/live/$DOMAIN/cert.pem -noout -subject
openssl x509 -in nginx/certbot/conf/live/$DOMAIN/cert.pem -noout -dates

echo ""
log_success "HTTPS Setup Complete!"
echo ""
echo "Certificate Location:"
echo "  Public:  nginx/certbot/conf/live/$DOMAIN/fullchain.pem"
echo "  Private: nginx/certbot/conf/live/$DOMAIN/privkey.pem"
echo ""
echo "Auto-Renewal:"
echo "  Cron job: Daily at 3 AM"
echo "  Script: ./scripts/renew-cert.sh"
echo "  Logs: ./logs/certbot.log"
echo ""
echo "Test your setup:"
echo "  curl -v https://$DOMAIN/health"
echo ""
echo "Check certificate expiration:"
echo "  openssl x509 -in nginx/certbot/conf/live/$DOMAIN/cert.pem -noout -dates"
echo ""
