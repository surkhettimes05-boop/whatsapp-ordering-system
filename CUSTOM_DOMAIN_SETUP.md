# Custom Domain Setup Guide - WhatsApp Backend

Complete instructions for Railway, Render, or VPS with DNS, SSL, and Twilio integration.

---

## 📋 Table of Contents

1. [Railway Setup](#railway)
2. [Render Setup](#render)
3. [VPS Setup (Self-Hosted)](#vps)
4. [Twilio Webhook Update](#twilio)
5. [Testing & Verification](#testing)

---

## 🚀 RAILWAY SETUP

### Prerequisites
- Domain registered (GoDaddy, Namecheap, Route53, etc.)
- Railway project deployed
- Railway account with billing enabled

### Step 1: Get Railway Public URL

1. Go to [Railway Dashboard](https://railway.app)
2. Select your WhatsApp backend project
3. Click on the service
4. Find **Public URL** section
5. Note the Railway URL: `https://your-project-random.railway.app`

### Step 2: Connect Custom Domain in Railway

1. In Railway, go to **Settings** → **Domains**
2. Click **Add Custom Domain**
3. Enter your domain: `api.yourdomain.com`
4. Railway auto-generates an SSL certificate (free, automatic)
5. Copy the CNAME record that appears

### Step 3: Configure DNS Records

Go to your domain registrar (GoDaddy, Namecheap, etc.):

```
Type: CNAME
Name: api
Value: [RAILWAY_GENERATED_CNAME]
TTL: 3600
```

**Example:**
```
Type: CNAME
Name: api
Value: cname.railway.app
TTL: 3600
```

**Alternative - If you want domain root:**
```
Type: A
Name: @
Value: [Railway IP provided]
TTL: 3600
```

### Step 4: Verify Domain Connection

1. Wait 5-15 minutes for DNS propagation
2. Test in Railway dashboard - it should show "Connected"
3. Test in browser: `https://api.yourdomain.com/health`
4. Should return health check data

### Step 5: SSL Certificate (Automatic)

- Railway automatically provisions Let's Encrypt SSL
- No action needed - already done when domain was connected
- Renews automatically

**Cost:**
- Custom domain: Free
- SSL: Free (Let's Encrypt)

---

## 🎨 RENDER SETUP

### Prerequisites
- Domain registered
- Render service deployed
- Render paid plan (custom domains on free plan are limited)

### Step 1: Get Render Service URL

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Select your backend service
3. Find **Service URL**: `https://backend-xxxxx.onrender.com`
4. Note this URL

### Step 2: Add Custom Domain in Render

1. In Render dashboard, go to your service
2. Click **Settings**
3. Scroll to **Custom Domains**
4. Click **Add Custom Domain**
5. Enter: `api.yourdomain.com`
6. Click **Add**

### Step 3: Configure DNS Records

Render will show you the DNS configuration needed:

```
Type: CNAME
Name: api
Value: cname.onrender.com
TTL: 3600
```

Add this to your domain registrar:

**GoDaddy:**
- Go to DNS Management
- Add CNAME record with above values

**Namecheap:**
- Go to Advanced DNS
- Add CNAME record with above values

**Route53 (AWS):**
```
Type: CNAME
Name: api.yourdomain.com
Value: cname.onrender.com
TTL: 300
```

### Step 4: SSL Certificate

Render automatically provisions SSL via Let's Encrypt:
1. Wait for DNS to propagate (5-30 minutes)
2. Render auto-generates certificate
3. Dashboard shows SSL status as "Active"

### Step 5: Verify Connection

```bash
# Test the domain
curl -H "Host: api.yourdomain.com" https://cname.onrender.com/health

# Or directly
https://api.yourdomain.com/health
```

**Render Charges:**
- Custom domain: Free (on paid plans)
- SSL: Free (Let's Encrypt)

---

## 🖥️ VPS SETUP (Self-Hosted)

### Prerequisites
- VPS with public IP (AWS, DigitalOcean, Linode, etc.)
- SSH access
- Node.js running
- Root or sudo access

### Step 1: Install Nginx (Reverse Proxy)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 2: Configure DNS Records

Point your domain to your VPS IP:

**A Record:**
```
Type: A
Name: api
Value: [YOUR_VPS_PUBLIC_IP]
TTL: 3600
```

**Example:**
```
Type: A
Name: api
Value: 123.45.67.89
TTL: 3600
```

Wait 5-30 minutes for propagation.

### Step 3: Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate SSL certificate
sudo certbot certonly --standalone -d api.yourdomain.com

# It will save to:
# /etc/letsencrypt/live/api.yourdomain.com/
```

### Step 4: Configure Nginx Reverse Proxy

Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/whatsapp-backend
```

Add this configuration:

```nginx
upstream whatsapp_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Proxy settings
    location / {
        proxy_pass http://whatsapp_backend;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Twilio webhook endpoint (if different)
    location /webhook/twilio {
        proxy_pass http://whatsapp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Don't buffer for webhooks
        proxy_buffering off;
    }

    # Health endpoint
    location /health {
        proxy_pass http://whatsapp_backend;
        access_log off;
    }
}
```

### Step 5: Enable Nginx Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/whatsapp-backend \
          /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 6: SSL Auto-Renewal

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Renews automatically via cron
# Check status
sudo systemctl status certbot.timer
```

### Step 7: Configure Environment

Update your backend `.env`:

```bash
BACKEND_URL=https://api.yourdomain.com
NODE_ENV=production
PORT=3000
```

### Step 8: Restart Backend

```bash
# If using PM2
pm2 restart app

# If using systemd
sudo systemctl restart whatsapp-backend

# If running in docker
docker-compose restart app
```

### Step 9: Test VPS Setup

```bash
# Test domain
curl -I https://api.yourdomain.com/health

# Test SSL
curl -v https://api.yourdomain.com/health

# Check certificate
echo | openssl s_client -servername api.yourdomain.com \
    -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -dates
```

---

## 🔗 TWILIO WEBHOOK UPDATE

### Update for All Platforms (Railway, Render, VPS)

After your domain is active and SSL is working:

### Method 1: Using Twilio Console

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to **Messaging** → **Settings** → **Webhooks**
3. Find **When a message comes in**
4. Update URL to: `https://api.yourdomain.com/webhook/twilio`
5. Method: **POST**
6. Save

### Method 2: Using Twilio CLI

```bash
# Install Twilio CLI
npm install -g twilio-cli

# Login
twilio login

# Update webhook
twilio api:core:messages:create \
  --to='+1234567890' \
  --from='+0987654321' \
  --body='Test' \
  --webhookUrl=https://api.yourdomain.com/webhook/twilio
```

### Method 3: Using Node.js Script

Create `update-twilio-webhook.js`:

```javascript
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

client.messaging.services(process.env.TWILIO_MESSAGING_SERVICE_SID)
  .update({
    inboundRequestUrl: 'https://api.yourdomain.com/webhook/twilio',
    inboundMethod: 'POST'
  })
  .then(service => {
    console.log('✅ Twilio webhook updated successfully');
    console.log('URL:', service.inboundRequestUrl);
  })
  .catch(err => console.error('Error:', err));
```

Run:
```bash
node update-twilio-webhook.js
```

### Method 4: Using Twilio API (cURL)

```bash
curl -X POST https://messaging.twilio.com/v1/Services/{ServiceSid} \
  --data-urlencode "InboundRequestUrl=https://api.yourdomain.com/webhook/twilio" \
  --data-urlencode "InboundMethod=POST" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

### Verify Twilio Configuration

```bash
# Test webhook endpoint
curl -X POST https://api.yourdomain.com/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&To=+0987654321&Body=test&MessageSid=SMxxxxx"

# Should respond with 200 OK
```

---

## ✅ TESTING & VERIFICATION

### 1. Test Domain Connectivity

```bash
# Test HTTPS
curl -v https://api.yourdomain.com/health

# Should show:
# < HTTP/1.1 200 OK
# < Connection established
```

### 2. Test SSL Certificate

```bash
# Check certificate expiry
echo | openssl s_client -servername api.yourdomain.com \
    -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -dates

# Output should show:
# notBefore=Jan 19 12:34:56 2026 GMT
# notAfter=Apr 19 12:34:56 2026 GMT
```

### 3. Test API Endpoints

```bash
# Health check
curl https://api.yourdomain.com/health

# Admin panel
curl https://api.yourdomain.com/admin

# Should get responses
```

### 4. Test Twilio Webhook

```bash
# Send test message to your Twilio number
# Check backend logs to verify webhook received

# Or test webhook manually
curl -X POST https://api.yourdomain.com/webhook/twilio \
  -H "X-Twilio-Signature: [SIGNATURE]" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&To=+0987654321&Body=test"

# Check logs for: "Webhook received" or similar
```

### 5. Monitor Logs

```bash
# Railway
railway logs

# Render
# View in Render dashboard

# VPS
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
pm2 logs  # or docker logs
```

---

## 📊 COMPARISON TABLE

| Feature | Railway | Render | VPS |
|---------|---------|--------|-----|
| **Setup Time** | 5 min | 5 min | 30-60 min |
| **Custom Domain** | Free | Free (paid plan) | Included |
| **SSL/TLS** | Free (auto) | Free (auto) | Free (Let's Encrypt) |
| **Cost** | $5-20/mo | $7-15/mo | $5-100+/mo |
| **Maintenance** | None | None | Full |
| **Uptime SLA** | 99.9% | 99.95% | Your responsibility |
| **Scaling** | Automatic | Manual | Manual |
| **Backups** | Included | Included | Your responsibility |

---

## 🔒 SECURITY CHECKLIST

- [ ] Domain connected with HTTPS
- [ ] SSL certificate valid and not expired
- [ ] HTTP redirects to HTTPS
- [ ] Twilio webhook URL updated
- [ ] Firewall rules configured (VPS)
- [ ] Rate limiting enabled
- [ ] Environment variables set correctly
- [ ] Logs monitored for errors
- [ ] Health endpoint accessible
- [ ] Webhook endpoint tested

---

## 🆘 TROUBLESHOOTING

### Domain shows "Not Secure"

**Railway/Render:**
- Wait 10-15 minutes for SSL provisioning
- Refresh browser (hard refresh: Ctrl+Shift+R)

**VPS:**
```bash
# Check certificate
sudo certbot status

# Force renewal
sudo certbot renew --force-renewal

# Restart Nginx
sudo systemctl restart nginx
```

### DNS Not Resolving

```bash
# Test DNS propagation
nslookup api.yourdomain.com

# Or using dig
dig api.yourdomain.com

# Should show your IP/CNAME
```

### Twilio Webhook Not Triggering

```bash
# Check endpoint
curl -v https://api.yourdomain.com/webhook/twilio

# Verify in Twilio logs
# Twilio Console → Message Logs → Webhooks

# Check backend logs for incoming requests
```

### SSL Certificate Errors (VPS)

```bash
# Check cert is readable
sudo ls -la /etc/letsencrypt/live/api.yourdomain.com/

# Verify Nginx config
sudo nginx -t

# Restart with new cert
sudo systemctl restart nginx

# Force cert renewal
sudo certbot renew --force-renewal
```

---

## 📚 NEXT STEPS

1. **Choose Platform**: Railway, Render, or VPS
2. **Follow Platform Section**: Complete steps for chosen platform
3. **Update Twilio**: Use one of the webhook update methods
4. **Test Thoroughly**: Run all verification steps
5. **Monitor**: Check logs and uptime regularly

---

## 💡 RECOMMENDATIONS

**For Beginners:** Railway or Render
- Simplest setup
- No server management
- Free SSL
- Good for rapid deployment

**For Production:** Railway or Render with custom domain
- Better than free tier
- More reliability
- Professional domain
- Suitable for production

**For Advanced Users:** VPS with custom domain
- Full control
- Lowest cost at scale
- Requires maintenance
- Best for high traffic

---

## 📞 SUPPORT RESOURCES

**Railway:** https://docs.railway.app/
**Render:** https://render.com/docs/
**Nginx:** https://nginx.org/en/docs/
**Let's Encrypt:** https://letsencrypt.org/docs/
**Twilio:** https://www.twilio.com/docs/messaging/webhooks

---

**Your custom domain is now ready for production! 🚀**
