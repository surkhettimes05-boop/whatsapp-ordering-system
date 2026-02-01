# NGINX Reverse Proxy & HTTPS Setup Guide

## Overview

Complete production-grade NGINX reverse proxy setup with:
- ✅ Domain mapping to backend container
- ✅ HTTPS with Let's Encrypt
- ✅ HTTP → HTTPS redirect
- ✅ Security headers
- ✅ Webhook POST size limits
- ✅ Rate limiting
- ✅ Automatic certificate renewal

---

## 📋 Prerequisites

- Docker & docker-compose
- Domain name pointing to your server
- Port 80 and 443 open to internet
- Email address for Let's Encrypt

---

## 🚀 Quick Start (10 Minutes)

### Step 1: Configure Domain

Update `nginx/nginx.conf`:
```bash
# Replace api.yourdomain.com with your actual domain
sed -i 's/api.yourdomain.com/YOUR_DOMAIN.com/g' nginx/nginx.conf
```

### Step 2: Start Services

```bash
# Using NGINX docker-compose
docker compose -f docker-compose.prod-with-nginx.yml up -d

# Verify all running
docker compose -f docker-compose.prod-with-nginx.yml ps
```

### Step 3: Setup HTTPS with Let's Encrypt

```bash
# Make script executable
chmod +x scripts/setup-https.sh

# Run setup (replace with your domain and email)
./scripts/setup-https.sh api.yourdomain.com admin@yourdomain.com
```

### Step 4: Configure DNS (see section below)

Point your domain to server IP.

### Step 5: Verify

```bash
# Test HTTP → HTTPS redirect
curl -i http://api.yourdomain.com

# Expected: 301 redirect to https://

# Test HTTPS
curl https://api.yourdomain.com/health

# Expected: 200 OK with JSON response

# Check certificate
curl -v https://api.yourdomain.com 2>&1 | grep -A5 "certificate"
```

---

## 🌐 DNS Configuration

### Step 1: Identify Your Server IP

```bash
# Get server's public IP
curl icanhazip.com
# or
hostname -I
```

### Step 2: Configure DNS Records

Add these records in your domain registrar's DNS panel:

**A Record (Points domain to server):**
```
Type:    A
Name:    api
Value:   YOUR_SERVER_IP
TTL:     3600 (1 hour)
```

**Example for GoDaddy:**
```
Host:    api
Points to: YOUR_SERVER_IP (e.g., 203.0.113.42)
TTL:     3600
```

**Example for Namecheap:**
```
Type:    A
Host:    api
Value:   YOUR_SERVER_IP
TTL:     3600
```

**Example for AWS Route 53:**
```
Record Name: api.yourdomain.com
Type:        A
Value:       YOUR_SERVER_IP
TTL:         300
```

### Step 3: Verify DNS Resolution

```bash
# Wait 5-15 minutes for DNS propagation

# Test DNS resolution
nslookup api.yourdomain.com
# or
dig api.yourdomain.com
# or
host api.yourdomain.com

# Should return your server IP
```

### Step 4: Test Connectivity

```bash
# Test HTTP (redirects to HTTPS)
curl -i http://api.yourdomain.com

# Test HTTPS
curl -v https://api.yourdomain.com/health
```

---

## 🔒 HTTPS with Let's Encrypt

### Automated Setup

The `setup-https.sh` script handles:
1. ✅ Generates Diffie-Hellman parameters (5 min)
2. ✅ Requests certificate from Let's Encrypt
3. ✅ Updates NGINX configuration
4. ✅ Configures auto-renewal via cron

### Manual Steps

If script fails, do manually:

```bash
# 1. Generate DH parameters
openssl dhparam -out nginx/dhparam.pem 2048

# 2. Request certificate
docker run --rm -it \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot:latest \
  certonly --webroot \
  -w /var/www/certbot \
  -d api.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos

# 3. Reload NGINX
docker compose -f docker-compose.prod-with-nginx.yml exec nginx nginx -s reload

# 4. Verify
curl https://api.yourdomain.com/health
```

---

## 🔄 Certificate Auto-Renewal

### How It Works

1. **Renewal Script:** `scripts/renew-cert.sh`
   - Runs daily at 3 AM
   - Renews certificate if needed (30 days before expiry)
   - Reloads NGINX automatically

2. **Cron Job Setup**
   ```bash
   # View cron job
   crontab -l | grep renew-cert.sh
   
   # Expected output:
   # 0 3 * * * cd /path/to/app && ./scripts/renew-cert.sh >> logs/certbot.log 2>&1
   ```

3. **View Renewal Logs**
   ```bash
   tail -f logs/certbot.log
   ```

### Manual Renewal

```bash
# Renew certificate immediately
./scripts/renew-cert.sh

# Or via certbot
docker run --rm -it \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot:latest \
  renew
```

