# Custom Domain Quick Reference - WhatsApp Backend

## ⚡ 5-MINUTE SETUP

### Choose Your Platform

#### 🚀 Railway (Easiest)
```
1. Dashboard → Your Service → Settings → Domains
2. Add Custom Domain: api.yourdomain.com
3. Copy CNAME value
4. Add DNS CNAME record in registrar
5. Done! SSL auto-provisioned
```

**DNS Record:**
```
Type: CNAME
Name: api
Value: [Railway-provided value]
TTL: 3600
```

---

#### 🎨 Render (Also Easy)
```
1. Dashboard → Your Service → Settings → Custom Domains
2. Add Custom Domain: api.yourdomain.com
3. Add DNS CNAME record shown
4. Wait 10 mins for SSL
5. Done!
```

**DNS Record:**
```
Type: CNAME
Name: api
Value: cname.onrender.com
TTL: 3600
```

---

#### 🖥️ VPS (Most Control)
```
1. SSH into VPS
2. sudo apt install nginx certbot
3. sudo certbot certonly -d api.yourdomain.com
4. Configure Nginx (see detailed guide)
5. Add DNS A record pointing to VPS IP
6. Done!
```

**DNS Record:**
```
Type: A
Name: api
Value: [Your VPS Public IP]
TTL: 3600
```

---

## 🔗 UPDATE TWILIO WEBHOOK

After domain is live (test with `curl https://api.yourdomain.com/health`):

### Option 1: Twilio Console (2 minutes)
```
1. twilio.com → Console → Messaging → Settings
2. Find "When a message comes in"
3. Change URL to: https://api.yourdomain.com/webhook/twilio
4. Save
```

### Option 2: Node.js Script (1 minute)
```bash
# Save this as update-webhook.js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, 
                      process.env.TWILIO_AUTH_TOKEN);

client.messaging.services(process.env.TWILIO_MESSAGING_SERVICE_SID)
  .update({
    inboundRequestUrl: 'https://api.yourdomain.com/webhook/twilio',
    inboundMethod: 'POST'
  })
  .then(() => console.log('✅ Updated'))
  .catch(err => console.error('❌', err));

# Run it
node update-webhook.js
```

### Option 3: cURL (One command)
```bash
curl -X POST https://messaging.twilio.com/v1/Services/{ServiceSid} \
  --data-urlencode "InboundRequestUrl=https://api.yourdomain.com/webhook/twilio" \
  --data-urlencode "InboundMethod=POST" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

---

## ✅ VERIFY SETUP

```bash
# Test domain
curl -I https://api.yourdomain.com/health
# Should return: HTTP/1.1 200 OK

# Check SSL certificate
echo | openssl s_client -servername api.yourdomain.com \
    -connect api.yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -dates
# Should show valid dates

# Test webhook
curl -X POST https://api.yourdomain.com/webhook/twilio \
  -d "From=+1234567890&Body=test"
# Should get 200 OK
```

---

## 🎯 DNS RECORD QUICK COPY-PASTE

### Railway
```
Type:  CNAME
Name:  api
Value: [Copy from Railway Dashboard]
TTL:   3600
```

### Render
```
Type:  CNAME
Name:  api
Value: cname.onrender.com
TTL:   3600
```

### VPS (DigitalOcean, Linode, AWS, etc.)
```
Type:  A
Name:  api
Value: [Your VPS Public IP - example: 123.45.67.89]
TTL:   3600
```

---

## 🔒 SSL STATUS

| Platform | SSL Type | Cost | Auto-Renew |
|----------|----------|------|-----------|
| Railway | Let's Encrypt | Free | ✅ Yes |
| Render | Let's Encrypt | Free | ✅ Yes |
| VPS | Let's Encrypt | Free | ✅ Yes (certbot) |

All platforms: **HTTPS automatically enabled, no action needed**

---

## 📋 CHECKLIST

- [ ] Domain registered (GoDaddy, Namecheap, Route53, etc.)
- [ ] Backend deployed on Railway/Render/VPS
- [ ] Custom domain added to platform
- [ ] DNS record created in registrar
- [ ] Waited 5-30 mins for DNS propagation
- [ ] Tested: `curl https://api.yourdomain.com/health` (200 OK)
- [ ] SSL certificate valid
- [ ] Updated Twilio webhook URL
- [ ] Tested webhook with test message
- [ ] Monitored logs for incoming webhooks

---

## 🚨 COMMON ISSUES

**Problem: Domain shows "not secure"**
- Solution: Wait 15 minutes, then hard-refresh (Ctrl+Shift+R)

**Problem: curl returns connection refused**
- Solution: Wait for DNS propagation (5-30 mins)
- Test: `nslookup api.yourdomain.com`

**Problem: Twilio webhook not triggering**
- Solution: Verify URL: `curl https://api.yourdomain.com/webhook/twilio`
- Check: Twilio logs show webhook attempt

**Problem: Nginx error (VPS)**
- Solution: `sudo nginx -t` to validate config
- Restart: `sudo systemctl restart nginx`

---

## 💰 COST BREAKDOWN

| Platform | Monthly | Domain | SSL |
|----------|---------|--------|-----|
| Railway | $5-20 | Included | Free |
| Render | $7-15 | Included | Free |
| VPS DO | $5-40 | Included | Free |
| VPS Linode | $5-80 | Included | Free |

**Domain registration:** $8-15/year (separate)

---

## 🔄 AFTER DEPLOYMENT

Monitor your setup:

```bash
# Check certificate renewal (VPS only)
sudo certbot status

# Monitor logs
# Railway: railway logs
# Render: dashboard
# VPS: tail -f /var/log/nginx/access.log

# Test webhook health
curl https://api.yourdomain.com/health

# Check Twilio logs
# Twilio Console → Monitoring → Logs
```

---

## 📞 QUICK HELP

| Issue | Command |
|-------|---------|
| Test domain | `curl https://api.yourdomain.com/health` |
| Check DNS | `nslookup api.yourdomain.com` |
| Check SSL cert | `echo \| openssl s_client -connect api.yourdomain.com:443` |
| Renew cert (VPS) | `sudo certbot renew --force-renewal` |
| Test webhook | `curl -X POST https://api.yourdomain.com/webhook/twilio` |

---

## 🎁 PRO TIPS

1. **Use subdomain** (`api.yourdomain.com`) instead of root
   - Easier to manage
   - Can have multiple services on root
   - Recommended for production

2. **Keep old domain/URL**
   - Update Twilio before old domain expires
   - Gives you time to verify new domain works

3. **Set up monitoring**
   - Use UptimeRobot to monitor domain
   - Get alerts if domain goes down

4. **Test before going live**
   - Send test message to WhatsApp number
   - Verify response in backend logs
   - Confirm webhook is being called

---

## 📚 MORE DETAILS

For complete setup guide with all details, see:
**CUSTOM_DOMAIN_SETUP.md**

For your current backend info:
- **Type:** WhatsApp ordering system
- **Framework:** Express.js
- **Main endpoint:** `/webhook/twilio`
- **Health check:** `/health`

---

**Ready to deploy! Pick your platform above and follow the 5-minute setup. 🚀**
