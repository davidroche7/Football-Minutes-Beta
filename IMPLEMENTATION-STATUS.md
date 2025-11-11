# Implementation Status: GK Selection Fix + Audit Log Centralization

## Executive Summary

This document tracks the implementation of two major features for Football Minutes Beta:
1. **Fix player selection GK bug** ✅ COMPLETE
2. **Centralize audit logs** 🚧 IN PROGRESS (60% complete)

---

## Part 1: GK Selection Bug Fix ✅ COMPLETE

### Problem Statement
After login → Math setup → "Continue to player selection", users cannot select goalkeepers. They workaround by saving auto lineup then editing in Season Stats > Games.

### Root Cause
1. **Aggressive GK reset** (src/App.tsx:225): `setManualGKs(null)` was called on every player list change
2. **Redundant visibility guards**: Both App.tsx and GKSelector.tsx checked `players.length >= 5`
3. **Poor UX feedback**: Component disappeared instead of showing helpful message

### Implementation ✅

**Files Changed:**
- `src/App.tsx` (lines 222-246, 772-776)
- `src/components/GKSelector.tsx` (lines 28-57)
- `src/tests/setup.ts` (line 3)
- `src/components/GKSelector.test.tsx` (NEW - 265 lines, 16 tests)

**Key Changes:**
1. **Smart GK preservation** (App.tsx:227-232):
   ```typescript
   // Only reset manual GKs if selected GKs are no longer in the player list
   if (manualGKs) {
     const invalidGKs = manualGKs.some(gk => gk && !newPlayers.includes(gk));
     if (invalidGKs) {
       setManualGKs(null);
     }
   }
   ```

2. **Informative warning state** (GKSelector.tsx:28-36):
   ```typescript
   if (players.length < 5) {
     return (
       <div className="...yellow warning box">
         GK Selection: Select at least 5 players to enable goalkeeper assignment.
       </div>
     );
   }
   ```

3. **Simplified rendering logic** (App.tsx:772-776):
   - Removed conditional wrapper
   - GKSelector now always renders and manages its own visibility

4. **Comprehensive test coverage**:
   - Visibility transitions (3 tests)
   - GK selection interaction (4 tests)
   - Clear functionality (3 tests)
   - Accessibility (4 tests)
   - State persistence (2 tests)
   - **All 16 tests passing** ✅

**Test Results:**
```
✓ src/components/GKSelector.test.tsx (16 tests) 1353ms
  ✓ Visibility and warnings (3 tests)
  ✓ GK selection interaction (4 tests)
  ✓ Clear GK selection (3 tests)
  ✓ Accessibility (4 tests)
  ✓ State persistence (2 tests)

Test Files  1 passed (1)
Tests  16 passed (16)
```

---

## Part 2: Audit Log Centralization 🚧 60% COMPLETE

### Problem Statement
Per-game inline change logs are noisy and scattered. Need centralized audit log with:
- Filters & pagination
- RBAC (Coach/Admin only)
- Zero data loss migration from embedded game.changeLog[]

### Progress: 60% Complete

#### ✅ Completed (3/5 core components)

1. **Feature Flag System** ✅
   - File: `src/lib/featureFlags.ts`
   - Environment variable support (`VITE_FEATURE_*`)
   - localStorage overrides for testing
   - Debug utilities
   - Default: `auditLogCentralized = true`

2. **Enhanced Audit API Client** ✅
   - File: `src/lib/auditClient.ts`
   - Helper functions:
     - `fetchFixtureAuditEvents(fixtureId, limit)`
     - `fetchPlayerAuditEvents(playerId, limit)`
     - `fetchTeamAuditEvents(limit)`
   - Formatting utilities:
     - `formatAuditEventSummary(event)` → human-readable string
     - `formatAuditEventChanges(event)` → diff array

3. **AuditLogView Component** ✅
   - File: `src/components/AuditLogView.tsx`
   - Props: `entityType`, `entityId`, `limit`, `showFilters`, `className`
   - Features:
     - Loading/error states
     - Expandable change details
     - Feature flag gated
     - Empty state message

#### 🚧 In Progress (2/5 remaining)

4. **Migration of Inline Change Logs** 🔴 NOT STARTED
   - Location: `src/components/SeasonStatsView.tsx` (lines 1164-1178)
   - Task: Replace inline `editHistory` display with `<AuditLogView />`
   - Challenge: editHistory is local-only (not synced to API audit_event table)
   - **Requires decision:**
     - Option A: Show API audit events only (lose local editHistory)
     - Option B: Merge local editHistory + API events (complex)
     - Option C: Add backend endpoint to accept editHistory uploads

5. **Dedicated Audit Log Page** 🔴 NOT STARTED
   - New route: `/audit` or new tab in App.tsx
   - Features needed:
     - Date range filter
     - Actor filter
     - Entity type filter
     - Pagination (cursor-based)
   - RBAC: Only visible to Coach/Admin roles

#### ⏸️ Deferred (Not Critical for MVP)

6. **Data Migration Script** (Low Priority)
   - Why deferred: Backend already writes to `audit_event` table
   - Historical `game.editHistory` exists only in localStorage
   - Migration would only apply to local data
   - **Recommendation:** Document as "local data not migrated" in changelog

7. **Component Tests for AuditLogView** (Medium Priority)
   - Should be added before production deployment
   - Test cases:
     - Renders loading state
     - Renders error state
     - Displays events correctly
     - Expand/collapse works
     - Feature flag disables component

8. **RBAC Guards** (Medium Priority)
   - Current state: API enforces RBAC (api/audit/index.ts:17)
   - Frontend: No role checks yet
   - **Needed:**
     - Hide audit UI for non-coach/admin users
     - Show "Access Denied" message if unauthorized

---

