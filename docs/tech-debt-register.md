# Tech & Product Debt Register

_Generated 2026-03-16 from parallel audit (Product, Architect, Dev, QA agents)_

## Critical — Fix before next feature

| # | Item | Source | What | Where |
|---|------|--------|------|-------|
| C1 | Player selection clutter | Product, User | "Removed players" and "Roster changes" shown inline during match setup — takes up 40% of screen, irrelevant to match flow | PlayerInput.tsx:418-496 |
| C2 | SeasonStatsView test fixtures broken | QA | 2 failing tests caused by incomplete allocation in test fixtures (not a code bug). Blocks trust in test suite. | SeasonStatsView.test.tsx:110,165 |
| C3 | App.tsx is a 1,174-line god component | Architect, Dev | 29 useState calls, all state + handlers in one file. Untestable, hard to refactor. | App.tsx |
| C4 | Zero test coverage on core workflows | QA | App.tsx, AllocationGrid, EditModal, ConfirmTeamModal — none have tests. Mode switching, sub-point changes, drag-drop all untested. | Multiple |
| C5 | Mobile/tablet layout is cluttered | Product, User | Quarter mode toggles + sub-point stepper + quarter title overflow on small screens. Grid is md:grid-cols-2 with no tablet/phone optimisation. | AllocationGrid.tsx:182,209-256 |

## High — Should do soon

| # | Item | Source | What | Where |
|---|------|--------|------|-------|
| H1 | Smart GK suggestion | Product, User | GK selector is fully manual with no stats context. Could recommend based on GK appearance rate, normalised for games played. | GKSelector.tsx |
| H2 | AllocationGrid DRY violation | Dev | Near-identical slot rendering repeated 4 times (full/first-wave/second-wave/legacy). ~250 lines of duplication. | AllocationGrid.tsx:327-533 |
| H3 | Magic number 10 scattered everywhere | Dev | quarterDuration = 10 hardcoded in AllocationGrid, EditModal, ConfirmTeamModal, App.tsx instead of using CONFIG.QUARTER_DURATION. Same for variance 5. | Multiple files |
| H4 | SeasonStatsView is 1,704-line god component | Architect, Dev | Handles match CRUD, bulk import, stats aggregation, heatmap, sorting/filtering, edit modals — all in one file. | SeasonStatsView.tsx |
| H5 | Persistence layer has no schema validation on load | Architect, QA | JSON.parse() with no Zod validation. Corrupted localStorage silently crashes app. | persistence.ts:169 |
| H6 | validateAllocation() doesn't check full-mode structure | QA | No validation that full-mode quarters have 5 slots, no wave properties, all 10-min. Could accept corrupt data. | allocator.ts:427-490 |
| H7 | Mode switching logic untested | QA | handleQuarterModeChange in App.tsx — summary recalculation, player deduplication, slot restructuring — zero test coverage. | App.tsx:379-467 |
| H8 | No localStorage quota handling | Architect | localStorage.setItem() without try/catch. Silently fails when storage full. | persistence.ts:161,328,372 |
| H9 | "Same team" / "Make changes" labels unclear | Product | Non-obvious to first-time coaches. "Make changes" doesn't convey "two waves of substitution". | AllocationGrid.tsx:219,229 |
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

## User's original items mapped

| Your item | Maps to | Priority |
|-----------|---------|----------|
| 1. Removed players / roster changes clutter | C1 | Critical |
| 2. GK selection from player stats | H1 | High |
| 3. Mobile/tablet optimisation | C5, M6, M7, H2 | Critical/High |
