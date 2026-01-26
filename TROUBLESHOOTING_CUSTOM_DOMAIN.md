# Custom Domain Troubleshooting Guide

Complete troubleshooting for Railway, Render, and VPS deployments.

---

## 🔍 DIAGNOSIS FLOWCHART

```
Domain Issue?
│
├─ Can't access domain at all
│  └─ → See: DNS Issues
│
├─ Shows "Not Secure" / SSL warning
│  └─ → See: SSL Certificate Issues
│
├─ Twilio webhook not triggering
│  └─ → See: Webhook Issues
│
├─ Domain sometimes works, sometimes doesn't
│  └─ → See: Connection Issues
│
└─ Backend not receiving requests
   └─ → See: Backend Issues
```

---

## 🌐 DNS ISSUES

### Problem: "This site can't be reached" or "ERR_NAME_NOT_RESOLVED"

**Step 1: Verify DNS Record Created**

```bash
# Check if DNS record exists
nslookup api.yourdomain.com
# or
dig api.yourdomain.com
# or
host api.yourdomain.com
```

**Expected Output (CNAME):**
```
api.yourdomain.com canonical name = cname.railway.app
```

**Expected Output (A Record):**
```
api.yourdomain.com A 123.45.67.89
```

**Step 2: If DNS record is missing**

1. Go to your domain registrar:
   - GoDaddy
   - Namecheap
   - Route53
   - Cloudflare
   - etc.

2. Find DNS/Advanced DNS settings

3. **For Railway/Render:**
   ```
   Type: CNAME
   Name: api
   Value: [Platform-provided value]
   TTL: 3600
   ```

4. **For VPS:**
   ```
   Type: A
   Name: api
   Value: [Your VPS Public IP]
   TTL: 3600
   ```

5. Click Save

**Step 3: Wait for Propagation**

DNS takes 5-30 minutes to propagate globally. Wait and test again:

```bash
# Keep checking
while true; do 
  echo "Testing..."; 
  nslookup api.yourdomain.com; 
  sleep 10; 
done

# Stop with Ctrl+C when it works
```

**Step 4: If still not working after 30 minutes**

```bash
# Force clear local DNS cache

# macOS
sudo dscacheutil -flushcache

# Windows
ipconfig /flushdns

# Linux
sudo systemctl restart systemd-resolved
```

Then test again.

### Problem: DNS Shows Old IP/Value

**Solution:** Delete old record, create new one

1. Go to DNS settings
2. Delete the old record completely
3. Wait 5 minutes
4. Add new record
5. Verify with: `nslookup api.yourdomain.com`

---

## 🔒 SSL CERTIFICATE ISSUES

### Problem: "Not Secure" Warning / SSL Error

**Step 1: Check Certificate Status**

```bash
# Display certificate info
echo | openssl s_client -servername api.yourdomain.com \
    -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -text

# Or simpler
echo | openssl s_client -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -dates
```

**Good Output:**
```
notBefore=Jan 19 12:34:56 2026 GMT
notAfter=Apr 19 12:34:56 2026 GMT
```

**Step 2: If Certificate Not Found**

**For Railway:** 
1. Wait 10-15 minutes after adding domain
2. Go to Railway Dashboard → Your Service → Settings → Domains
3. Check status - should say "Connected"
4. If not, remove domain and re-add

```bash
# Test if certificate is being served
curl -v https://api.yourdomain.com/health
# Should show: SSL certificate problem: self signed certificate
# OR valid certificate
```

**For Render:**
1. Wait 10-15 minutes after adding domain
2. Go to Render Dashboard → Your Service → Settings
3. Check custom domain status
4. If pending, wait longer
5. If failed, delete and re-add

**For VPS:**
```bash
# Check if certificate exists
sudo ls -la /etc/letsencrypt/live/api.yourdomain.com/

# If not found, generate new:
sudo certbot certonly --standalone -d api.yourdomain.com

# Force renewal
sudo certbot renew --force-renewal

# Restart Nginx
sudo systemctl restart nginx
```

### Problem: Certificate Expired

**For Railway/Render:**
- Automatic renewal - shouldn't happen
- If expired: Remove domain, re-add domain
- This forces new certificate generation

