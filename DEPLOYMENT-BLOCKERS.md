# Deployment Blockers - Session End

## Critical Issue: Frontend Not Getting Environment Variables

### The Problem
Despite setting VITE_* environment variables in Railway dashboard and triggering rebuilds, the frontend build is NOT getting the environment variables baked in. App keeps showing "Local fallback" instead of "API persistence".

### What We Know Works
- ✅ Backend API fully functional: https://web-production-a2ee4.up.railway.app/api/health
- ✅ Database working with 2 players and ruleset
- ✅ All API endpoints tested and working
- ✅ Backend serves static files correctly
- ✅ CORS configured properly (same-origin)

### What's NOT Working
- ❌ Frontend build doesn't have VITE_USE_API=true
- ❌ Frontend build doesn't have VITE_TEAM_ID
- ❌ App falls back to localStorage
- ❌ Railway rebuild doesn't seem to pick up VITE_* variables

### Environment Variables Set in Railway
```
VITE_USE_API=true
VITE_USE_API_PERSISTENCE=true
VITE_API_BASE_URL=/api
VITE_TEAM_ID=a0b6a1d3-19d7-4630-8b67-eaa8c33e4765
VITE_ACTOR_ROLES=coach,analyst
VITE_SESSION_SECRET=LBonw3o6W5trcCp97VLs72NcmAGJVTchrVwXFgVTkXA=
```

### Theories to Investigate Next Session

1. **Railway might not expose VITE_* during build**
   - Railway may strip env vars with certain prefixes
   - Nixpacks build might not pass them through
   - Need to check Railway build logs

2. **Build order issue**
   - Frontend builds before env vars are available
   - May need to modify nixpacks.toml or railway.json

3. **Vite environment loading**
   - Vite might need explicit env file in production
   - May need to create .env.production file

4. **Alternative approach needed**
   - Runtime configuration instead of build-time
   - Inject config via window object in index.html
   - Use a config endpoint instead of env vars

### Quick Diagnostic Steps for Next Session

1. **Check Railway build logs**
   ```
   Look for: "VITE_USE_API" in build output
   Verify: Environment variables are visible during build
   ```

2. **Test check-env.html**
   ```
   Visit: https://web-production-a2ee4.up.railway.app/check-env.html
   Expected: All VITE_* variables should show as "SET"
   Actual: Probably shows "NOT SET"
   ```

3. **Try runtime config approach**
   - Create config.js that gets loaded at runtime
   - Inject from backend during HTML serve
   - More reliable than build-time env vars

### Files Changed This Session
- `server/server.ts` - Express serves frontend, SPA routing
- `server/routes/admin.ts` - Added seedRuleset endpoint
- `vite.config.ts` - Build output to dist-vite/
- `package.json` - Build script copies to dist/public/
- `.gitignore` - Added dist/ and dist-vite/

### Database State
- Team ID: `a0b6a1d3-19d7-4630-8b67-eaa8c33e4765`
- 2 Players: John Doe (#10), Test Player 2 (#7)
- 1 Ruleset: Default Rules (active)
- All tables migrated successfully

### What NOT to Do Next Session
- ❌ Don't try more Railway redeployments without fixing env var issue
- ❌ Don't test from localhost:3000 (CORS issues)
- ❌ Don't add more admin endpoints (we have enough)

### Recommended Next Steps

**Option A: Fix Railway env vars (preferred)**
1. Check Railway documentation for VITE_* variable handling
2. Review build logs to see if vars are present
3. Modify nixpacks.toml if needed
4. Test with simple console.log in vite.config.ts

**Option B: Runtime configuration (backup)**
1. Remove dependency on VITE_* build-time vars
2. Create /api/config endpoint that returns team/env config
3. Load config at app startup
4. More flexible, works with any deployment platform

**Option C: Different deployment platform**
- Vercel handles env vars better (but has other issues we abandoned)
- Netlify might be simpler
- Plain VPS with manual deployment

### Reality Check
This "simple" app has taken weeks because:
1. Multiple deployment platform switches (Vercel → Railway)
2. Architecture changes (serverless → Express)
3. CORS/cookie issues with cross-origin testing
4. Build-time vs runtime configuration confusion
5. Railway-specific environment variable quirks

The backend is production-ready. The frontend works locally. The gap is just getting the environment variables into the Railway build.

---

**For next session: Focus on Railway env var problem first. If not solved in 30 mins, switch to runtime config approach.**
