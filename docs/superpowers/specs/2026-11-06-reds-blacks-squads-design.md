# Reds / Blacks squads + home-first score display — design

Date: 2026-11-06
Status: draft, awaiting approval

## Why

Mid-season (2026-27) the Saffron Walden U9 girls were split into two squads, **Reds** and
**Blacks**. Both squads play at the same time with different coaches. The app is used by a couple
of people to pick a team from a day or two before kick-off up to match day, then results/scorers
are entered afterwards (mostly by one person). Coaches need to pick only from their own squad,
and stats need to be viewable per squad or overall.

Separately, scores always show "our goals first" regardless of venue. An away 3-1 win at Linton
should read **1-3** (home team first).

## Goals

1. **Tag players with a squad:** Reds, Blacks, or Both. Settable when adding a new player and
   editable for existing players. Players rarely move.
2. **Pick by squad:** match setup gains a required Reds/Blacks choice. The player picker shows only
   that squad's players plus "Both" players. The squad is saved with the match.
3. **Cross-squad warning:** if a "Both" player is already in the *other* squad's match on the
   *same date*, show a warning naming that match (e.g. "Already picked for Reds vs Linton").
   Warn, never block.
4. **Match labels:** matches with a squad display as "Reds vs Linton" / "Blacks vs Linton" wherever
   the "vs Opponent" label appears today. Matches without a squad keep "vs Linton".
5. **Stats squad filter:** a dropdown — Overall / Reds / Blacks — next to the existing season
   picker on the Season Stats page. Applies to the whole page (team summary, player table,
   match list, heat map, insights). Overall = every match. Reds/Blacks = only matches tagged
   with that squad; a "Both" player's figures under a squad come only from matches they played
   for that squad.
6. **Home-first score display, forward only:** wherever a match score is shown as "X-Y", show the
   home team's goals first for **matches that have a squad** (i.e. every match created from now on).
   Away → opponent goals first. Home and Neutral → our goals first. Matches without a squad
   (everything already played) keep today's "our goals first" display. Display-only; uses the
   existing `fixture.venue_type`. Forward-only because older matches saved with a blank venue were
   silently stored as HOME, so their venue can't be trusted.

## Non-goals

- **Reds vs Blacks as one club match.** For now each coach records it as their own match
  (Reds' opponent "Blacks", Blacks' opponent "Reds"). Known quirk: Overall counts it twice
  (a win + a loss, goals on both sides). Proper handling → backlog.
- **Back-tagging matches already played this season.** Pre-split matches stay squad-less; they
  count under Overall only. No separate "pre-split" bucket.
- **Server-side auth / closing `/admin/*` / CSRF / dependency upgrades.** Known and real (see
  Follow-ups) but explicitly deferred by the user; out of scope here.
- Changing W/D/L, goals-for/against totals, or how scores are *entered*. Only display order changes.

## Anti-goals (failure even if it "works")

- **Any data loss or mutation of existing player/fixture/lineup/result rows.** Migration is
  additive only: new nullable columns, no DROP/DELETE/TRUNCATE/UPDATE of existing data.
- A player vanishing from the picker on day one because they haven't been tagged yet.
- Breaking existing stats totals under Overall.

## Constraints

- Stack stays as is: React + TS + Vite + Tailwind frontend, Express + `pg` backend, Postgres on
  Neon, migrations via `server/db/migrations/NNNN_*.sql` run by `scripts/migrate.mjs` (Procfile
  `release` step). No new libraries.
- Next migration number is `0006`. Must be idempotent (`ADD COLUMN IF NOT EXISTS`,
  `CREATE TYPE` guarded) and contain no destructive statements.
- Before deploying, the **user** takes a Neon branch/snapshot of prod from the Neon dashboard (no
  code, no credentials handled by the builder). Deploy waits for the user to confirm it exists.
  No direct prod DB writes outside the migration.
- Tests (Vitest), `tsc --noEmit` and lint must pass; no test weakened.
- Work on a new branch off `main`, not on `fix/quarter-collapse-formation` (which has unrelated
  uncommitted WIP that must be left untouched). Don't push to main.

## Decided

