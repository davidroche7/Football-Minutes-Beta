# Vercel Environment Variable Setup Guide

## Current Issue
Your app has NO environment variables configured in Vercel, causing:
- Data stored in browser localStorage only (not synced to database)
- Different browsers/devices show different data
- API features disabled

## Required Environment Variables

### 1. Go to Vercel Dashboard
https://vercel.com/dave-roches-projects/football-minutes-beta/settings/environment-variables

### 2. Add These Variables (for Production, Preview, and Development)

#### Frontend Variables (VITE_*)

```bash
# Enable API persistence (instead of localStorage only)
VITE_USE_API=true

# API base URL (use /api for same-domain deployment)
VITE_API_BASE_URL=/api

# Team UUID - IMPORTANT: Get this from your database!
# If you don't have a team yet, you need to create one first
VITE_TEAM_ID=YOUR-TEAM-UUID-HERE

# Session secret (MUST match FFM_SESSION_SECRET below)
VITE_SESSION_SECRET=your-random-32-char-secret-string-here

# Default actor roles
VITE_ACTOR_ROLES=coach,analyst
```

#### Backend Variables

```bash
# Database connection (Vercel Postgres)
POSTGRES_URL=your-vercel-postgres-connection-string

# OR if using DATABASE_URL
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE

# Session secret (MUST match VITE_SESSION_SECRET above)
FFM_SESSION_SECRET=your-random-32-char-secret-string-here

# Node environment
NODE_ENV=production
```

---

## Step-by-Step Setup

### Option A: Using Vercel CLI (Fastest)

```bash
# 1. Add frontend variables
vercel env add VITE_USE_API
# Enter: true
# Select: Production, Preview, Development

vercel env add VITE_API_BASE_URL
# Enter: /api
# Select: Production, Preview, Development

vercel env add VITE_SESSION_SECRET
# Enter: your-random-32-char-secret
# Select: Production, Preview, Development

vercel env add VITE_ACTOR_ROLES
# Enter: coach,analyst
# Select: Production, Preview, Development

# 2. Add backend variables
vercel env add FFM_SESSION_SECRET
# Enter: same-as-vite-session-secret
# Select: Production, Preview, Development

vercel env add POSTGRES_URL
# Enter: your-database-url
# Select: Production, Preview, Development (encrypted)

# 3. YOU NEED A TEAM ID - see section below
```

### Option B: Using Vercel Dashboard (Recommended for sensitive data)

1. Go to: https://vercel.com/dave-roches-projects/football-minutes-beta/settings/environment-variables
2. Click "Add New" for each variable
3. Select environments: Production, Preview, Development
4. For POSTGRES_URL, mark as "Encrypted"

---

## CRITICAL: Getting Your TEAM_ID

You need a team record in your database first!

### Check if you have a team:

```bash
# Connect to your Vercel Postgres database
vercel postgres --yes

# Query for teams
SELECT id, name, age_group FROM team;
```

### If NO teams exist, create one:

```sql
INSERT INTO team (id, name, age_group, created_at, updated_at)
VALUES (
  'YOUR-TEAM-UUID-HERE',  -- Generate at https://uuidgenerator.net
  'Your Team Name',
  'U12',  -- or whatever age group
  NOW(),
  NOW()
);
```

### Then use that team ID:

```bash
vercel env add VITE_TEAM_ID
# Enter: the-team-uuid-you-just-created
# Select: Production, Preview, Development
```

---

## After Adding Variables

### 1. Verify variables were added:

```bash
vercel env ls
```

You should see:
```
✓ VITE_USE_API
✓ VITE_API_BASE_URL
✓ VITE_TEAM_ID
✓ VITE_SESSION_SECRET
✓ VITE_ACTOR_ROLES
✓ FFM_SESSION_SECRET
✓ POSTGRES_URL (or DATABASE_URL)
```

### 2. Redeploy to pick up new environment variables:

```bash
vercel --prod
```

Or push a new commit (triggers auto-deploy):
```bash
git commit --allow-empty -m "chore: trigger redeploy with env vars"
git push origin main
```

### 3. Wait 1-2 minutes for deployment

### 4. Test the deployed app:
- Go to: https://football-minutes-beta.vercel.app
- Clear browser cache: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
- Check browser console for persistence mode:
  - Should say "API backend" instead of "Local storage"
  - Check in PlayerInput component (top of page)

---

## What This Will Fix

✅ **Data persistence**: All data saved to PostgreSQL database
✅ **Cross-browser sync**: Same data on all devices
✅ **GK selection fix**: Will now be visible in production
✅ **API features enabled**: Audit log, team stats, etc.

---

## Troubleshooting

### "Still showing Local storage mode"
- Hard refresh: Ctrl+Shift+R
- Check Vercel deployment logs: `vercel logs`
- Verify env vars: `vercel env ls`
- Check browser console for errors

### "Cannot connect to database"
- Verify POSTGRES_URL is correct
- Check database is accessible from Vercel
- Look at Vercel function logs

### "Team ID not found"
- Confirm team exists in database
- Verify VITE_TEAM_ID matches team.id exactly
- Check for UUID format (lowercase, with dashes)

### "Session authentication failed"
- Ensure FFM_SESSION_SECRET and VITE_SESSION_SECRET match exactly
- Both should be same random 32+ character string
- Redeploy after changing

---

## Security Notes

⚠️ **Never commit these to git!**
- Session secrets should be random 32+ char strings
- Database URLs contain passwords
- Use Vercel's "Encrypted" option for sensitive vars

Generate secure random secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Current Status After This Session

✅ Code deployed (commit e1af539)
✅ TypeScript build errors fixed
❌ Environment variables NOT configured yet
⏳ Waiting for you to add env vars in Vercel dashboard

**Once you add the environment variables and redeploy, everything will work!**
