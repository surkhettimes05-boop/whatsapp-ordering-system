# Customer launch runbook — Nepal / NPR / COD

## Deploy

Use `render.yaml` from the repository root. The Blueprint uses current Render plan IDs: web `0.5c-512mb`, PostgreSQL `0.1c-256mb` and Redis `256mb`, with durable media disk; the free Blueprint is only for testing. No live service is deployed by changing repository files.

Build: `npm ci --include=dev && npx prisma generate && npm prune --omit=dev`
Pre-deploy: `npx prisma migrate deploy`
Start: `node scripts/bootstrap-production.js && node src/app.js`
Health check: `/health/ready`

For an existing database, back it up and check `npx prisma migrate status` before applying migrations. Do not reset the database. Historical financial migrations recreated tables; they must not be replayed over an untracked production database. The new customer safety migration adds columns, audit events, inbox retries and an outbox without deleting customer data.

## Configuration

Render supplies DATABASE_URL and REDIS_URL. Set JWT_SECRET (32+ characters), exact HTTPS CORS_ORIGIN, PUBLIC_BASE_URL, PUBLIC_SHOP_URL, and these Meta values:

- META_GRAPH_VERSION: version configured for your Meta application
- META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_ACCESS_TOKEN
- META_WHATSAPP_APP_SECRET, META_WHATSAPP_VERIFY_TOKEN
- META_CATALOG_ID, CATALOG_FEED_TOKEN
- WHATSAPP_STATUS_TEMPLATE: approved utility template with two text body parameters, order number then order status; example body `Order {{1}} is now {{2}}.`
- WHATSAPP_TEMPLATE_LANGUAGE: approved template language, default `en`

Use WHATSAPP_PROVIDER=meta, REQUIRE_LIVE_PAYMENTS=false, ENABLE_LEGACY_ROUTES=false, ENABLE_PROMOTIONS=false, UPLOAD_DIR=/var/data/uploads. TRUST_PROXY_HOPS=1 is for the Render reverse proxy; adjust only for a known proxy topology.

ADMIN_PHONE must be a Nepal mobile (`97798XXXXXXXX` or `97797XXXXXXXX`), ADMIN_PASSWORD must have at least 12 characters. Bootstrap creates the first administrator only and will not silently elevate a customer or overwrite an existing admin password. Rotate existing passwords through the authenticated change-password endpoint. COMMERCE_WHOLESALER_ID defaults to `pasalho-fulfillment` in the Blueprint and identifies the one authoritative fulfillment inventory for this standalone system.

Public registration is disabled. Password-only customer REST access is disabled because it does not prove ownership of a WhatsApp phone. Customers use signed messages from Meta; the cart/address REST endpoints are admin operations. This system is still standalone, not automatically synced with Pasalho OS inventory.

## Real product setup

1. Log into `https://YOUR-HOST/commerce-admin` using the bootstrap administrator.
2. Add your categories and real products, prices, NPR pack units and HTTPS photos. Do not run the demo seed in production.
3. Add precise delivery zones and fees. An empty zone configuration rejects checkout. A district-wide keyword means district-wide service; use only locations you actually deliver to.
4. Receive physically counted opening stock using each product's **Receive stock** button. Enter a positive whole-unit quantity and a unique invoice/SKU receipt reference. Repeating a reference cannot add inventory twice.
5. Import the protected CSV feed `/api/v1/commerce/meta-catalog-feed.csv?token=YOUR_FEED_TOKEN` into Meta Commerce Manager. Meta product retailer IDs must match local SKU/metaRetailerId values. PUBLIC_SHOP_URL must point to a real public product destination; this repository includes an admin dashboard, not a complete storefront.

## Meta webhook

Callback: `https://YOUR-HOST/api/v1/whatsapp/webhook`. Use META_WHATSAPP_VERIFY_TOKEN for verification and subscribe to message events. The application validates signed payloads and the destination phone-number ID. Every message in a batch is stored before returning 200; database failures return 503 so Meta can retry.

The worker processes inbox messages in sender order. Customer/cart/order changes, the processed marker and queued replies commit together. Pending events and replies recover after restart. Failures back off and stop after ten attempts; the dashboard shows failed messages with a Retry button. Investigate the error before retrying. If Meta accepts a reply but its response is lost, a retry can send a duplicate notification; it cannot create a duplicate order or cash receipt.

Use an approved order-status utility template so operational updates can be sent outside a customer's active conversation window. Test it on the real business number before launch. Native catalog and template approval are external Meta setup requirements, not proven by local mock transport tests.

## Fulfillment and money

CREATED → CONFIRMED → PROCESSING → PACKED → OUT_FOR_DELIVERY → DELIVERED.

Checkout reserves the full basket at COMMERCE_WHOLESALER_ID atomically. Cancellation releases the reservation. FAILED keeps the reservation for another attempt or explicit cancellation. Before DELIVERED, staff must enter the exact cash collected. Delivery writes PAID cash evidence, fulfills the reservation and reduces physical inventory in the same transaction. Repeated status requests do not repeat these effects. Inventory events are append-only. Reports use Nepal day boundaries.

Old orders created before this fix may lack reservations or cash evidence. Reconcile those manually before fulfilling them; the service refuses to invent inventory or money for them. A sales report is not a bank reconciliation: staff must still reconcile physical cash.

Keep `/commerce-admin` open: orders refresh every 15 seconds. A visible update error means staff must investigate connectivity rather than assume there are no orders. Check failed messages daily.

## Verification

Run on a disposable PostgreSQL database after migrations:

```bash
NODE_ENV=test USE_REAL_DATABASE=true npm run test:customer
```

CI checks migrations from an empty database, drift, schema, syntax, dependency security, customer flows, production startup and the Docker image. The legacy coupon demo smoke is available only for non-production testing; production promotions remain disabled.

After configuring real stock and serviceability:

```bash
SMOKE_BASE_URL=https://YOUR-HOST SMOKE_SERVICE_AREA=Birendranagar npm run smoke:production
```

This is read-only and verifies deployed dependencies, Meta configuration, COD-only providers, stocked catalog and serviceability. It cannot prove Meta delivery or physical fulfillment.

Final customer gate: use the real business number and a small real COD basket. Browse/search → native cart → address → COD checkout → reservation → dashboard → picking/packing → dispatch → exact cash collection → delivered → reduced stock → sales/SKU reconciliation. Also place and cancel one order and verify stock release. Confirm no duplicate order after repeating checkout. Do not invite customers until this live transaction passes.

Render configuration reference: https://render.com/docs/blueprint-spec and https://render.com/docs/compute-plans (checked 2026-10-07).
