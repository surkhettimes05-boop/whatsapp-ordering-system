# DNS Configuration Guide

## Overview

Complete guide for configuring DNS records to point your domain to the WhatsApp Ordering System running on your server.

---

## ⚡ Quick Start

### 1. Get Your Server IP

```bash
# Option 1: SSH into server
curl icanhazip.com

# Option 2: Ask your hosting provider
# They'll provide you with a public IP address
```

### 2. Add DNS A Record

In your domain registrar's control panel, create an A record:

```
Type:    A
Name:    api              (or your subdomain)
Value:   YOUR.SERVER.IP
TTL:     3600             (or lower for faster propagation)
```

### 3. Wait for Propagation

DNS changes take 5-30 minutes to propagate globally.

```bash
# Check propagation
nslookup api.yourdomain.com
# Should return your server IP
```

---

## 🌐 Registrar-Specific Instructions

### GoDaddy

1. Login to godaddy.com
2. Click "Manage DNS" for your domain
3. Click "Add" next to "DNS Records"
4. Fill in:
   - **Type:** A
   - **Name:** api (or your subdomain)
   - **Data:** YOUR_SERVER_IP
   - **TTL:** 3600
5. Click "Save DNS"

**Wait 15 minutes, then:**
```bash
nslookup api.yourdomain.com
```

---

### Namecheap

1. Login to namecheap.com
2. Go to "Dashboard" → Your Domain
3. Click "Manage"
4. Go to "DNS Records" tab
5. Click "Add New Record"
6. Fill in:
   - **Type:** A Record
   - **Host:** api
   - **Value:** YOUR_SERVER_IP
   - **TTL:** 3600
7. Click "Save"

**Wait 5-15 minutes, then:**
```bash
nslookup api.yourdomain.com
```

---

### Bluehost

1. Login to bluehost.com
2. Go to "Domains" → Your Domain
3. Click "DNS Settings"
4. Click "Add DNS Record"
5. Fill in:
   - **Type:** A
   - **Name:** api
   - **IP Address:** YOUR_SERVER_IP
   - **TTL:** 3600
6. Click "Add"

---

### AWS Route 53

1. Login to AWS Console
2. Go to Route 53 → Hosted Zones
3. Select your domain
4. Click "Create Record"
5. Fill in:
   - **Record Name:** api.yourdomain.com
   - **Record Type:** A
   - **Value:** YOUR_SERVER_IP
   - **TTL:** 300
6. Click "Create Records"

---

### Cloudflare

1. Login to cloudflare.com
2. Select your domain
3. Go to "DNS" tab
4. Click "Add record"
5. Fill in:
   - **Type:** A
   - **Name:** api
   - **IPv4 address:** YOUR_SERVER_IP
   - **TTL:** Auto
   - **Proxy status:** DNS only (or Proxied for extra security)
6. Click "Save"

---

### DigitalOcean Domains

1. Login to DigitalOcean
2. Go to Networking → Domains
3. Select your domain
4. Click "Add record"
5. Fill in:
   - **Type:** A
   - **Hostname:** api
   - **Will direct to:** YOUR_SERVER_IP
   - **TTL:** 3600
6. Click "Create Record"

---

## 🔍 Verify DNS Configuration

### Method 1: nslookup

```bash
nslookup api.yourdomain.com

# Expected output:
# Server:  8.8.8.8
# Address: 8.8.8.8#53
# 
# Non-authoritative answer:
# Name:    api.yourdomain.com
# Address: YOUR_SERVER_IP
```

### Method 2: dig

```bash
dig api.yourdomain.com

# Expected output:
# api.yourdomain.com. 3600 IN A YOUR_SERVER_IP
```

### Method 3: host

```bash
host api.yourdomain.com

# Expected output:
# api.yourdomain.com has address YOUR_SERVER_IP
```

### Method 4: Online Tool

Visit: https://mxtoolbox.com/nslookup/

Enter: `api.yourdomain.com`

Should show your server IP.

---

## 🔗 Common DNS Records

### Subdomain (Recommended)

```
Type:  A
Name:  api
Value: YOUR_SERVER_IP

Result: api.yourdomain.com → YOUR_SERVER_IP
```

### Root Domain

```
Type:  A
Name:  @ (or leave blank)
Value: YOUR_SERVER_IP

Result: yourdomain.com → YOUR_SERVER_IP
```

### www Subdomain

```
Type:  CNAME
Name:  www
Value: yourdomain.com

Result: www.yourdomain.com → yourdomain.com
```

---

## ⏱️ Propagation Times

DNS changes propagate at different speeds:

| Provider | Time |
|----------|------|
| GoDaddy | 15-30 min |
| Namecheap | 5-15 min |
| Cloudflare | < 5 min |
| AWS Route 53 | < 1 min |
| Bluehost | 5-30 min |

**Tip:** Set lower TTL (60-300) before making changes for faster propagation.

---

## 🧪 Test Your Setup

### 1. Wait for DNS Propagation

```bash
# Check every minute
while true; do
  nslookup api.yourdomain.com && break
  sleep 60
done
```

### 2. Test HTTP Connection

```bash
curl -i http://api.yourdomain.com

# Expected: 301 redirect to https://
# Location: https://api.yourdomain.com/
```

### 3. Test HTTPS Connection

```bash
curl -v https://api.yourdomain.com/health

# Expected: 200 OK
# Certificate: Valid for api.yourdomain.com
```

### 4. Test with Browser

Open: `https://api.yourdomain.com/health`