---

## 📊 NGINX Configuration Details

### Security Headers

All enabled by default:

| Header | Purpose | Value |
|--------|---------|-------|
| HSTS | Force HTTPS | 1 year |
| X-Frame-Options | Prevent clickjacking | DENY |
| X-Content-Type-Options | Prevent MIME sniffing | nosniff |
| X-XSS-Protection | XSS protection | 1; mode=block |
| Referrer-Policy | Control referrer | strict-origin-when-cross-origin |
| CSP | Content Security Policy | default-src 'self' |
| Permissions-Policy | Disable sensors | geolocation, microphone, camera |

### Rate Limiting

| Endpoint | Limit | Burst |
|----------|-------|-------|
| `/api/` | 100 req/s | 200 req |
| `/webhook` | 1000 req/s | 5000 req |

Adjust in `nginx/nginx.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
```

### Webhook Configuration

- **Max body size:** 50MB (editable)
- **Read timeout:** 300 seconds
- **Rate limit:** 1000 req/s

Override per-location:
```nginx
location /webhook {
    client_max_body_size 100M;  # Increase to 100MB
    proxy_read_timeout 600s;     # Increase to 10 minutes
}
```

### Compression

- **Gzip:** Enabled
- **Level:** 6 (balance speed/compression)
- **Types:** JSON, CSS, JS, HTML, fonts, images

---

## 📁 File Structure

```
nginx/
├── nginx.conf              ← Main configuration (update domain)
├── dhparam.pem            ← DH parameters (auto-generated)
└── certbot/
    ├── conf/              ← SSL certificates (auto-generated)
    │   └── live/
    │       └── api.yourdomain.com/
    │           ├── fullchain.pem
    │           ├── privkey.pem
    │           └── chain.pem
    └── www/               ← Let's Encrypt verification

scripts/
├── setup-https.sh         ← Initial HTTPS setup
└── renew-cert.sh          ← Auto-renewal script

docker-compose.prod-with-nginx.yml
```

---

## 🔧 Operations Guide

### Check Service Status

```bash
# All services
docker compose -f docker-compose.prod-with-nginx.yml ps

# NGINX only
docker compose -f docker-compose.prod-with-nginx.yml ps nginx

# Expected status: Up X seconds (health: healthy)
```

### View Logs

```bash
# NGINX access log
tail -f logs/nginx/access.log

# NGINX error log
tail -f logs/nginx/error.log

# Webhook requests
tail -f logs/nginx/webhook_access.log

# Certificate renewal
tail -f logs/certbot.log
```

### Restart NGINX

```bash
# Reload config (no downtime)
docker compose -f docker-compose.prod-with-nginx.yml exec nginx nginx -s reload

# Restart container
docker compose -f docker-compose.prod-with-nginx.yml restart nginx

# Full restart
docker compose -f docker-compose.prod-with-nginx.yml down
docker compose -f docker-compose.prod-with-nginx.yml up -d
```

### Test Configuration

```bash
# Validate nginx.conf syntax
docker compose -f docker-compose.prod-with-nginx.yml exec nginx nginx -t

# Expected: nginx: configuration file test is successful
```

### View Certificate Info

```bash
# Show certificate details
openssl x509 -in nginx/certbot/conf/live/api.yourdomain.com/cert.pem -noout -text

# Show expiration date
openssl x509 -in nginx/certbot/conf/live/api.yourdomain.com/cert.pem -noout -dates

# Show subject/issuer
openssl x509 -in nginx/certbot/conf/live/api.yourdomain.com/cert.pem -noout -subject
```

---

## 🐛 Troubleshooting

### HTTPS Certificate Errors

**Error: "SSL certificate problem"**

```bash
# Check certificate chain
openssl verify -CAfile nginx/certbot/conf/live/api.yourdomain.com/chain.pem \
  nginx/certbot/conf/live/api.yourdomain.com/cert.pem

# Check certificate validity
openssl x509 -in nginx/certbot/conf/live/api.yourdomain.com/cert.pem -noout -dates

# Renew certificate
./scripts/renew-cert.sh
```

### NGINX Won't Start

**Error in logs:**

```bash
# Check NGINX syntax
docker compose -f docker-compose.prod-with-nginx.yml exec nginx nginx -t

# Common issues:
# 1. Domain placeholder not replaced
grep "api.yourdomain.com" nginx/nginx.conf

# 2. Certificate files missing
ls -la nginx/certbot/conf/live/

# 3. DH parameters missing
ls -la nginx/dhparam.pem
```

### DNS Not Resolving

