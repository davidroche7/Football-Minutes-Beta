# Backend Setup (Phase 2)

This guide covers the new Postgres-backed persistence layer introduced for the Football Minutes beta.

## Prerequisites

- Node.js 20+
- Postgres 15+ (local instance or Vercel Postgres)
- `DATABASE_URL` environment variable pointing to the target database (see `.env.example`)

## Database Migrations

Migrations are defined as raw SQL files under `server/db/migrations`. Apply them in order using the provided script:

```bash
# install dependencies once
npm install

# run migrations
DATABASE_URL=postgres://user:pass@localhost:5432/ffm npm run db:migrate
```

The script records progress in the `schema_migrations` table, so it is safe to rerun.

### Migration Internals
- Enumerations mirror the types listed in `docs/data-model-v2.md`.
- Views:
  - `team_season_summary` → used by the Home screen.
  - `player_season_summary` → powers Team Stats aggregates.
  - `fixture_timeline` → backing data for the expandable quarter view.

## Application Access

- For local development, export `DATABASE_URL` before starting Vite:

  ```bash
  export DATABASE_URL=postgres://user:pass@localhost:5432/ffm
  npm run dev
  ```

- On Vercel, add a `DATABASE_URL` secret named `football_minutes_database_url`. The generated `vercel.json` maps it automatically.

## Frontend Feature Flag

- Set `VITE_USE_API=true` to route roster/player operations through the new API clients.
- `VITE_API_BASE_URL` defaults to `/api`; override if the backend lives on a different origin.
- Provide the active team identifier via `VITE_TEAM_ID` (UUID) so player requests are scoped correctly.
- Optional: customise default actor roles using `VITE_ACTOR_ROLES` (comma-delimited) when bridging legacy auth to the new RBAC scheme.

## Serverless Health Check

`api/health.ts` exposes a lightweight endpoint suitable for Vercel monitors. It performs an optional database ping when connection details are available.

## Next Steps

- Build authenticated API routes that consume `server/db/client.ts`.
- Implement data migration tooling (`scripts/export-local.cjs`, `scripts/verify-migration.cjs`) per `docs/migration-plan-v2.md`.
- Update README and security docs once API endpoints are added.
