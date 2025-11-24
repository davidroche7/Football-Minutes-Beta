# Next Session Handoff - UI Polish & Codebase Cleanup

**Last Updated:** 2025-11-24
**Status:** ✅ Production deployed and working on Railway
**URL:** https://web-production-a2ee4.up.railway.app/

---

## 🎯 Quick Start for Next Session

1. **Review this document** - understand current state and priorities
2. **Check Railway deployment** - verify app is still running: https://web-production-a2ee4.up.railway.app/api/health
3. **Pull latest code**: `git pull origin main`
4. **Review cleanup tasks** below - prioritize lean codebase work
5. **Run locally** (if needed):
   ```bash
   npm run dev  # Starts both frontend (3000) and backend (3001)
   ```

---

## ✅ What's Working (Production)

### Core Features
- ✅ **Next Match** - Allocate players to quarters with drag-and-drop
- ✅ **Post-Save Summary** - Clean Matchday Overview with navigation buttons
- ✅ **Season Stats** - Sortable player stats table, expandable fixtures
- ✅ **Fixture Deletion** - Delete matches with cascade + confirmation modal
- ✅ **Management Tab** - Player roster, rules engine, audit log
- ✅ **Dark/Light Mode** - Toggle in top-right corner, persists to localStorage
- ✅ **Edit Slot** - Canonical modal shows only match players (both tabs)

### Recent Accomplishments (This Session - 11 Commits)

**Functional Fixes:**
1. **Edit Slot player filtering** - Season Stats modal now shows only players selected for that match
2. **Fixture deletion** - Complete DELETE endpoint with cascade, confirmation modal, audit logging
3. **Stats table filtering** - Players with 0 matches hidden (removes test players)

**UI/UX Polish:**
4. **Removed AI elements** - 13 emojis from README, warning emoji from errors, verbose copy simplified
5. **Dark/light mode toggle** - Icon-only button in top-right, binary toggle (removed system mode)
6. **Dark mode fullscreen** - Fixed white borders, now fills entire viewport
7. **Copy cleanup** - "fair playing time" → "playing time" throughout
8. **Login security** - Removed sample credentials from login page and README
9. **Sortable stats table** - Click any column header to sort (7 columns)
10. **Removed meaningless columns** - Target Minutes and Balance removed from stats
11. **Post-save UX** - Auto-scroll to top, collapse editing UI, show clean summary + navigation

**Documentation:**
12. **USER-GUIDE.md** - Comprehensive guide for new coaches (UK English, practical)

**Commits:**
- `80195de` - Edit Slot + fixture deletion
- `fb9ddb5` - Remove AI UI elements + dark mode
- `8e9a5b9` - Dark mode fullscreen + simplify toggle
- `6ab5b83` - Remove sample credentials
- `cf6d6ef` - Sortable stats + remove columns
- `95154c1` - Filter 0-match players
- `cb4cea0` - Post-save UX improvements
- `6204c69` - Add user guide

---

## 🧹 PRIORITY: Cleanup Tasks for Next Session

### Goal: Lean, Clean Codebase

**Focus:** Remove defunct code, consolidate documentation, fix annoying UI/UX issues

### 1. Defunct Documentation to Review/Remove

**Candidates for deletion:**
- `DEPLOYMENT-READY.md` - Outdated (pre-Railway deployment)
- `HANDOVER-TESTING-SESSION.md` - Old handoff, no longer relevant
- `docs/DEVELOPMENT.md` - May be outdated, check against current setup
- `docs/DEPLOYMENT.md` - May be outdated, check against Railway setup
- `docs/adr/*.md` - Review Architecture Decision Records for relevance

**Keep:**
- `README.md` - Main documentation (update to match current state)
- `NEXT-SESSION.md` - This file (always current)
- `USER-GUIDE.md` - Coach-facing guide (fresh)
- `.env.example` - Environment variable template

**Action:** Review each file, consolidate useful info into README, delete rest

### 2. Unused Code to Identify

**Areas to investigate:**
- Unused imports in components
- Dead code paths (feature flags that are always true/false)
- Commented-out code blocks
- Duplicate utility functions
- Unused CSS classes

**Tools:**
```bash
# Find unused exports
npx ts-prune

# Find dead code
npm run build -- --stats
```

### 3. Debug Logging Cleanup

**Issue:** 20+ console.log statements in `server/server.ts` (fixture endpoints)

**Action:**
- Create debug logger utility (e.g., `debug()` function)
- Gate behind `DEBUG=true` env var
- Replace console.log with conditional debug()
- Keep error logging (console.error)

**Files:** `server/server.ts:207-267`

### 4. Bundle Size Optimization

**Current:** 575kb (warning threshold: 500kb)

**Suggestions:**
- Analyze bundle: `npx vite-bundle-visualizer`
- Split large components (SeasonStatsView is 1400+ lines)
- Lazy load tabs: `const SeasonStatsView = lazy(() => import('./SeasonStatsView'))`
- Extract vendor chunks

---

## 🐛 Known UI/UX Issues to Fix

### High Priority

**User reported issues to investigate:**
1. **TBD** - User will provide specific styling bugs/inconsistencies after data cleanup
2. **TBD** - Additional UI annoyances to be identified

### Medium Priority

