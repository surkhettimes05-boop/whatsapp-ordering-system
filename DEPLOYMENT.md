# Deployment

The active customer deployment is the COD-only Meta configuration described in [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md).

- Application root: repository root (leave Render Root Directory blank).
- Production Blueprint: `render.yaml`.
- Build: `npm ci --include=dev && npx prisma generate && npm prune --omit=dev`.
- Pre-deploy: `npx prisma migrate deploy`.
- Start: `node scripts/bootstrap-production.js && node src/app.js`.
- Health check: `/health/ready`.
- Dashboard: `/commerce-admin`.

Do not use `prisma migrate dev` or `db push` against production. Existing databases must already have the historical migrations applied; back them up before migrating. The new customer-safety migration is additive. The old financial migration includes table recreation and must not be replayed over an untracked existing customer database.

Meta credentials, approved order-status template, real delivery zones, product/catalog mapping and physical opening stock are still required for the live launch check.
