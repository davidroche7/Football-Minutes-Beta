# Reds / Blacks Squads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag players and matches with a squad (Reds / Blacks / Both), filter the team picker and stats by squad, label matches "Reds vs X", and show home-first scores for new matches.

**Architecture:** One additive migration adds a `squad_group` enum and a nullable column on `player` and `fixture`. The server passes the column through the existing player and fixture endpoints. All squad logic (eligibility, labels, score order, clash detection, filtering) lives in one pure module, `src/lib/squads.ts`. Squad stats are computed in the browser from the already-loaded matches. The server stats views are unchanged and keep serving Overall.

**Tech Stack:** React 18 + TS + Vite + Tailwind, Express 5 + pg, Postgres (Neon), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-reds-blacks-squads-design.md`

## Global Constraints

- Migration `0006_squads.sql` is additive only: no DROP, DELETE, TRUNCATE, or UPDATE of existing rows. Idempotent. Must not contain the text `ADD VALUE` (that switches the runner out of transaction mode).
- No new dependencies.
- Pre-split matches (`squad_group` NULL) render exactly as today: "vs X", our goals first.
- Untagged players (NULL) are eligible for both squads.
- Cross-squad clash: warn, never block.
- `npm test -- --run`, `npx tsc --noEmit` and `npm run lint` must pass for touched files; no test weakened.
- Branch `feat/reds-blacks-squads`, worktree `../fmb-squads`. Never push to `main`.

## Changes vs spec "Claude's calls"

- Stats squad filter is **client-only**: no `squad` param on `/api/stats/*` and no view changes. Under Reds/Blacks the page uses the browser-derived summaries over the filtered match list. Overall keeps today's API summaries. This is less SQL and removes the `LIMIT 1` aggregation risk entirely.
- The squad field is named `squad_group` / `squadGroup` / `squad` (top-level on `MatchRecord`). `squad` is already taken on the server for the fixture's player list.

## Review Focus

1. A player with no tag shows in both squads' pickers → `isEligible(null, 'REDS') === true` (Task 1).
2. An old match with venue Away but no squad still shows our goals first → `formatScore` test (Task 1).
3. An invalid squad value from a client gets a 400, not a DB enum error leaking through → server validation tests (Task 2).
4. Changing squad in setup after ticking players drops the now-ineligible ones → PlayerInput test (Task 4).
5. Overall stats totals are unchanged by the feature → SeasonStatsView existing tests stay green, plus a new squad-filter test (Task 5).

---

### Task 1: Pure squad helpers

**Files:** Create `src/lib/squads.ts`, `src/lib/squads.test.ts`

**Produces:**
- `type Squad = 'REDS' | 'BLACKS'`; `type PlayerSquad = Squad | 'BOTH'`
- `SQUAD_LABEL: Record<PlayerSquad, string>` → `Reds`, `Blacks`, `Both`
- `isSquad(v: unknown): v is Squad`; `isPlayerSquad(v: unknown): v is PlayerSquad`
- `isEligible(playerSquad: PlayerSquad | null | undefined, squad: Squad): boolean`
- `matchLabel(opponent: string, squad?: Squad | null): string` → `"Reds vs Linton"` or `"vs Linton"`
- `formatScore(goalsFor: number|null|undefined, goalsAgainst: number|null|undefined, venue: string|null|undefined, squad: Squad|null|undefined): string` → uses `'—'` for null. Reverses only when squad is set AND venue is away (case-insensitive).
- `findSquadClashes(matches: Array<{date:string; opponent:string; players:string[]; squad?: Squad|null}>, date: string, squad: Squad, players: string[]): Record<string, string>` → player → `matchLabel` of the other squad's match on that date.
- `filterBySquad<T extends {squad?: Squad|null}>(matches: T[], squad: Squad | ''): T[]`

- [ ] Tests: `isEligible(null,'REDS')`, `('BOTH','BLACKS')` true, `('REDS','BLACKS')` false; `matchLabel('Linton','REDS') === 'Reds vs Linton'`, `matchLabel('Linton', null) === 'vs Linton'`; `formatScore(3,1,'Away','REDS') === '1 - 3'`, `formatScore(3,1,'AWAY',null) === '3 - 1'`, `formatScore(3,1,'Home','BLACKS') === '3 - 1'`, `formatScore(2,null,'Neutral','REDS') === '2 - —'`; `findSquadClashes` returns `{Ella: 'Reds vs Linton'}` for a Reds match same date when the squad is BLACKS, and nothing for same-squad, different-date or null-squad matches; `filterBySquad(ms,'')` returns everything.
- [ ] Run → fail; implement; run → pass; commit `feat(squads): pure squad helpers`.

### Task 2: Migration + server pass-through

**Files:** Create `server/db/migrations/0006_squads.sql`, `server/services/players.test.ts`. Modify `server/db/types.ts`, `server/services/players.ts`, `server/services/fixtures.ts`, `server/services/fixtures.test.ts`.

**Migration:** `DO $$ BEGIN CREATE TYPE squad_group AS ENUM ('REDS','BLACKS','BOTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;` then `ALTER TABLE player ADD COLUMN IF NOT EXISTS squad_group squad_group;`, `ALTER TABLE fixture ADD COLUMN IF NOT EXISTS squad_group squad_group;` and a guarded `fixture_squad_not_both CHECK (squad_group IS NULL OR squad_group <> 'BOTH')` added in a DO block that ignores `duplicate_object`.

**Produces:**
- `PlayerRow.squad_group` and `FixtureRow.squad_group: 'REDS'|'BLACKS'|'BOTH'|null`
- `PlayerDTO.squadGroup`; `CreatePlayerInput.squadGroup?` and `UpdatePlayerInput.squadGroup?` (own-property present → set, null allowed)
- `FixtureSummaryDTO.squadGroup`; `CreateFixtureInput.squadGroup?`; `UpdateFixtureInput.squadGroup?`; `listFixtures` selects `f.squad_group`
- Invalid values throw `Error('Invalid squad: X')`. Routes already map thrown errors to 400. Fixtures reject `BOTH`.

- [ ] Tests: createPlayer passes `squad_group` param; updatePlayer with `{squadGroup:'BLACKS'}` adds `squad_group = $n`; `{squadGroup:'PURPLE'}` rejects; createFixture passes `squadGroup` as a param; createFixture with `'BOTH'` rejects; updateFixtureMetadata with `{squadGroup:null}` sets it to NULL.
- [ ] Verify the migration against a throwaway Postgres in Docker: apply 0001–0006, then re-apply 0006 (idempotent), and `\d player` / `\d fixture` show the nullable column.
- [ ] Commit `feat(squads): squad_group column on player and fixture`.

### Task 3: Client data layer

**Files:** Modify `src/lib/roster.ts`, `src/lib/matchTypes.ts`, `src/lib/persistence.ts`, `src/lib/persistence.test.ts`.

**Produces:**
- `RosterPlayer.squadGroup?: PlayerSquad | null` (mapped from API `squadGroup`)
- `addPlayer(name, actor, squadGroup?: PlayerSquad | null)`
- `updatePlayerSquad(playerId: string, squadGroup: PlayerSquad | null, actor: string): Promise<RosterPlayer | null>`. API: PATCH `/players/:id` `{squadGroup}`; local: update the stored player.
- `SaveMatchPayload.squad?: Squad | null` (so `MatchRecord.squad`), `MatchUpdatePayload.squad?: Squad | null`
- persistence: POST body `squadGroup: payload.squad ?? null`; `convertFixtureDetailToMatch` sets `squad: detail.fixture.squadGroup ?? null`; update PATCHes `squadGroup` when `'squad' in updates`.

- [ ] Test (persistence.test.ts): saving a match with `squad:'REDS'` POSTs `squadGroup:'REDS'`, and the returned match has `squad === 'REDS'`.
- [ ] Commit `feat(squads): carry squad through roster and match persistence`.

### Task 4: Team picking UI

**Files:** Modify `src/App.tsx`, `src/components/PlayerInput.tsx`, `src/components/PlayerInput.test.tsx`.

- `matchDetails.squad: Squad | ''`, default `''`. The setup form gets a required "Squad" select (Reds/Blacks) as its first field. Submit is blocked with an alert if empty. The header and Matchday Overview show `matchLabel(opponent, squad)`. `saveMatch` passes `squad`. "Create Another Match" resets it to `''`.
- `PlayerInput` new optional props: `squad?: Squad` and `clashes?: Record<string,string>`.
  - Match mode with `squad`: the roster list shows only `isEligible` players. Selected ids that become ineligible are dropped. A player added here is created with `squadGroup = squad`. A player with a clash shows an amber note "Already picked for {label}" next to their name. Selection is still allowed.
  - Management mode (`showMatchSelection=false`): each player row gets a select with options "Both / not set" (null), Reds, Blacks, Both, which calls `updatePlayerSquad`. The add-player row gets the same select for the new player.
- App computes `clashes = findSquadClashes(matches, matchDetails.date, squad, players)` when squad is set.

- [ ] Tests: with `squad='REDS'` and roster [A:REDS, B:BLACKS, C:null, D:BOTH], the list shows A, C, D but not B; a clash map entry renders "Already picked for Blacks vs Linton"; in management mode, changing the select calls `updatePlayerSquad(id, 'BLACKS', user)`.
- [ ] Commit `feat(squads): pick team by squad, tag players`.

### Task 5: Stats page

**Files:** Modify `src/components/SeasonStatsView.tsx`, `src/components/SeasonStatsView.test.tsx`.

- State `selectedSquad: Squad | ''` (default `''` = Overall). A select labelled "Squad" (Overall / Reds / Blacks) sits next to the season picker and always shows.
- `seasonMatches` = season filter, then `filterBySquad`. The derived team and player summaries compute from `seasonMatches`, not `matches`. API summaries are used only when `matchPersistenceMode === 'api' && selectedSquad === ''`; otherwise derived.
- Match card title: `matchLabel(draft.opponent, match.squad)`. Score: `formatScore(goalsFor, goalsAgainst, resultPayload.venue, match.squad)`.
- Edit form: a squad select (Not set / Reds / Blacks) next to venue. `MatchDraft.squad`, included in `isDraftDirty`, saved via `updateMatch({squad})`.

- [ ] Tests: given one REDS match (Away, 3-1, vs Linton) and one null-squad match, selecting Reds shows "Reds vs Linton" with score "1 - 3" and hides the other. Overall shows both, and the old match still reads "vs …" with our goals first.
- [ ] Commit `feat(squads): squad filter and home-first scores on stats page`.

### Task 6: Verify + ship

- [ ] `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
- [ ] Code review of the whole branch.
- [ ] Push the branch, open a PR, and append the backlog items to `docs/tech-debt-register.md`.
- [ ] **STOP:** the user confirms the Neon branch/snapshot exists before merge. Merging to main triggers the Railway deploy, and the server applies 0006 on startup.
- [ ] After deploy: `/api/health` returns ok, and `/api/fixtures` responses include `squadGroup`.