**Potential improvements:**
- Responsive design issues (mobile/tablet testing needed)
- Loading states for slow API calls
- Better error messages (more specific, actionable)
- Toast notifications instead of banner messages

### Low Priority

**Nice-to-haves:**
- Audit log filters (date range, actor, event type)
- Print stylesheet for match allocations
- Keyboard shortcuts for common actions

---

## 🔒 Security Backlog (For Later Sessions)

### Authentication System
**Location:** `server/server.ts:51`, `src/lib/auth.ts`
**Issue:** Placeholder session auth, no real login/logout

**TODO:**
- Design auth flow (session vs JWT)
- Add login/logout endpoints
- Implement bcrypt password hashing
- Update `getActorId()` to read from session
- Add middleware to protect routes

### CSRF Token Implementation
**Location:** `server/server.ts:85-93`
**Issue:** Returns hardcoded `'dev-token'`

**TODO:**
- Implement real CSRF token generation
- Validate token on mutation requests
- Update `apiClient.ts` to send token in header

### Remove Temporary Admin Endpoints
**Location:** `server/server.ts:78-82`
**Endpoints:**
- `GET /admin/migrate`
- `GET /admin/seed-team`
- `GET /admin/seed-ruleset`
- `GET /admin/recalculate-stats`

**TODO:** Verify production DB is set up, then remove all 4 endpoints

---

## 📊 Current Codebase Stats

### Files & Lines
- **Frontend:** 63 modules, 575kb bundle
- **Backend:** 49.6kb bundle
- **Total components:** ~15 React components
- **Largest file:** SeasonStatsView.tsx (1400+ lines)

### Code Quality
- **TypeScript:** No errors
- **Console.logs:** 20+ in backend (fixture endpoints)
- **TODOs in code:** 3 remaining
  - `server/server.ts:51` - Extract actorId from session
  - `server/server.ts:87` - Implement real CSRF token
  - `src/components/AuditLogView.tsx:13` - Implement filters

### Test Coverage
- Unit tests exist for core components
- No end-to-end tests
- Manual testing verified all features working

---

## 🗂️ Database State

### Current Stats
- **Team ID:** `a0b6a1d3-19d7-4630-8b67-eaa8c33e4765`
- **Players:** ~15 (includes active + removed)
- **Fixtures:** Multiple matches (user will clean up test data)
- **Audit Events:** 22+ (~104 kB)
- **Schema Version:** 0001_init.sql (latest)

### Key Tables
- `team` - 1 row
- `player` - ~15 rows
- `fixture` - Multiple matches
- `lineup_quarter` - 500+ rows
- `audit_event` - 22+ rows
- `ruleset` - 1 active ruleset

---

## 🎯 Recommended Next Session Plan

### Phase 1: Codebase Cleanup (1-2 hours)
1. **Documentation audit** - Review and delete/consolidate stale docs
2. **Code cleanup** - Remove unused imports, dead code, debug logging
3. **Bundle optimization** - Analyze and split large components if needed

### Phase 2: UI/UX Polish (1-2 hours)
4. **User feedback** - Get specific styling bugs/annoyances after data cleanup
5. **Fix UI issues** - Address reported styling inconsistencies
6. **Responsive testing** - Test on mobile/tablet, fix issues
7. **Polish rough edges** - Improve loading states, error messages, etc.

### Phase 3: Final Testing
8. **Smoke test all features** - Ensure zero regression from cleanup
9. **Deploy to Railway** - Push cleaned-up codebase
10. **Update documentation** - Reflect any changes made

---

## 🔗 Important URLs

### Production
- **Live App:** https://web-production-a2ee4.up.railway.app/
- **Health Check:** https://web-production-a2ee4.up.railway.app/api/health

### Railway Dashboard
- **Project:** https://railway.app/project (login required)
- **Logs:** Railway dashboard → Service → Logs tab
- **Env Vars:** Railway dashboard → Service → Variables tab

### Database
- **Neon Dashboard:** https://console.neon.tech/
- **Connection String:** See `.env` file (not committed)

---

## 📝 Recent Commits (Last 8)

```
6204c69 - docs: Add comprehensive user guide for coaches
cb4cea0 - feat: Improve post-save UX with auto-scroll and clean summary view
95154c1 - fix: Hide players with 0 matches from stats table
cf6d6ef - feat: Add sortable player stats table, remove Target Minutes and Balance
6ab5b83 - security: Remove sample account credentials from login page
8e9a5b9 - fix: Dark mode fullscreen, simplify theme toggle, update copy
fb9ddb5 - refactor: Remove AI-looking UI elements and add dark/light mode toggle
80195de - fix: Edit Slot player filtering and implement fixture deletion
```

---

## 💡 Tips for Next Session

1. **Start with cleanup** - Fresh codebase makes UI work easier
2. **Use ts-prune** - Find unused exports quickly
3. **Check bundle analyzer** - Visualize what's taking up space
4. **Test on mobile** - Many UI issues only appear on small screens
5. **Ask user for specifics** - Get concrete examples of UI annoyances

---

## 🚀 Session Completion Checklist

Before ending next session, update this document:
- [ ] Update "What's Working" with new features
- [ ] Remove completed cleanup tasks
- [ ] Add any new backlog items discovered
- [ ] Update "Recent Commits" section
- [ ] Commit: `git add NEXT-SESSION.md && git commit -m "docs: Update handoff"`

---

**End of Handoff Document**
