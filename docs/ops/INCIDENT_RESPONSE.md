# 🚨 Incident Response Plan (Nepal Context)

## ⚡ Power Outage Response (Load Shedding / Grid Failure)
**Severity:** High (If monitoring is lost) -> Critical (If servers shut down)

### 1. Servers (Hosting Environment)
- **VPS/Cloud (Railway/Render):**
    - Ensure your *own* office internet/power has backup (UPS/Inverter) to access dashboards.
    - If you cannot access the dashboard due to local power cut, use mobile data (Ncell/NTC) to verify server uptime via mobile browser.
- **On-Premise (If applicable):**
    - **Ups:** Check UPS battery health weekly. 
    - **Shutdown:** Configure graceful shutdown if battery < 20%.

### 2. Retailer Connectivity (The "Offline" User)
- Retailers may lose Wi-Fi during power cuts.
- **Action:**
    - WhatsApp works well on low bandwidth mobile data.
    - If order fails to send (clock icon), advise retailers to **not** re-send immediately to avoid duplication (though system handles deduplication).
    - **Wait for single tick** (Sent) before considering order "offline queued".

---

## 🌐 ISP / Internet Failure (WorldLink, Classic Tech, etc.)
**Severity:** Medium (Intermittent)

### Symptoms
- "Connection Refused" logs.
- WhatsApp Webhook timeouts.

### Procedures
1. **Switch ISP:**
   - If office internet fails, switch to backup 4G hotspot immediately.
2. **Check Cloud Provider:**
   - Verify if issue is local (Nepal ISP) or global (Railway/AWS status page).
   - Use `ping google.com` vs `ping project-domain.com`.
3. **Webhook Retries:**
   - Twilio/WhatsApp will retry failed webhooks for 24 hours.
   - **Do NOT panic** if real-time orders stop briefly; they will arrive when connection restores.
   - Monitor `manual_retry` queue if you implemented one.

---

## 🐛 System Crash / 500 Errors
**Severity:** Critical

### 1. Immediate Action
- **Check Logs:** Access Railway/VPS logs immediately.
    ```bash
    docker-compose logs --tail=100 -f backend
    ```
- **Restart Service:**
    ```bash
    docker-compose restart backend
    ```

### 2. Communication
- If downtime > 15 mins, send broadcast to **Top 10 Wholesalers**.
- Message: *"Technical maintenance in progress. Orders will be processed shortly. Please wait."*

---

## 📞 Emergency Contacts
| Role | Name | Phone (NTC/Ncell) |
|------|------|-------------------|
| CTO/Lead | [Your Name] | 98XXXXXXXX |
| DevOps | [Name] | 98XXXXXXXX |
| ISP Support | WorldLink | 9801523050 |

---

## 📝 Post-Incident Review
- Create "Post-Mortem" report within 24 hours.
- **Key Question:** "Did the UPS hold?" "Did mobile data fallback work?"
