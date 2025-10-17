## Requirements Snapshot

### Completed

- Authentication gate with PBKDF2 passwords, session storage, and logout controls.
- Configurable rules engine: defaults in `src/config/rules.ts`, overrides persisted via UI to localStorage.
- Match confirmation flow capturing opponent/date, fairness warnings, and audit history.
- Season stats dashboard with per-player rollups, GK tracking, and inline match edits.
- Legacy Excel importer (`npm run import:legacy`) that converts historic lineups/results into allocator-compatible JSON.

### In-Progress / Upcoming

1. Live rule propagation without page reload (allocator + UI contexts reacting to rule changes).
2. Persist rules and match data to backend API / shared database (replace localStorage stubs).
3. Wire importer output into the app (auto-populate Confirm Team flow / persistence once backend exists).
4. Extend season analytics (average minutes vs target, opponent summaries, export tooling).
5. Job scheduling / alerting for fairness warnings (surface to coaches before match day).
6. Phase 3: Post-game editing for on-field substitutions & stats (goals, Player-of-Match, honourable mentions).
7. Phase 4: Editable rules editor with validation + version history; future Tactics/Drills library.
