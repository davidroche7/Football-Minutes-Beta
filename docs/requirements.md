## Requirements Snapshot

### Completed

- Authentication gate with PBKDF2 passwords, session storage, and logout controls.
- Configurable rules engine: defaults in `src/config/rules.ts`, overrides persisted via UI to localStorage.
- Match confirmation flow capturing opponent/date/venue/result details with fairness warnings and audit history.
- Auto-seeded roster + match history from the legacy Excel (`npm run import:legacy` populates `data/imported-matches.json` and loads on boot).
- Season stats dashboard with season snapshot, player goals/POTM/honorable mentions, audit feed, and editable quarter-by-quarter allocations.
- Roster management UI (add/remove/restore) shared between match setup and season stats views.
- Team-scoped audit API with frontend event normalisation (prevents cross-team leakage and resolves roster log naming).

### In-Progress / Upcoming

1. Finish backend wiring for roster/match persistence (ensure all refresh paths respect active `teamId`, add CSRF & auth middleware).
2. Live rule propagation without page reload (allocator + UI contexts reacting instantly to rule changes).
3. Expand match analytics (minute deltas to target, opponent summaries, downloadable reports).
4. Add fairness warnings and variance alerts to the match day dashboard (proactive notifications).
5. Introduce tactics/drills library & advanced planning (Phase 4) once persistence is live.