**For VPS:**
```bash
# Check expiry date
sudo certbot certificates

# Renew immediately
sudo certbot renew --force-renewal

# Check if renewal cron is active
sudo systemctl status certbot.timer

# Restart Nginx
sudo systemctl restart nginx
```

### Problem: Wrong Certificate (Domain Mismatch)

**For Railway/Render:**
1. Verify domain name exactly matches what you added
2. Should be: `api.yourdomain.com` (no `https://`, no `/`)
3. Remove domain and re-add with exact name

**For VPS:**
```bash
# Verify certificate is for correct domain
echo | openssl s_client -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -subject

# Should show: subject=CN = api.yourdomain.com

# If wrong, regenerate:
sudo certbot delete --cert-name api.yourdomain.com
sudo certbot certonly --standalone -d api.yourdomain.com
sudo systemctl restart nginx
```

---

## 🔗 WEBHOOK ISSUES

### Problem: Twilio Webhook Not Triggering

**Step 1: Verify Endpoint Is Accessible**

```bash
# Test the webhook endpoint directly
curl -X POST https://api.yourdomain.com/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&To=+0987654321&Body=test&MessageSid=SMxxxxx"

# Should respond with HTTP 200 (or whatever your app responds)
```

If this fails, backend isn't accessible. Go to: **Backend Issues** section.

**Step 2: Verify URL in Twilio Console**

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to: Messaging → Settings
3. Look for "When a message comes in"
4. Check the URL is: `https://api.yourdomain.com/webhook/twilio`
5. Method should be: POST

**Step 3: Test Webhook in Twilio**

```bash
# Using Twilio CLI
twilio api:core:messages:list --limit 20

# Or manually send test message to your Twilio number
# and check backend logs
```

**Step 4: Check Backend Logs**

**Railway:**
```bash
railway logs
# or Railway Dashboard → Logs tab
```

**Render:**
```
Render Dashboard → Your Service → Logs tab
```

**VPS:**
```bash
# If using PM2
pm2 logs

# If using systemd
sudo journalctl -u whatsapp-backend -f

# If using Docker
docker logs [container-name] -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**Step 5: Verify Twilio Signature Validation** (if using it)

```javascript
// In your webhook handler, check if signature is being validated
const twilio = require('twilio');

// Make sure this matches what Twilio expects
const isValidRequest = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN,
  req.headers['x-twilio-signature'],
  req.originalUrl,
  req.body
);

if (!isValidRequest) {
  console.error('Invalid Twilio signature');
  return res.status(403).send('Forbidden');
}
```

**Step 6: Monitor Twilio Logs**

1. Twilio Console → Monitoring → Message Logs
2. Look for your test message
3. Check status:
   - ✅ Delivered → Good
   - ⚠️ Webhook Pending → Webhook not called
   - ❌ Webhook Failed → Backend error

---

## 🔌 BACKEND ISSUES

### Problem: Backend Not Responding (504, Connection Refused)

**Step 1: Verify Backend is Running**

**Railway:**
```bash
railway logs
# Should show: Server running on port 3000
# or: listening
```

**Render:**
```
Render Dashboard → Logs tab
Should show app is running
```

**VPS:**
```bash
# Check if Node.js is running
ps aux | grep node

# If not running, start it
pm2 start app.js

# Or if using systemd
sudo systemctl start whatsapp-backend
```

**Step 2: Test Backend Directly**

```bash
# If you have backend logs/terminal access
curl http://localhost:3000/health

# Should respond with JSON
```

**Step 3: Check Port Forwarding (VPS)**

```bash
# Make sure Nginx is forwarding to backend correctly
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check if Nginx is running
sudo systemctl status nginx
```

**Step 4: Check Environment Variables**

```bash
# Make sure these are set:
echo $NODE_ENV        # Should be: production
echo $TWILIO_ACCOUNT_SID    # Should be: ACxxxxxxx...
echo $DATABASE_URL    # Should be: mysql://...
```

If missing, add them:

**Railway:**
- Dashboard → Variables tab → Add variable

**Render:**
- Dashboard → Settings → Environment

**VPS:**
```bash
# In .env file
nano .env

# Make sure all variables are set
# Then restart
pm2 restart app
```

### Problem: Backend Crashes on Startup

**Check logs:**

```bash
# Railway
railway logs

# Render
Render Dashboard → Logs

