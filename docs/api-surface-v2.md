# Football Minutes API Surface (Phase 2)

## Security Baseline
- All routes under `/api` require authenticated session (NextAuth/Passport equivalent) with RBAC roles: `coach`, `analyst`, `viewer`.
- CSRF protection via double-submit cookie on mutating requests.
- Input validation performed server-side with Zod/JOI schemas; reject on failure.
- Responses default `application/json`; cache-control `no-store` for authenticated data.
- Rate limiting (per-IP + per-session) on roster/match mutations.
- AuditEvent created for every POST/PATCH/DELETE.

## Authentication
- `POST /api/auth/login` *(existing)* – unchanged PBKDF2 auth, returns session cookie.
- `POST /api/auth/logout` – clears session + CSRF token.
- `GET /api/auth/session` – returns `{ user, roles, csrfToken }`.

## Player Administration
- `GET /api/players`
  - Query: `status`, `includeRemoved`
  - Response: `Player[]`
- `POST /api/players`
  - Body: `{ displayName, preferredPositions?, squadNumber?, notes? }`
  - Role: `coach`
- `PATCH /api/players/:id`
  - Body: partial player fields + `status`
  - Role: `coach`
- `DELETE /api/players/:id`
  - Soft delete -> sets `removed_at`
  - Role: `coach`
- `POST /api/players/:id/restore`
  - Role: `coach`
- `GET /api/players/audit`
  - Response: `AuditEvent[]` filtered to player entities
  - Role: `analyst`, `coach`

## Pick a Team / Fixture Lifecycle
- `GET /api/fixtures`
  - Query: `seasonId`, `status`
  - Response: summary fixtures (no quarters)
- `POST /api/fixtures`
  - Body: `{ opponent, fixtureDate, kickoffTime?, venueType, squad: PlayerId[], notes? }`
  - Role: `coach`
- `GET /api/fixtures/:id`
  - Response: `{ fixture, squad, quarters, result, awards, stats }`
- `PATCH /api/fixtures/:id`
  - Body: update metadata (opponent, date, venue, notes)
  - Role: `coach`
- `POST /api/fixtures/:id/lineup`
  - Body: `{ quarters: QuarterSlot[] }`
  - Validates fairness rules against active Ruleset.
  - Role: `coach`
- `POST /api/fixtures/:id/lock`
  - Body: `{ confirmedBy }`
  - Transition `status` DRAFT -> LOCKED; generates PlayerMatchStat shell.
- `POST /api/fixtures/:id/result`
  - Body: `{ resultCode, teamGoals?, opponentGoals?, playerOfMatchId?, honorableMentions?: PlayerId[], scorers?: PlayerId[], notes? }`
  - Role: `coach`
- `POST /api/fixtures/:id/post-match`
  - Body: line-up adjustments, substitutions, final minutes; recalculates PlayerMatchStat.
- `GET /api/fixtures/:id/history`
  - Response: chronological `AuditEvent[]`
- `POST /api/fixtures/:id/unlock`
  - Guarded, role `coach`; requires justification, transitions LOCKED -> DRAFT.

## Team Stats & Home Summary
- `GET /api/stats/team`
  - Query: `teamId`, `seasonId`
  - Response: `{ played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, lastUpdated }`
- `GET /api/stats/players`
  - Query: `teamId`, `seasonId`
  - Response: list of PlayerSeasonSummary rows
- `GET /api/stats/fixtures`
  - Query: `teamId`, `seasonId`
  - Response: fixture summaries for Team Stats page (collapsed view data)

## Rules Engine
- `GET /api/rulesets/active?teamId=`
  - Response: `{ config, toggles, description, pseudoSql }`
- `POST /api/rulesets/:id/toggles`
  - Body: `{ toggles: Record<string, boolean> }`
  - Role: `coach`
- `POST /api/rulesets/:id/preview`
  - Body: `{ players: PlayerId[], context: { opponent?, fixtureDate? } }`
  - Returns recommended lineup + fairness report (read-only; no persistence).

## Imports & Admin
- `POST /api/imports/excel`
  - Upload (multipart) Excel file; server parses, validates, stores as fixtures/results.
  - Role: `analyst` or `coach`
- `GET /api/imports/:id/status`
  - Poll import job status (async processing if needed).
- `GET /api/audit`
  - Query: `entityType`, `entityId`
  - Role: `analyst`, `coach`

## Response Schemas (high level)
- **Player**: `{ id, displayName, preferredPositions, squadNumber, status, notes, createdAt, updatedAt }`
- **FixtureSummary**: `{ id, opponent, fixtureDate, venueType, status, resultCode?, teamGoals?, opponentGoals? }`
- **FixtureDetail**: `{ fixture: FixtureSummary, squad: Player[], quarters: QuarterAssignment[], result: MatchResult?, awards: MatchAward[], stats: PlayerMatchStat[] }`
- **QuarterAssignment**: `{ id, quarterNumber, wave, position, playerId, minutes, isSubstitution }`
- **PlayerSeasonSummary**: `{ playerId, displayName, appearances, totalMinutes, goals, assists, playerOfMatch, honorableMentions }`

## Error Contract
- On validation error: `422` `{ error: { code: 'VALIDATION_ERROR', details: FieldError[] } }`
- On authz failure: `403` `{ error: { code: 'FORBIDDEN' } }`
- On missing entity: `404` `{ error: { code: 'NOT_FOUND' } }`
- All errors include `requestId` for audit correlation.
