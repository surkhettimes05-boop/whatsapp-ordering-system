# Backend architecture

The repository has one canonical backend application.

- `src/` contains the executable API, WhatsApp integration, workers, jobs, services, controllers and routes.
- `prisma/` contains the canonical Prisma schema and migrations.
- `package.json` and `package-lock.json` at repository root define backend dependencies.
- `Dockerfile`, `docker-compose.yml` and the backend service in `render.yaml` run from repository root.
- `frontend/` remains an independent frontend application.

The historical `backend/` copy was removed because deployment configuration pointed to an incomplete source tree while the production application lived in root `src/`. Unique operational documentation from that directory is retained under `docs/operations/`.

Do not recreate a second backend source tree. New backend code belongs under root `src/`.
