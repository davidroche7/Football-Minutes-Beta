# Tech & Product Debt Register

_Generated 2026-03-16 from parallel audit (Product, Architect, Dev, QA agents)_
_Last updated: 2026-03-16_

## Completed

| # | Item | Completed | Commit |
|---|------|-----------|--------|
| C1 | Player selection clutter — collapsed behind disclosure toggle | 2026-03-16 | fcff6ba |
| C2 | SeasonStatsView test fixtures — valid quarters, removed stale assertion | 2026-03-16 | fcff6ba |
| C5 | Mobile/tablet layout — responsive quarter cards, compact headers | 2026-03-16 | 0f99b53 |
| H2 | AllocationGrid DRY — extracted shared outfield slot renderer | 2026-03-16 | 0f99b53 |
| H3 | Magic numbers — replaced with CONFIG.QUARTER_DURATION / MAX_MINUTE_VARIANCE | 2026-03-16 | fcff6ba |
| H6 | Full-mode validation — slot count, no wave props, correct minutes checks + tests | 2026-03-16 | fcff6ba |
| H9 | Quarter-mode labels — "No subs" / "Sub halfway" | 2026-03-16 | fcff6ba |
| -- | Formation change — 1 DEF + 1 MID + 2 FWD, ATT→FWD rename, backwards compat | 2026-03-16 | 4116058 |
| -- | Copyright footer — © 2026 David Roche on login + main app | 2026-03-16 | 0f99b53 |

## Critical — Fix before next feature

| # | Item | Source | What | Where |
|---|------|--------|------|-------|
| C3 | App.tsx is a 1,174-line god component | Architect, Dev | 29 useState calls, all state + handlers in one file. Untestable, hard to refactor. | App.tsx |
| C4 | Zero test coverage on core workflows | QA | App.tsx, AllocationGrid, EditModal, ConfirmTeamModal — none have tests. Mode switching, sub-point changes, drag-drop all untested. | Multiple |

## High — Should do soon

| # | Item | Source | What | Where |
|---|------|--------|------|-------|
| H1 | Smart GK suggestion | Product, User | GK selector is fully manual with no stats context. Subsumed by Smart Allocation Phase 1-2 (see roadmap below). | GKSelector.tsx |
| H4 | SeasonStatsView is 1,704-line god component | Architect, Dev | Handles match CRUD, bulk import, stats aggregation, heatmap, sorting/filtering, edit modals — all in one file. | SeasonStatsView.tsx |
| H5 | Persistence layer has no schema validation on load | Architect, QA | JSON.parse() with no Zod validation. Corrupted localStorage silently crashes app. | persistence.ts:169 |
| H7 | Mode switching logic untested | QA | handleQuarterModeChange in App.tsx — summary recalculation, player deduplication, slot restructuring — zero test coverage. | App.tsx:379-467 |
| H8 | No localStorage quota handling | Architect | localStorage.setItem() without try/catch. Silently fails when storage full. | persistence.ts:161,328,372 |
| H10 | Persistence round-trip for quarterModes untested | QA | No test verifies save → load preserves allocation.quarterModes. Risk of modes resetting on refresh. | persistence.ts |

## Medium — Worth doing

