# Customer release gate — 2026-10-07

## Verified locally against disposable PostgreSQL 16 and Redis 7

- Full 12-migration chain applies from an empty database; Prisma reports no schema drift.
- 18 customer integration checks pass: public registration blocked, privileged/customer data protected, suspended sessions rejected, COD-only contract, concurrent checkout, checkout retries, cancellation/release, delivery cash validation, one stock deduction/cash receipt under repeated delivery, idempotent receiving, immutable audit history, serviceability fail-closed, signed batched webhooks, duplicate protection, rollback/recovery, retryable outbound messages, native WhatsApp checkout and out-of-stock rollback, dashboard script delivery.
- 8 production runtime checks pass: bootstrap idempotency, unsafe configuration rejected, PostgreSQL/Redis readiness, CSP/external script, CORS rejection, admin login/sales, COD-only providers and Redis failure returning 503.
- 5 DOM/API checks pass for dashboard initialization, sign-in/fulfillment queue, order item/address details, advancing status and receiving stock. Actual browser visual QA was unavailable because the Chromium download failed; these are DOM checks, not browser-rendering evidence.
- Legacy non-production coupon/COD demo smoke passes. Promotions remain disabled in production.
- JavaScript syntax checks and production dependency audit pass (zero production vulnerabilities).

These checks stub Meta transport and use test products and identities. They do not prove live WhatsApp credentials, catalog/template approval, Render deployment, actual stock or physical cash reconciliation. Docker image build is included in CI but was not run locally because Docker is unavailable here.

## Remaining external launch gate

- Deploy the tested branch/commit using `render.yaml` and the production runbook.
- Configure the live Meta business phone, signing secret, webhook, permanent access token, catalog and approved two-parameter order-status utility template.
- Set administrator credentials, exact HTTPS URLs, CORS and fulfillment ID.
- Enter real products, delivery zones/fees and physically counted inventory through the dashboard. Reconcile old orders without reservations manually.
- Pass `npm run smoke:production` against the deployed HTTPS origin.
- Complete one real WhatsApp COD order through reservation, packing, delivery, exact cash collection, stock deduction and reporting. Complete one cancellation and verify stock release.

See [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md). Code verification is complete; live customer launch remains conditional on these external steps.
