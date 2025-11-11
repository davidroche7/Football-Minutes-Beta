# Next Session - December 12, 2025

**Previous Session:** December 11, 2025 (Evening) - See SESSION-HANDOFF-DEC-11.md
**Status:** API endpoints blocked - CRITICAL FIX NEEDED
**Priority:** HIGH

---

## 🚨 URGENT: Critical Blocker

### The Problem
- App shows "API backend" mode badge ✅
- Environment variables are configured ✅
- **BUT**: API endpoints timeout (don't respond)
- **Result**: Data doesn't sync across browsers ❌

### Quick Assessment Needed (5 minutes)

Before starting, check Vercel Hobby plan function limits:
- If allows 15+ functions → Use **Option A** (Individual Functions)
- If limit is <15 functions → Use **Option D** (Fallback to localStorage)

---

## 🎯 Primary Objective for Today

**Get API endpoints working so data syncs across browsers.**

### Success Criteria
```bash
# This should return 200 OK with JSON:
curl https://football-minutes-beta.vercel.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-12-12T...","database":"connected"}
```

---

## ⚡ Quick Start - OPTION A (Recommended, 30-45 min)

### Step 1: Remove Express Wrapper (5 min)

```bash
cd /home/davidroche1979/Football-Minutes-Beta

# Remove the broken wrapper
git rm api/index.ts

# Fix .vercelignore - only exclude tests
cat > .vercelignore << 'EOF'
# Exclude tests only
**/*.test.ts
**/*.test.tsx
**/*.spec.ts

# Exclude dev files
.env
.env.local
*.log
EOF

# Simplify vercel.json - remove rewrites
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build"
}
EOF

# Commit and deploy
git add -A
git commit -m "fix: deploy individual Vercel functions (native pattern)

Removes Express wrapper that was causing API timeouts.
Returns to Vercel's native serverless function pattern where
each api/*.ts file becomes a separate function.

Fixes:
- .vercelignore to only exclude tests (was excluding all api files)
- vercel.json to remove /api rewrite rule
- Deletes api/index.ts wrapper

This should fix API endpoints and enable database persistence.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

### Step 2: Wait and Test (10 min)

```bash
# Wait for deployment
echo "Waiting 60 seconds for deployment..."
sleep 60

# Check deployment status
vercel ls | head -5

# Test health endpoint (should respond in <2 seconds)
time curl -s https://football-minutes-beta.vercel.app/api/health

# Expected output:
# {"status":"ok","timestamp":"...","database":"connected"}
# real    0m0.8s
```

### Step 3: Verify in App (5 min)

1. Open: https://football-minutes-beta.vercel.app
2. Hard refresh: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
3. Check "Persistence Mode" badge in Squad Selection → Should say **"API backend"**
4. Add test player: "TEST PLAYER 999"
5. Open incognito mode
6. Login with same credentials
7. **✅ SUCCESS**: "TEST PLAYER 999" should appear in incognito

### Step 4: Test All Endpoints (5 min)

```bash
# Health
curl -i https://football-minutes-beta.vercel.app/api/health

# CSRF
curl -i https://football-minutes-beta.vercel.app/api/session/csrf

# Players (empty array initially)
curl -i https://football-minutes-beta.vercel.app/api/players

# Fixtures (empty array initially)
curl -i https://football-minutes-beta.vercel.app/api/fixtures

# Team stats
curl -i https://football-minutes-beta.vercel.app/api/stats/team
```

All should return 200 OK with JSON (not timeout).

### Step 5: Migrate Data (15 min)

**Only do this AFTER confirming API works!**

User has complete localStorage backup. Need to migrate:
1. Roster (players with squad numbers, positions)
2. Matches (with results, goals, POTM, lineups)

Options:
- Manual: POST each item via curl
- Script: Create migration script in `scripts/migrate-data.ts`
- UI: Build migration button in app

---

## 🔄 Alternative - OPTION D (Fallback, 5 min)

If Option A fails or takes too long:

### Quick Fallback to localStorage Mode

```bash
# In Vercel dashboard:
# Project → Settings → Environment Variables
# Find: VITE_USE_API
# Change value: "true" → "false"
# Click: Save

# Trigger redeploy
git commit --allow-empty -m "redeploy: fallback to localStorage mode temporarily"
git push origin main

# Wait 60 seconds, then test
sleep 60
curl https://football-minutes-beta.vercel.app/

# App will work immediately in localStorage mode
# User can continue using while we debug API separately
```

**Pros:**
- User unblocked immediately
- Zero risk
- Buys time for proper API debugging

**Cons:**
- No cross-browser sync (but that's current state anyway)
- Delays database feature

---

## 📝 Complete Checklist

### Pre-Session (5 min)

- [ ] Read SESSION-HANDOFF-DEC-11.md (comprehensive handoff doc)
- [ ] Check Vercel function limits
- [ ] Decide: Option A or Option D
- [ ] Confirm user has localStorage backup file

### Option A Implementation (30-45 min)

**Configuration:**
- [ ] Remove api/index.ts
- [ ] Fix .vercelignore (exclude only tests)
- [ ] Simplify vercel.json (remove rewrite)
- [ ] Commit and push

**Testing:**
- [ ] Wait 60 seconds for deployment
- [ ] Test /api/health (should return 200 OK)
- [ ] Test /api/session/csrf
- [ ] Test /api/players
- [ ] Test /api/fixtures
- [ ] Test /api/stats/team

**App Verification:**
- [ ] Hard refresh main app
- [ ] Check "API backend" badge shows
- [ ] Add test player in normal browser
- [ ] Verify test player in incognito mode
- [ ] Verify test player in different browser
- [ ] Confirm cross-browser sync works

**Data Migration:**
- [ ] Plan migration approach
- [ ] Migrate roster from backup
- [ ] Migrate matches from backup
- [ ] Verify all data appears correctly
- [ ] Test all app features end-to-end

### Option D Implementation (5 min)

- [ ] Set VITE_USE_API=false in Vercel dashboard
- [ ] Trigger redeploy
- [ ] Verify app works in localStorage mode
- [ ] Schedule separate API debugging session

### Post-Implementation

- [ ] Run test suite: `npm test`
- [ ] Update this file with results
- [ ] Tag stable version: `git tag v0.2.0`
- [ ] User acceptance testing

---

## 📚 Key Reference Files

**Must Read:**
- **SESSION-HANDOFF-DEC-11.md** - Complete session summary and troubleshooting notes

**API Examples:**
- **api/health.ts** - Working Vercel function (use as template)
- **api/players/index.ts** - Players CRUD
- **api/fixtures/index.ts** - Fixtures CRUD

**Configuration:**
- **.vercelignore** - What gets deployed
- **vercel.json** - Build config
- **src/config/environment.ts** - How env vars work

**Data:**
- **public/migrate-data.html** - Export/import tool
- **LINEUP-DATA-VERIFICATION.md** - Data structure reference

---

## ✅ What's Already Working

- GK selection (fixed + tested)
- localStorage persistence
- Complete data export (v2.0)
- Environment variables in build
- Frontend shows correct mode
- All TypeScript compilation
- All tests passing (16 GK tests)

## ❌ What's Blocked

- API endpoints (timeout)
- Database persistence
- Cross-browser sync

---

## 🚀 Expected Timeline

| Time | Task | Status |
|------|------|--------|
| +0m | Read handoff doc | 📖 |
| +5m | Remove Express wrapper | ⚙️ |
| +10m | Deploy and wait | ⏳ |
| +15m | Test API endpoints | 🧪 |
| +20m | Verify app sync | ✅ |
| +30m | Plan data migration | 📋 |
| +45m | Migrate data | 🔄 |
| +60m | **COMPLETE** | 🎉 |

---

## 🎓 Key Learnings from Last Session

1. **Express + Vercel is tricky** - Not straightforward to wrap Express app as serverless function
2. **Individual functions = standard** - Vercel's native pattern is most reliable
3. **.vercelignore matters** - `api/*` excludes subdirectories too!
4. **Data safety first** - Always export backup before risky changes

---

## 💡 Troubleshooting Quick Reference

### If API Still Times Out

```bash
# Check if functions deployed
vercel inspect [deployment-url] | grep "Serverless Functions"

# View logs
vercel logs https://football-minutes-beta.vercel.app --since 5m

# Test specific deployment
curl https://football-minutes-beta-[hash].vercel.app/api/health
```

### If Functions Not Found (404)

```bash
# Check .vercelignore didn't exclude them
cat .vercelignore

# Check files exist
ls -la api/

# Check vercel.json isn't redirecting
cat vercel.json
```

### If Database Connection Fails

```bash
# Check env vars in deployment
vercel env ls

# Check if POSTGRES_URL exists
# (Should be auto-added by Vercel Postgres)
```

---

## 📞 Quick Commands

```bash
# Status check
cd /home/davidroche1979/Football-Minutes-Beta
git status
git log --oneline -5
vercel ls | head -5

# Test API
curl -i https://football-minutes-beta.vercel.app/api/health

# View logs
vercel logs https://football-minutes-beta.vercel.app --since 10m

# Redeploy
git commit --allow-empty -m "redeploy"
git push origin main
```

---

**Status:** Ready for pickup
**Priority:** HIGH - User blocked on database sync
**Time Estimate:** 30-60 minutes (Option A) or 5 minutes (Option D)
**Success Metric:** API /health endpoint returns 200 OK

**Good luck! 🚀**
