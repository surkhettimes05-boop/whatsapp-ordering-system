# Production launch runbook

This service intentionally refuses to start in `NODE_ENV=production` when critical launch configuration is unsafe or incomplete.

## Infrastructure

Render Blueprint provisions:

- Node web service
- PostgreSQL
- paid 256 MB Render Key Value (Redis-compatible) with persistence
- 10 GB persistent disk mounted at `/var/data` for media

The application uses `REDIS_URL` for BullMQ and `UPLOAD_DIR=/var/data/uploads` for persistent media.

## Required production secrets

Set these in the Render dashboard. Never commit values:

- `JWT_SECRET` — at least 32 characters
- `CORS_ORIGIN` — comma-separated HTTPS origins, no wildcard
- `PUBLIC_BASE_URL`
- `PUBLIC_SHOP_URL`
- `META_GRAPH_VERSION`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_VERIFY_TOKEN`
- `META_WHATSAPP_APP_SECRET`
- `META_CATALOG_ID`
- `CATALOG_FEED_TOKEN`
- `KHALTI_SECRET_KEY`
- `ESEWA_PRODUCT_CODE`
- `ESEWA_SECRET_KEY`

Render supplies `DATABASE_URL` and `REDIS_URL` from managed services.

Production must use:

- `WHATSAPP_PROVIDER=meta`
- `KHALTI_ENV=production`
- `ESEWA_ENV=production`
- `REQUIRE_LIVE_PAYMENTS=true`

## Pre-deploy gates

CI must pass:

1. `npm ci`
2. `npm audit --omit=dev --audit-level=high`
3. Prisma client generation
4. Every migration applied to an empty PostgreSQL 15 database
5. `prisma migrate status`
6. Prisma schema validation
7. JavaScript syntax checks
8. Express app load
9. commerce/shopping/payment/Meta module surface checks
10. dashboard JavaScript validation
11. production configuration validation

## Meta setup

Configure the Meta webhook to:

`https://<PUBLIC_BASE_URL>/api/v1/whatsapp/webhook`

Use the configured `META_WHATSAPP_VERIFY_TOKEN`. Signed POST webhooks are validated with `META_WHATSAPP_APP_SECRET`.

The Meta catalog must use product retailer IDs that match local `metaRetailerId` / SKU values.

## Smoke tests

### Deployed application

```bash
SMOKE_BASE_URL=https://api.example.com npm run smoke:production
```

This verifies health/readiness, PostgreSQL, Redis, Meta configuration, catalog accessibility, COD, and configured online payment providers.

### Provider connectivity

Run with production credentials in a secure shell:

```bash
SMOKE_MODE=connectivity npm run smoke:providers
```

This verifies:

- Meta phone-number/token lookup
- Khalti production checkout initiation without completing a charge
- eSewa production status endpoint reachability and local HMAC signing

### Final live-money launch gate

Complete one small real Khalti payment and one small real eSewa payment, then run:

```bash
SMOKE_MODE=live-payment \
SMOKE_WHATSAPP_TO=97798XXXXXXXX \
KHALTI_SMOKE_PIDX=<completed-live-pidx> \
ESEWA_SMOKE_TRANSACTION_UUID=<completed-live-uuid> \
ESEWA_SMOKE_TOTAL_AMOUNT=<amount> \
npm run smoke:providers
```

This additionally sends a real Meta WhatsApp test message and requires both payment lookups to report successful completion.

## Go-live transaction

Before opening the service to customers, manually complete:

`WhatsApp → catalog → native cart → offer/coupon → serviceability → saved address → checkout → Khalti/eSewa or COD → order status → delivered → daily SKU reconciliation`

Do not call the launch complete until this transaction and the live-provider smoke test pass.