# VPS
pm2 logs
# or
docker logs [container]
```

**Common issues:**
- Missing environment variables
- Database connection error
- Port already in use
- Syntax error in code

**Fix:**
1. Check error message in logs
2. Set missing variables
3. Verify database is accessible
4. Check syntax
5. Restart

---

## 🌍 CONNECTION ISSUES

### Problem: Domain Works Sometimes, Not Always

**Possible causes:**
1. DNS propagation not complete
2. Multiple IPs/load balancing issue
3. Network connectivity
4. Time-based rate limiting

**Solutions:**

```bash
# Check which IP DNS resolves to
nslookup api.yourdomain.com

# If multiple IPs, connection might vary
# Wait for DNS to stabilize (usually 30 mins)

# Test multiple times
for i in {1..10}; do 
  curl -o /dev/null -s -w "%{http_code}\n" https://api.yourdomain.com/health
  sleep 1
done

# Should consistently return 200
```

**Step 2: Check Rate Limiting**

```bash
# If getting 429 (Too Many Requests)
# Your rate limiter is triggering

# Check backend config
# Look for: rate limiting, throttling, etc.

# May need to whitelist Twilio IPs
```

### Problem: Intermittent "Connection Refused"

**For VPS:**
```bash
# Check if Nginx is running
sudo systemctl status nginx

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Restart if needed
sudo systemctl restart nginx
```

**For Railway/Render:**
```bash
# Check if service is running
# Use platform dashboard
# Restart service if needed
```

---

## 🧪 COMPREHENSIVE DIAGNOSTICS

Run this script to identify issues:

```bash
#!/bin/bash

echo "🔍 Diagnostic Report"
echo "===================="
echo ""

# 1. DNS Test
echo "1. DNS Resolution:"
nslookup api.yourdomain.com || echo "❌ DNS failed"
echo ""

# 2. Connectivity Test
echo "2. Connectivity:"
curl -o /dev/null -s -w "HTTP Status: %{http_code}\n" https://api.yourdomain.com/health || echo "❌ Connection failed"
echo ""

# 3. SSL Certificate Test
echo "3. SSL Certificate:"
echo | openssl s_client -servername api.yourdomain.com \
    -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -dates || echo "❌ SSL check failed"
echo ""

# 4. Webhook Test
echo "4. Webhook Endpoint:"
curl -X POST https://api.yourdomain.com/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&Body=test" \
  -o /dev/null -s -w "HTTP Status: %{http_code}\n" || echo "❌ Webhook failed"
echo ""

# 5. Health Check
echo "5. Health Endpoint:"
curl https://api.yourdomain.com/health 2>/dev/null | jq . || echo "❌ Health check failed"
echo ""

echo "✅ Diagnostics complete"
```

Save as `diagnose.sh` and run:
```bash
chmod +x diagnose.sh
./diagnose.sh
```

---

## 📞 GETTING HELP

**Before reaching out to support, run:**

1. Diagnostic script above (save output)
2. `curl -v https://api.yourdomain.com/health` (save output)
3. Platform logs (Railway/Render/VPS)
4. Error messages (if any)

**Include with support request:**
- Platform (Railway/Render/VPS)
- Domain name
- Error message
- Diagnostic output
- What you've already tried

---

## ✨ QUICK FIXES

| Symptom | Quick Fix | Test |
|---------|-----------|------|
| DNS not working | Wait 30 mins | `nslookup api.yourdomain.com` |
| SSL warning | Wait 15 mins | Refresh browser |
| Backend not responding | Restart service | `curl https://api.yourdomain.com/health` |
| Webhook not triggering | Check Twilio URL | Check console logs |
| 404 errors | Verify endpoint exists | `curl https://api.yourdomain.com/webhook/twilio` |
| 502 errors | Restart backend | Check platform logs |

---

## 🆘 WHEN ALL ELSE FAILS

1. **Delete and recreate domain** (if platform allows)
2. **Switch DNS to different registrar** (DNS might be cached)
3. **Use IP address directly** (temporary workaround)
4. **Redeploy backend** to same platform
5. **Contact platform support** with diagnostics

---

**Most issues resolve with:**
1. Time (DNS/SSL propagation)
2. Restart (backend/service)
3. Verification (settings are correct)

If still stuck, use diagnostic script output when reaching out for help.