```bash
# Verify DNS propagation
nslookup api.yourdomain.com
# Should return your server IP

# If not resolving:
# 1. Check DNS records in registrar
# 2. Wait 15-30 minutes for propagation
# 3. Try other DNS servers:
nslookup api.yourdomain.com 8.8.8.8  # Google DNS
nslookup api.yourdomain.com 1.1.1.1  # Cloudflare DNS
```

### HTTP → HTTPS Redirect Not Working

```bash
# Test redirect
curl -i http://api.yourdomain.com

# Should see: 301 Moved Permanently with Location: https://...

# If not:
# 1. Verify port 80 is open
netstat -tlnp | grep :80

# 2. Check NGINX logs
docker compose -f docker-compose.prod-with-nginx.yml logs nginx

# 3. Test locally
curl -i http://localhost
```

### Rate Limiting Too Strict

```bash
# Temporarily disable rate limiting
# Edit nginx/nginx.conf, comment out limit_req lines

location /api/ {
    # limit_req zone=api_limit burst=200 nodelay;  # Commented
    proxy_pass http://backend;
}

# Reload NGINX
docker compose -f docker-compose.prod-with-nginx.yml exec nginx nginx -s reload
```

---

## 🔐 Security Best Practices

### 1. Keep Certificates Secure

```bash
# Certificates should not be in version control
echo "nginx/certbot/conf/" >> .gitignore
```

### 2. Monitor Certificate Expiration

```bash
# Set calendar reminder 30 days before expiry
EXPIRY=$(openssl x509 -in nginx/certbot/conf/live/api.yourdomain.com/cert.pem -noout -dates | grep "notAfter" | cut -d= -f2)
echo "Certificate expires: $EXPIRY"
```

### 3. Enable OCSP Stapling

Already enabled in `nginx.conf`:
```nginx
ssl_stapling on;
ssl_stapling_verify on;
```

### 4. Regular Security Updates

```bash
# Update NGINX image
docker pull nginx:latest-alpine

# Update certbot
docker pull certbot/certbot:latest

# Rebuild and restart
docker compose -f docker-compose.prod-with-nginx.yml build
docker compose -f docker-compose.prod-with-nginx.yml up -d nginx
```

---

## 📊 Performance Optimization

### Gzip Compression

Already enabled. Test:
```bash
curl -i -H "Accept-Encoding: gzip" https://api.yourdomain.com/api/
# Should show: Content-Encoding: gzip
```

### HTTP/2

Already enabled. Test:
```bash
curl -i --http2 https://api.yourdomain.com/health
# Should show: HTTP/2 200
```

### Caching

Static files cached for 1 year:
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 📈 Monitoring

### Check Bandwidth Usage

```bash
# Monitor in real-time
docker stats whatsapp-nginx-prod

# View log statistics
tail -100 logs/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

### Monitor Certificate Expiry

```bash
# Create monitoring script
cat > scripts/check-cert-expiry.sh <<EOF
#!/bin/bash
CERT_FILE="nginx/certbot/conf/live/api.yourdomain.com/cert.pem"
EXPIRY=$(openssl x509 -in $CERT_FILE -noout -dates | grep notAfter | cut -d= -f2)
DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s) ) / 86400 ))

echo "Certificate expires in $DAYS_LEFT days"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "WARNING: Certificate expires soon!"
fi
EOF

chmod +x scripts/check-cert-expiry.sh
./scripts/check-cert-expiry.sh
```

---

## ✅ Deployment Checklist

- [ ] Update domain in `nginx/nginx.conf`
- [ ] Configure DNS A record pointing to server IP
- [ ] Wait 5-30 minutes for DNS propagation
- [ ] Start services: `docker compose -f docker-compose.prod-with-nginx.yml up -d`
- [ ] Run HTTPS setup: `./scripts/setup-https.sh domain.com email@domain.com`
- [ ] Test HTTP redirect: `curl -i http://domain.com`
- [ ] Test HTTPS: `curl https://domain.com/health`
- [ ] Verify certificate: `openssl x509 -in nginx/certbot/conf/live/domain.com/cert.pem -noout -dates`
- [ ] Check auto-renewal cron: `crontab -l | grep renew-cert`
- [ ] Monitor logs: `tail -f logs/nginx/access.log`
- [ ] Test rate limiting: `for i in {1..10}; do curl https://domain.com/api/; done`
- [ ] Test webhook size limit: `curl -X POST -d @large-file.json https://domain.com/webhook`

---

## 📞 Support

**See Also:**
- [DOCKER_PRODUCTION_SETUP.md](DOCKER_PRODUCTION_SETUP.md) - Docker configuration
- [DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md) - Quick commands
- [nginx.conf](../nginx/nginx.conf) - NGINX configuration reference

---

*NGINX Reverse Proxy & HTTPS Setup Guide*
*Production Ready Configuration*
*Last Updated: January 2024*