| Decision | Who |
|---|---|
| Squad is a tag on player (Reds / Blacks / Both) and on fixture (Reds / Blacks), within the existing single `team`. Not two separate `team` rows — `player.team_id` is single-valued so "Both" wouldn't fit. | Claude's call, user accepted |
| Pre-split matches: no squad, Overall only, no extra bucket | User |
| Cross-squad same-day pick: warn but allow | User |
| Label "Reds vs X" / "Blacks vs X" | User |
| Reds vs Blacks: enter once per squad; Overall double-counts; proper version backlogged | User |
| Score display home-first, forward only (matches with a squad) | User |
| Neon snapshot by the user before deploy | User (pending confirmation) |
| Security work deferred until after squads | User |

## Claude's calls (check these)

- **"Future games" = matches with a squad.** Every new match must have a squad, so this is an
  exact line with no extra date column or cutoff to maintain.
- **Untagged players appear for both squads** in the picker until tagged (avoids anyone
  vanishing on day one). Under the hood: player squad NULL behaves like Both.
- **Storage shape:** a `squad` Postgres enum (`REDS`, `BLACKS`, `BOTH`); `player.squad` nullable
  (NULL = untagged ≈ Both); `fixture.squad` nullable, only `REDS`/`BLACKS` allowed by a CHECK
  (NULL = pre-split). Picked over a TEXT[] because there are exactly three states.
- **Squad is required for new matches** in the setup form (no default). Existing matches opened
  for editing are not forced to pick one.
- **Squad choice sits at the top of match setup**, before the player picker, so the list is
  filtered from the start. Changing squad after picking: players no longer eligible are removed
  from the selection, with a visible note.
- **Stats filter is client-param + server-param:** `/api/stats/team` and `/api/stats/players`
  accept an optional `squad` query param; the summary views gain a `squad` column (appended to
  the end of the view's column list so `CREATE OR REPLACE VIEW` works). Client-side match lists
  and heat map filter on `match.metadata.squad`.
- **Squad tag editing** lives where players are already managed (`PlayerInput` / player list),
  as a small Reds / Blacks / Both control per player.
- **Audit:** squad changes on player/fixture go through the existing audit path like other edits.
- **Stats dropdown remembers nothing** between visits (defaults to Overall). Cheap to change later.
- **Squad stats are match-based, not tag-based.** Under Reds/Blacks, the player table lists players
  who appeared in at least one of that squad's matches, with figures from those matches only. A
  player's tag doesn't decide whether they show; a player who moved squad shows under both. The
  view's `squad` column is the *fixture's* squad.
- **Overall must still sum across squads.** Adding `squad` to the summary views' grouping yields
  several rows per team/player; Overall aggregates them (note `getTeamSeasonSummary` currently
  does `LIMIT 1` — must change to a SUM, with a test proving Overall totals are unchanged).
- **A match's squad is editable after creation** (setup/confirm flow and match edit), audited like
  other fixture edits. Allows fixing a mis-tag; the pre-split matches are simply never tagged.
- **Same-day warning only sees saved matches** — it can't fire until the other squad's match exists.
- **Local-only (non-API) mode** carries squad in match metadata the same way, so filters behave the same.

## Left to the builder

- Exact UI styling of the squad control and dropdown (match existing Tailwind patterns and the
  brand palette).
- Where exactly each "X-Y" score render site is; find them all (stats match cards, Share as Photo,
  any summary views) and route through one helper, e.g. `formatScore(goalsFor, goalsAgainst, venue)`.
- How the duplicate-pick check gets same-day fixtures (existing `listMatches` data is fine).

## Follow-ups / backlog (not in this work)

1. **Reds vs Blacks as a single club match** (counted once in Overall).
2. **Security (deferred by user, judged low-risk for a small niche app):**
   - API has no server-side auth; login is client-side only with hashes in the bundle.
   - `/admin/migrate`, `/admin/seed-*`, `/admin/recalculate-stats` are open GETs.
   - CSRF token is a placeholder (existing tech debt C6).
   - `npm audit`: 1 critical + 4 high. Express sub-deps (`proxy-addr`, `body-parser`,
     `path-to-regexp`, `qs`) fixable via non-breaking `npm audit fix`; `xlsx` has no fix;
     `zod` fix is a major-version bump.
   - Check what recent Railway platform changes imply (not yet researched).
3. Optionally remember the last-used squad per device.
