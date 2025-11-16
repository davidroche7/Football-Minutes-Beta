# 🚂 Railway Deployment - EXACT STEPS

## Step 1: Create Railway Project (2 minutes)

1. Go to https://railway.app
2. Click **"Login"** → Sign in with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose repository: **`davidroche7/Football-Minutes-Beta`**
6. Railway will start deploying automatically

## Step 2: Add PostgreSQL Database (1 minute)

1. In your Railway project dashboard
2. Click **"+ New"** button
3. Select **"Database"**
4. Choose **"Add PostgreSQL"**
5. Railway automatically creates `DATABASE_URL` variable

## Step 3: Configure Environment Variables (2 minutes)

1. Click on your **web service** (Football-Minutes-Beta)
2. Go to **"Variables"** tab
3. Click **"+ New Variable"** and add each:

```
NODE_ENV=production
VITE_USE_API=true
VITE_USE_API_PERSISTENCE=true
VITE_API_BASE_URL=/api
VITE_SESSION_SECRET=change-this-to-random-32-char-string
VITE_ACTOR_ROLES=coach,analyst
```

**IMPORTANT**: Leave `VITE_TEAM_ID` blank for now (we'll add it in Step 5)

4. Click **"Deploy"** to trigger redeploy with new vars

## Step 4: Run Database Migration (1 minute)

1. Wait for deployment to finish (~2 minutes)
2. In Railway, click on your service
3. Click **"..."** menu → **"Terminal"** or **"Shell"**
4. Run this command:

```bash
node scripts/db/migrate.cjs
```

You should see:
```
→ Applying 0001_init.sql
✓ Applied 0001_init.sql
```

## Step 5: Create Team and Get UUID (1 minute)

Still in the Railway terminal, run:

```bash
node scripts/seed-team.cjs
```

You'll see output like:
```
Created team: { id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', name: 'Test Team' }
```

**COPY THAT UUID!** (the id value)

## Step 6: Add Team ID and Redeploy (1 minute)

1. Go back to **Variables** tab
2. Add new variable:
   - Name: `VITE_TEAM_ID`
   - Value: `<paste-the-uuid-from-step-5>`
3. Click **"Deploy"** again

## Step 7: Get Your URL and Test (1 minute)

1. Click **"Settings"** tab
2. Under **"Domains"**, you'll see your Railway URL like:
   `https://football-minutes-beta-production-XXXX.up.railway.app`
3. Click the URL to open your app!

## Step 8: Verify It Works

Visit these URLs (replace with your actual domain):

1. **Frontend**: `https://your-app.railway.app`
2. **API Health**: `https://your-app.railway.app/api/health`
3. **Players**: `https://your-app.railway.app/api/players?teamId=YOUR_TEAM_UUID`

You should see:
- Frontend loads
- "Persistence Mode: API" (not "Local fallback")
- Can create/edit players

---

## ⚡ Quick Checklist

- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Environment variables set (except TEAM_ID)
- [ ] Migration run successfully
- [ ] Team created, UUID copied
- [ ] VITE_TEAM_ID added
- [ ] App deployed and accessible
- [ ] API health check returns 200
- [ ] Can create players in UI

---

## 🐛 Troubleshooting

**"Module not found" errors**:
- Railway is using the wrong Node version
- Fix: Add to railway.json: `"nixpacks": {"packages": ["nodejs-20_x"]}`

**Database connection fails**:
- `DATABASE_URL` not set
- Fix: Railway should auto-set this when you add PostgreSQL

**"Persistence Mode: Local fallback"**:
- `VITE_TEAM_ID` not set or wrong
- `VITE_USE_API` not true
- Fix: Check Variables tab, redeploy

**500 errors on API**:
- Migration not run
- Fix: Run `node scripts/db/migrate.cjs` in Railway terminal

---

## 📞 Need Help?

1. Check Railway logs: Click service → "Deployments" → Latest → "View Logs"
2. Check build logs for errors
3. Check runtime logs for crashes

---

**Total time: ~8 minutes** 🚀