| # | Item | Source | What | Where |
|---|------|--------|------|-------|
| M1 | Prop drilling depth | Architect | AllocationGrid takes 10 props. No context/reducer for allocation state. Every new feature adds more props. | App.tsx → children |
| M2 | Rules changes require page reload | Product, Architect | handleRulesSave calls window.location.reload(). Loses in-progress allocation. | App.tsx:679-682 |
| M3 | No undo for allocation edits | Product | Accidental swap/edit requires full re-generation. No history stack. | App.tsx:285-295 |
| M4 | No keyboard navigation for drag-drop | Dev, Product | AllocationGrid drag-drop is mouse-only. Accessibility gap. | AllocationGrid.tsx:52-116 |
| M5 | Missing aria-labels on controls | Dev | Sub-point stepper, mode toggle, wave selector buttons all lack aria-labels. | Multiple |
| M6 | Modals poor on mobile | Product | EditModal and ConfirmTeamModal use fixed full-screen overlay. Close button hard to tap, long scroll. | EditModal.tsx:67, ConfirmTeamModal.tsx:78 |
| M7 | PlayerSummary table cramped on mobile | Product | 4-column table with no responsive collapse. Q1+Q2+Q3+Q4 column unreadable on phone. | PlayerSummary.tsx:54-115 |
| M8 | Empty state cascade | Product, Dev | Empty roster shows 3 separate "nothing here" messages (active, removed, audit). Should be single onboarding state. | PlayerInput.tsx:328-495 |
| M9 | SeasonStatsView no filter/search | Product | All matches listed chronologically. No way to filter by opponent, date, result. | SeasonStatsView.tsx |
| M10 | Allocator doesn't consume live rules | Architect | CONFIG is static at module load. Rules changes only take effect after reload. | allocator.ts:5, constants.ts:43 |
| M11 | Error messages are jargon-heavy | Product | "Local fallback", "API unavailable" — coaches don't understand persistence modes. | PlayerInput.tsx:284-288 |
| M12 | No confirmation before saving unfair lineup | Product | Coach can save allocation with high variance without explicit acknowledgement. | ConfirmTeamModal.tsx:191-224 |
| M13 | Summary recalculation in 3 separate places | QA | handleQuarterModeChange, handleSubPointChange, and allocate() all recalculate summary independently. Risk of drift. | App.tsx:365-370,454-461, allocator.ts:160-163 |
| M14 | any types in RulesEngineView | Architect | Dynamic nested property access uses any cast, bypassing type safety. | RulesEngineView.tsx:67,80 |

## Low — Nice to have

| # | Item | Source | What | Where |
|---|------|--------|------|-------|
| L1 | 589KB JS bundle, no code splitting | Architect | SeasonStatsView, RulesEngineView never shown simultaneously but all in one chunk. | vite.config.ts |
| L2 | No data export (CSV/PDF) | Product | Coaches can't share end-of-season stats with parents. | SeasonStatsView.tsx |
| L3 | Sub-point stepper undiscoverable | Product | No tooltip or help text explaining what "Subs at: 5 min" means. | AllocationGrid.tsx:234-256 |
| L4 | Theme toggle buried, no tooltip | Product | Absolute-positioned in top-right corner with no label. | App.tsx:720-723 |
| L5 | Dark mode contrast gaps | Product, Dev | Some warning states (yellow) hard to read in dark mode. No WCAG audit done. | Multiple |
| L6 | Inconsistent button sizing | Dev | Sub-point buttons w-6 h-6, mode toggle px-2 py-1, EditModal px-4 py-2. | Multiple |
| L7 | Login page lacks onboarding context | Product | No explanation of what the app does for first-time users. | LoginForm.tsx |
| L8 | Roster test API noise | QA | roster.test.ts logs "API unavailable" fallback warnings on every run. Tests pass but output is noisy. | roster.test.ts |
| L9 | Unused TODO in AuditLogView | Dev | Commented-out filter prop. | AuditLogView.tsx:13 |
| L10 | Sequential API fetches | Architect | syncMatchesFromSource fetches matches then stats sequentially. Could be Promise.all. | App.tsx:162-206 |

---

## Smart Allocation Roadmap

_Designed 2026-03-16 by parallel agents (Data Science, Architecture, Product). Goal: evolve from fairness-only to fair AND competitive allocation using historical match data._

### Design Principles

1. **Fairness is the floor** — smart features work within the existing variance constraint, never override it.
2. **Suggestions, not mandates** — coach overrides always win. One tap to accept, one tap to dismiss.
3. **No child labelling** — frame as "experience at position" and "rotation balance", never talent/ability.
4. **Progressive disclosure** — coaches who ignore smart features get exactly today's experience.
5. **Pitchside speed** — if a feature adds >5 seconds to the pre-match flow, it has failed.

### Phase 1: Season-Aware Nudges (no allocator changes)

