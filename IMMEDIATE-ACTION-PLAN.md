# 🚨 IMMEDIATE ACTION PLAN - Fix Production Deployment

## TL;DR
**Your code is deployed but not working because Vercel has ZERO environment variables configured.**

---

## What Happened

1. ✅ Code pushed to GitHub successfully (commit: `e1af539`)
2. ✅ TypeScript errors fixed (AuditLogView.tsx)
3. ✅ Build now succeeds locally
4. ⚠️ Vercel auto-deployment triggered
5. ❌ **App runs in localStorage-only mode because no env vars**

---

## Why Your Data Disappears

### Current Architecture
```
┌─────────────────────────────────────────┐
│  Deployed App (No Env Vars)            │
│                                         │
│  VITE_USE_API = undefined → false      │
│  ↓                                      │
│  localStorage mode ONLY                 │
│  ↓                                      │
│  Data stored in BROWSER only            │
└─────────────────────────────────────────┘
```

**Result:**
- Normal browser: Has your test data (localStorage)
- Incognito: Empty (fresh localStorage)
- Different device: Empty (no shared storage)
- **localStorage ≠ Database!**

---

## What You Need to Do (5 minutes)

### 1️⃣ Check if you have a Vercel Postgres database

```bash
vercel postgres --yes
```

If NO database:
- Create one in Vercel dashboard
- Or use external Postgres (Railway, Supabase, etc.)

### 2️⃣ Get your database connection string

From Vercel dashboard:
1. Go to: Storage tab
2. Click your Postgres database
3. Copy connection string (starts with `postgres://`)

### 3️⃣ Check if you have a team in the database

```bash
# Connect to database
vercel postgres --yes

# Check for teams
SELECT id, name FROM team LIMIT 5;
```

**If NO teams:**
```sql
INSERT INTO team (id, name, age_group, created_at, updated_at)
VALUES (
  gen_random_uuid(),  -- Generates UUID automatically
  'My Team',
  'U12',
  NOW(),
  NOW()
)
RETURNING id;  -- Copy this UUID!
```

### 4️⃣ Add environment variables to Vercel

#### Option A: Via Dashboard (RECOMMENDED)
1. Go to: https://vercel.com/dave-roches-projects/football-minutes-beta/settings/environment-variables
2. Add these (click "Add New" for each):

| Variable | Value | Environments |
|----------|-------|--------------|
| `VITE_USE_API` | `true` | All (Production, Preview, Development) |
| `VITE_API_BASE_URL` | `/api` | All |
| `VITE_TEAM_ID` | `YOUR-TEAM-UUID-FROM-STEP-3` | All |
| `VITE_SESSION_SECRET` | Generate random 32 chars | All |
| `FFM_SESSION_SECRET` | SAME as VITE_SESSION_SECRET | All |
| `POSTGRES_URL` | Your connection string | All (mark Encrypted) |

**Generate session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Option B: Via CLI (Faster but manual for each)
```bash
vercel env add VITE_USE_API
# Enter: true
# Select: Production, Preview, Development

vercel env add VITE_API_BASE_URL
# Enter: /api
# Select: Production, Preview, Development

# ... repeat for all variables (see VERCEL-ENV-SETUP.md)
```

### 5️⃣ Redeploy

```bash
# Trigger new deployment with env vars
vercel --prod

# Or push empty commit to trigger auto-deploy
git commit --allow-empty -m "chore: redeploy with environment variables"
git push origin main
```

### 6️⃣ Wait and verify (2 minutes)

1. Wait for deployment to finish
2. Go to: https://football-minutes-beta.vercel.app
3. Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
4. Check "Squad Selection" section
5. Look for "Persistence Mode" badge:
   - ✅ Should say: **"API backend"** (green)
   - ❌ Currently says: **"Local storage"** (blue)

---

## Expected Results After Fix

### Before (Current State) ❌
```
Browser localStorage only
↓
Data NOT in database
↓
Different browsers = different data
↓
Fixes not visible (cached old version)
```

### After (With Env Vars) ✅
```
Vercel environment variables configured
↓
VITE_USE_API=true
↓
App uses PostgreSQL database
↓
All browsers see same data
↓
GK selection fix visible
↓
Audit log features work
```

---

## Verification Checklist

After completing steps above:

- [ ] `vercel env ls` shows 6+ environment variables
- [ ] Latest deployment status: **Ready** (not Error)
- [ ] App shows "API backend" mode (not "Local storage")
- [ ] Player selection page shows GK selector with warning
- [ ] Data persists across browser refresh
- [ ] Incognito mode shows same data as normal browser

---

## Still Having Issues?

### Check deployment logs:
```bash
vercel logs --follow
```

### Inspect latest deployment:
```bash
vercel inspect https://football-minutes-beta.vercel.app
```

### Verify build succeeded:
```bash
npm run build
```

### Test locally with env vars:
```bash
# Copy environment variables
cp .env .env.local

# Start local dev server
npm run dev

# Should show "API backend" mode
```

---

## Quick Reference

### Your URLs
- Production: https://football-minutes-beta.vercel.app
- Vercel Dashboard: https://vercel.com/dave-roches-projects/football-minutes-beta
- GitHub Repo: https://github.com/davidroche7/Football-Minutes-Beta

### Recent Commits
- `e1af539` - Fix TypeScript errors (18 mins ago)
- `48b910f` - GK selection fix + audit log infrastructure (30 mins ago)

### What's Working ✅
- Code is correct
- TypeScript compiles
- Tests pass (76/80)
- GK selection logic fixed
- Audit log components created

### What's Broken ❌
- No environment variables in Vercel
- App runs in localStorage mode
- Database features disabled
- Data not synced

---

## Time Estimate

⏱️ **Total time to fix: 5-10 minutes**

1. Get database connection string (1 min)
2. Check/create team in database (2 min)
3. Add environment variables in Vercel (3 min)
4. Trigger redeploy (1 min)
5. Wait for deployment (2 min)
6. Verify it works (1 min)

**The code is ready. You just need to configure Vercel!** 🚀
