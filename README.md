# KathaVerse – Story Reading Platform (local development)

Monorepo layout:

```text
story-web/      Angular 20 frontend (SSR, Tailwind CSS v4)
story-service/  NestJS 11 API, TypeORM, PostgreSQL
database/       Seed notes and database documentation
documentation/  Setup, architecture and assumptions
```

Progress is tracked in [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md).

## Prerequisites
- Node.js 22+ (tested with Node 24)
- PostgreSQL 14+ running on localhost:5432

## 1. Create the database
```powershell
psql -U postgres -h localhost -c "CREATE DATABASE story_platform;"
```

## 2. Configure the API
```powershell
cd story-service
copy .env.example .env
```
Edit `.env`: set `DATABASE_PASSWORD`, `JWT_ACCESS_SECRET` (a long random string), and `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` (12+ characters).

## 3. Migrate and seed
```powershell
npm install
npm run migration:run
npm run seed
```

## 4. Run
```powershell
# Terminal 1
cd story-service
npm run start:dev        # http://localhost:8080  ·  Swagger: http://localhost:8080/api-docs

# Terminal 2
cd story-web
npm install
npm start                # http://localhost:4200  (proxies /api to :8080)
```

## Scripts
| Where | Command | Purpose |
|---|---|---|
| story-service | `npm run migration:generate` | Generate a migration from entity changes |
| story-service | `npm run migration:run` / `migration:revert` | Apply / roll back migrations |
| story-service | `npm run seed` | Idempotent seed data and first admin |
| story-web | `npm run build` | Production build with SSR output |

See [documentation/ASSUMPTIONS.md](documentation/ASSUMPTIONS.md) for design decisions and known gaps.

## Configuration rules
- **Backend:** every setting comes from `story-service/.env`. `.env.example` lists all keys. The API refuses to start if a key is missing, so there are no silent defaults. Typed access lives in `src/config/`.
- **Frontend:** API paths, brand name and CSRF header are in `story-web/src/environments/environment.ts`.
- **Labels and messages:** UI text lives in `story-web/src/app/core/i18n/en.json`, used with the `translate` pipe. Backend messages and email text live in `story-service/src/i18n/en.json`.
- Keep `CSRF_HEADER_NAME` / `CSRF_HEADER_VALUE` in `.env` and `csrfHeaderName` / `csrfHeaderValue` in `environment.ts` identical.