**What:** After allocation, show 1-3 insight cards between GK selector and AllocationGrid.

**Nudge types:**
- Season minutes balance: "Eli is 12 min below season average — getting above-average time today"
- GK rotation: "3 players haven't tried GK yet this season: Mia, Kai, Leo"
- Bench pattern: "Sam has been a sub in Q1 for the last 2 matches — starting today"

**Implementation:**
- New `useSeasonInsights(matches, allocation, players)` hook
- New `SeasonInsights` component (compact card, 1-3 lines)
- Show nothing with <2 saved matches
- Zero changes to allocator

**Subsumes:** H1 (Smart GK suggestion)

### Phase 2: Position Preference Memory (light allocator touch)

**What:** Allocator uses historical position distribution as a tiebreaker. Add per-player profiles.

**New types:**
- `PlayerProfile { name, positionPreferences, canPlayGK, notes? }`
- Position affinity derived from `heatMapUtils.ts` (already exists)

**Implementation:**
- Extend `allocate()` to accept optional `positionHistory` parameter
- Tiebreaker: when two players are equal on minutes, prefer the one with more time at the target position
- UI: small position chip next to each player name in AllocationGrid (e.g., faded "DEF" tag)
- Player profile editor (preferred position, can-play-GK toggle)

### Phase 3: Match Importance Toggle

**What:** Single segmented control: "Equal time" vs "Best lineup".

| Mode | Variance cap | Position weighting | GK policy |
|------|-------------|-------------------|-----------|
| Equal time (default) | 5 min | Light tiebreaker | Rotate evenly |
| Best lineup | 8 min (relaxed) | Heavy preference | Best available |

**Implementation:**
- Add `ScoringWeights` type to allocator context
- Replace greedy sort comparator with weighted scoring function
- Hidden/disabled until 3+ matches exist

### Phase 4: Full Scoring Function Architecture

**What:** Replace sort-based selection with `scoreCandidate(player, position, context)`.

**Context type:**
```
AllocationContext {
  manualGKs?, subPoints?, quarterModes?,
  playerProfiles?: Map<string, PlayerProfile>,
  seasonSnapshot?: SeasonSnapshot,
  scoringWeights?: ScoringWeights
}
```

**Scoring formula:**
```
compositeScore = (1 - w) * fairnessScore
               + w * (0.6 * positionFitScore + 0.4 * performanceScore)
```

**Cold start:** With no history, all weights evaluate to zero → identical to today's behaviour.

### Configurable Knobs (across all phases)

| Knob | Phase | Type | Default |
|------|-------|------|---------|
| Match importance toggle | 3 | Segmented: "Equal time" / "Best lineup" | Equal time |
| Position lock per slot | 2 | Lock icon on AllocationGrid slots | Unlocked |
| Season fairness strictness | 3 | Slider in RulesEngine | 5 min |
| GK rotation policy | 2 | Dropdown: Equal / Best / Manual | Equal |
| History window | 4 | Dropdown: Last 3 / Last 5 / Full season | Full season |

### Data Gaps to Close

| Data | Value | Phase to add |
|------|-------|-------------|
| Per-quarter goals (for/against) | Know which lineup was on when goals happened | Phase 3 |
| Player ratings per match (1-5) | Coach subjective input | Phase 2 |
| Assists | Half-built in API already | Phase 2 |
| Coach position preference per player | Explicit overrides | Phase 2 |

### Architecture Notes

- **Pre-computation:** `buildSeasonSnapshot(matches)` runs before allocation, not during. Keeps allocator fast and testable.
- **Output stability:** `Allocation` type never changes. All downstream (persistence, UI, validation) continues to work.
- **Testing:** Hard constraints (minutes total, variance, position counts) are property-based tests that always hold. Soft objectives (position fit) use statistical tests over multiple runs.
- **Migration:** Phase 1 is purely additive (new component). Phase 2 adds optional parameter. Phase 3 replaces sort comparator. Phase 4 is the architectural target. Each phase ships independently.