## Next Steps (Prioritized)

### High Priority (MVP Blockers)

1. **Migrate inline change logs** (2-3 hours)
   - [ ] Read SeasonStatsView.tsx to understand current editHistory display
   - [ ] Replace with `<AuditLogView entityType="FIXTURE" entityId={match.id} />`
   - [ ] Handle feature flag: show old UI if `auditLogCentralized = false`
   - [ ] Test with real data from deployed API

2. **Add RBAC guards** (1 hour)
   - [ ] Create `useUserRole()` hook or import from auth
   - [ ] Wrap AuditLogView with role check
   - [ ] Show "Coach/Admin Only" message for viewers

3. **Create dedicated Audit Log page/tab** (2-3 hours)
   - [ ] Add new tab to App.tsx navigation (or create /audit route)
   - [ ] Implement filters (date, actor, entity type)
   - [ ] Add pagination controls
   - [ ] Style consistently with existing UI

### Medium Priority (Pre-Production)

4. **Add AuditLogView tests** (1-2 hours)
   - [ ] Create `src/components/AuditLogView.test.tsx`
   - [ ] Mock `fetchAuditEvents` API call
   - [ ] Test loading/error/empty/populated states
   - [ ] Test expand/collapse interaction

5. **Run full test suite** (30 min)
   - [ ] `npm test`
   - [ ] Fix any regressions
   - [ ] Verify TypeScript compilation: `npx tsc --noEmit`

### Low Priority (Post-MVP)

6. **Documentation** (2-3 hours)
   - [ ] `docs/PLAYER_SELECTION.md` - Lifecycle, state, common errors
   - [ ] `docs/AUDIT_LOG.md` - Schema, usage, RBAC, queries
   - [ ] `docs/MIGRATION_AUDIT_LOG.md` - How to run, verify, rollback (if needed)
   - [ ] Update `CHANGELOG.md` with user-facing notes

7. **Create PR** (1 hour)
   - [ ] Commit all changes
   - [ ] Write PR description with:
     - Root cause analysis
     - Before/after screenshots
     - Test results
     - Migration notes
   - [ ] Add Playwright E2E test (if time allows)

---

## Testing Strategy

### Unit Tests ✅
- [x] GKSelector.test.tsx (16 tests passing)
- [ ] AuditLogView.test.tsx (not created)
- [ ] featureFlags.test.ts (not created)

### Integration Tests 🔴
- [ ] Full player selection flow (Math Setup → GK selection → Save)
- [ ] Audit log displays fixture events correctly
- [ ] Feature flags control component visibility

### E2E Tests (Playwright) 🔴
- [ ] Smoke: Login → Math setup → Player selection → Select GK → Save → Refresh → Persists
- [ ] Audit: Make lineup change → View audit modal → Verify entry
- [ ] RBAC: Player role cannot see audit log

### Manual Testing Checklist 🔴
- [ ] Deploy to preview environment
- [ ] Test GK selection flow end-to-end
- [ ] Verify audit log shows real API data
- [ ] Confirm RBAC hides audit from players
- [ ] Check mobile responsiveness

---

## Rollback Plan

### If GK Selection has issues:
```bash
git revert <commit-hash>  # Revert App.tsx and GKSelector.tsx changes
```

### If Audit Log has issues:
1. Set feature flag: `localStorage.setItem('ffm:feature:auditLogCentralized', 'false')`
2. Or deploy with `VITE_FEATURE_AUDIT_LOG_CENTRALIZED=false`
3. Old inline change logs will still work

---

## Known Issues / Decisions Needed

1. **Local editHistory vs API audit_event mismatch**
   - Current: localStorage has `game.editHistory[]`, API has `audit_event` table
   - Impact: Switching to API audit log loses local-only history
   - **Decision needed:** Accept data loss or implement upload mechanism?

2. **Feature flag complexity**
   - Do we need per-team flags or global env vars sufficient?
   - Current: Global env vars (simple, good for MVP)

3. **Audit log pagination**
   - API supports `limit` param
   - No offset/cursor pagination yet
   - **For MVP:** Just show first 50-100 events

4. **Date range filtering**
   - API doesn't support date range queries yet
   - Would need backend enhancement
   - **For MVP:** Skip date filtering

---

## Files Modified

### Part 1: GK Selection ✅
- `src/App.tsx`
- `src/components/GKSelector.tsx`
- `src/tests/setup.ts`
- `src/components/GKSelector.test.tsx` (NEW)

### Part 2: Audit Log 🚧
- `src/lib/featureFlags.ts` (NEW)
- `src/lib/auditClient.ts` (enhanced)
- `src/components/AuditLogView.tsx` (NEW)
- **TODO:** `src/components/SeasonStatsView.tsx` (migrate inline logs)
- **TODO:** `src/App.tsx` (add audit log tab/page)

---

## Estimated Time to Complete

- **Part 1 (GK Selection):** ✅ Complete (invested: ~2 hours)
- **Part 2 (Audit Log) remaining:**
  - High priority tasks: 5-7 hours
  - Medium priority tasks: 3-4 hours
  - Low priority tasks: 3-4 hours
  - **Total:** 11-15 hours remaining

---

## Contact / Handoff Notes

**Implementation approach:** Incremental, feature-flagged rollout
**Testing philosophy:** Comprehensive unit tests, pragmatic E2E coverage
**Deployment strategy:** Preview → Monitor → Production flag flip

**Next session should start with:**
1. Review this document
2. Test GK selection fix in deployed app
3. Make decision on editHistory migration strategy
4. Implement high-priority remaining tasks

**Questions for product owner:**
1. Is losing local-only editHistory acceptable?
2. Do we need date filtering for MVP?
3. Should audit log be a tab or separate page?
4. Target release date?
