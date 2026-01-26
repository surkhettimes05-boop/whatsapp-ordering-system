# ✅ Daily Operations Checklist

**Owner:** DevOps / Lead Engineer
**Frequency:** Morning (9:00 AM NPT)

## 🌄 Morning Health Check
- [ ] **Server Status:** Is the VPS/Container running? (Uptime check)
- [ ] **Database Connectivity:** Can the backend read/write to DB? ( `/health` endpoint)
- [ ] **WhatsApp Webhook:**
    - Send a "Hi" to the bot number.
    - Does it autoreply? (Verifies Twilio <-> Server link)
- [ ] **Scheduled Jobs:**
    - Did the "Expired Orders" job run last night? (Check logs)

## 📊 Business Health
- [ ] **Failed Orders:** Check DB for orders with `status: 'FAILED'` or `paymentStatus: 'FAILED'`.
- [ ] **Unclaimed Orders:** Are there orders pending > 30 mins? (Notify wholesalers manually if needed).

## 🌙 Evening Wrap-up
- [ ] **Backups:** Verify backup file was created today.
- [ ] **Error Logs:** Scan for repeated 500 errors in logs today.

---

## ⚠️ Warning Signs (Nepal Context)
- **High Latency:** If logs show slow responses (>2s), ISP international bandwidth might be congested (common in Nepal evenings).
- **Missed Webhooks:** If multiple webhooks failed, did the office have a power cut? Check UPS.
