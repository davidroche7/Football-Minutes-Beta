# Migration Plan: LocalStorage → Managed Persistence

## Objectives
1. Preserve historical roster + match data currently seeded via `data/imported-matches.json`.
2. Move runtime writes from browser localStorage to secure API backed by Postgres.
3. Maintain ability to run offline dev builds with seed data.

## Phases

### Phase 0 – Preparation
- Introduce feature flags: `USE_API_PERSISTENCE` (default false in dev).
- Add telemetry hooks in current React app to reveal which localStorage keys are exercised (validate we cover all code paths).
- Capture sample datasets covering edge cases (missing results, manual edits, roster restores).

### Phase 1 – Data Export
- Script: `scripts/export-local.cjs`
  - Reads `ffm:matches`, `ffm:roster`, `ffm:rulesOverride` from localStorage (or `data/imported-matches.json` fallback).
  - Normalises to the new schema (`docs/data-model-v2.md`).
  - Outputs `data/bootstrap.json` with sections: `players`, `fixtures`, `quarters`, `awards`, `stats`.
- Provide CLI option to push directly to API (`--push=http://localhost:3000/api/admin/bootstrap`).

### Phase 2 – Backend Seeding
- Build admin endpoint `POST /api/admin/bootstrap`
  - Authenticated via admin token.
  - Accepts `bootstrap.json` payload.
  - Inserts using upsert semantics; wraps in transaction; emits AuditEvents.
- Create migration SQL:
  1. Create new tables per data model.
  2. Add indexes (team_id, fixture_date, player_id).
  3. Create views (`team_season_summary`, `player_season_summary`).

### Phase 3 – Dual-Write Adapter
- Implement persistence service in `src/lib/persistence.ts` that, when `USE_API_PERSISTENCE` is true:
  - Calls API endpoints instead of localStorage.
  - Keeps shape identical for UI (MatchRecord, RosterPlayer) to avoid immediate refactor.
- During transition, enable dual-write: after successful API write, mirror to localStorage for offline compatibility (feature flag toggled per environment).
- Add Vitest coverage for both modes.

### Phase 4 – UI Refactor
- Split current `SeasonStatsView` into:
  - `HomeSummary` (fetches team stats endpoint).
  - `TeamStatsPage` (queries fixtures + player summaries).
- Replace direct localStorage calls in `PlayerInput`, `ConfirmTeamModal`, etc. with data hooks that talk to API.
- Remove reliance on `ensureSeedData` for production builds; keep dev-only loader using API bootstrap route.

### Phase 5 – Cleanup
- Delete old localStorage helpers once all clients on API mode.
- Update documentation (`README`, security docs) to reflect backend persistence.
- Archive legacy Excel import script or adapt it to call `/api/imports/excel`.

## Data Integrity Checks
- After migration, run comparisons:
  - Total matches count.
  - Per-player total minutes/goals/POTM.
  - Random spot-check quarter assignments.
- Provide automated script `scripts/verify-migration.cjs` that reads from API + legacy files and reports diffs.

## Rollback Plan
- Keep nightly export of API data to S3 (JSON dump).
- If API migration fails, toggle `USE_API_PERSISTENCE=false` and redeploy; app reverts to localStorage while investigation continues.