Should show:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-22T10:00:00Z"
}
```

---

## 🔐 DNS Security

### DNSSEC (Optional)

Protects against DNS hijacking:

```bash
# Check if domain supports DNSSEC
dig api.yourdomain.com +dnssec

# Enable in your registrar's control panel
```

### DNS Filtering

```bash
# Test with public DNS (Cloudflare)
nslookup api.yourdomain.com 1.1.1.1

# Test with Google DNS
nslookup api.yourdomain.com 8.8.8.8
```

---

## 🔄 Update DNS Records

### Change IP Address

```bash
# 1. Login to registrar
# 2. Find DNS Records
# 3. Edit A record
# 4. Change Value to new IP
# 5. Save

# 6. Verify propagation
nslookup api.yourdomain.com
```

### Add Additional Subdomains

```
Type:  A
Name:  api-backup      (or your subdomain)
Value: BACKUP.IP
```

### Create CNAME (Alias)

```
Type:  CNAME
Name:  staging
Value: api.yourdomain.com

Result: staging.yourdomain.com → api.yourdomain.com
```

---

## ❌ Common Issues & Solutions

### Issue: "api.yourdomain.com not found"

**Solution 1:** Wait longer for DNS propagation
```bash
# Keep checking
dig api.yourdomain.com
```

**Solution 2:** Check DNS records in registrar
- Verify A record exists
- Verify IP address is correct
- Verify TTL is set

**Solution 3:** Clear DNS cache
```bash
# Windows
ipconfig /flushdns

# Mac
sudo dscacheutil -flushcache

# Linux
sudo systemctl restart systemd-resolved
```

### Issue: Wrong IP in DNS

**Solution:**
1. Login to registrar
2. Edit A record
3. Verify IP is correct
4. Save changes
5. Wait 15 minutes
6. Test: `nslookup api.yourdomain.com`

### Issue: Multiple IPs Showing Up

**Solution:**
- Old DNS cache hasn't expired
- Different DNS servers have different records
- Wait for TTL to expire (up to 3600 seconds)

```bash
# Test with multiple DNS servers
nslookup api.yourdomain.com 8.8.8.8      # Google
nslookup api.yourdomain.com 1.1.1.1      # Cloudflare
nslookup api.yourdomain.com 208.67.222.222  # OpenDNS
```

### Issue: HTTPS Certificate Error

**Usually caused by:**
- DNS not pointing to server
- NGINX not receiving requests
- Let's Encrypt certificate not yet issued

**Solution:**
1. Verify DNS resolves correctly: `nslookup api.yourdomain.com`
2. Verify NGINX is running: `docker ps | grep nginx`
3. Re-run HTTPS setup: `./scripts/setup-https.sh`

---

## 📊 DNS Record Best Practices

### TTL (Time To Live)

| Scenario | TTL | Reason |
|----------|-----|--------|
| New domain | 300 | Fast propagation |
| Stable | 3600 | Reduced query load |
| Migration | 300 | Quick failover |
| Permanent | 86400 | Minimal queries |

### Recommended Setup

```
# Main API
Type:  A
Name:  api
Value: YOUR.SERVER.IP
TTL:   3600

# Staging (optional)
Type:  CNAME
Name:  staging
Value: api.yourdomain.com
TTL:   3600

# Email (if needed)
Type:  MX
Name:  @
Value: mail.yourdomain.com
TTL:   3600
```

---

## 🔄 DNS Failover (Advanced)

### Setup Secondary Server

```
# Primary (Active)
Type:  A
Name:  api
Value: PRIMARY.IP
TTL:   60      (Low TTL for fast failover)

# Secondary (Backup)
Type:  A
Name:  api-backup
Value: BACKUP.IP
```

### Update Primary to Secondary

When primary fails:
1. Update DNS A record to BACKUP.IP
2. DNS changes propagate (within TTL)
3. Traffic automatically switches

---

## 🧮 DNS Math

### Calculate Propagation Time

```
Max Wait Time = Max TTL of all nameservers
Example: TTL = 3600 = 1 hour maximum
```

### Calculate Cost of DNS Queries

```
Google Public DNS: Free
Cloudflare: Free
AWS Route 53: $0.40 per million queries
```

---

## 📚 Additional Resources

- **NGINX Setup:** [NGINX_HTTPS_SETUP.md](NGINX_HTTPS_SETUP.md)
- **Docker Compose:** [DOCKER_PRODUCTION_SETUP.md](backend/DOCKER_PRODUCTION_SETUP.md)
- **DNS Checker:** https://mxtoolbox.com/nslookup/
- **SSL Checker:** https://www.sslshopper.com/ssl-checker.html
- **DNS Propagation:** https://www.whatsmydns.net/

---

## ✅ DNS Configuration Checklist

- [ ] Get server IP address
- [ ] Login to domain registrar
- [ ] Create A record (Type: A, Name: api, Value: SERVER_IP)
- [ ] Save DNS changes
- [ ] Wait 5-30 minutes for propagation
- [ ] Verify DNS: `nslookup api.yourdomain.com`
- [ ] Verify IP matches: Should be YOUR_SERVER_IP
- [ ] Test HTTP: `curl http://api.yourdomain.com`
- [ ] Test HTTPS: `curl https://api.yourdomain.com/health`
- [ ] Check certificate: Valid for api.yourdomain.com
- [ ] Monitor logs: `tail -f logs/nginx/access.log`

---

*DNS Configuration Guide for WhatsApp Ordering System*
*Production Ready Setup*
*Last Updated: January 2024*
