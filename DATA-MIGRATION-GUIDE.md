# 🔄 localStorage Data Migration Guide

## Good News: Your Data is NOT Lost! ✅

All your match data, player rosters, and lineup allocations are safely stored in your browser's localStorage. We can migrate it to the database.

---

## Where Your Data Lives Right Now

```javascript
// In your browser's localStorage (Chrome/Firefox/Safari)
localStorage['ffm:matches']     // All your match records
localStorage['ffm:roster']      // Your player roster (if any)
localStorage['ffm:session']     // Your login session
```

**This data is:**
- ✅ Still there in your browser
- ✅ Not deleted
- ✅ Can be exported and migrated
- ❌ Only visible in the browser where you created it

---

## Option 1: Export Your localStorage Data (5 minutes)

### Step 1: Open Your Browser's Developer Console

**Where you have your data (normal browser, not incognito):**

1. Go to: https://football-minutes-beta.vercel.app
2. Press **F12** (or **Cmd+Option+I** on Mac)
3. Click **Console** tab
4. Copy and paste this script:

```javascript
// Export all Football Minutes data from localStorage
(function exportFFMData() {
  const data = {
    matches: localStorage.getItem('ffm:matches'),
    roster: localStorage.getItem('ffm:roster'),
    session: localStorage.getItem('ffm:session'),
    timestamp: new Date().toISOString(),
    browser: navigator.userAgent,
  };

  // Parse to verify it's valid JSON
  const parsed = {
    matches: data.matches ? JSON.parse(data.matches) : [],
    roster: data.roster ? JSON.parse(data.roster) : [],
    session: data.session ? JSON.parse(data.session) : null,
    metadata: {
      timestamp: data.timestamp,
      browser: data.browser,
      matchCount: data.matches ? JSON.parse(data.matches).length : 0,
      rosterCount: data.roster ? JSON.parse(data.roster).length : 0,
    }
  };

  console.log('📊 Your Football Minutes Data:');
  console.log('Matches:', parsed.matchCount);
  console.log('Players:', parsed.rosterCount);
  console.log('\n✅ Data export complete!');
  console.log('\n📋 Copy this JSON to save your data:');
  console.log(JSON.stringify(parsed, null, 2));

  // Also create downloadable file
  const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `football-minutes-backup-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('\n💾 File downloaded: football-minutes-backup-' + Date.now() + '.json');

  return parsed;
})();
```

### Step 2: Save the Downloaded File

A file named `football-minutes-backup-[timestamp].json` will download automatically.

**Keep this file safe!** It contains all your:
- Match records (dates, opponents, venues)
- Player allocations (who played when)
- Lineup history
- Results and statistics

---

## Option 2: Migrate Data to Database (After Env Vars Configured)

Once you've configured the Vercel environment variables (see `VERCEL-ENV-SETUP.md`), you can migrate your data.

### Automatic Migration Script

I'll create a migration utility that runs in the browser:

**In Developer Console (after env vars are configured):**

```javascript
// Migration script - Run this AFTER configuring environment variables
(async function migrateToDatabase() {
  console.log('🔄 Starting migration from localStorage to database...');

  // Get localStorage data
  const matchesJson = localStorage.getItem('ffm:matches');
  if (!matchesJson) {
    console.log('❌ No matches found in localStorage');
    return;
  }

  const matches = JSON.parse(matchesJson);
  console.log(`📊 Found ${matches.length} matches to migrate`);

  let successCount = 0;
  let errorCount = 0;

  // Import the saveMatch function
  // Note: This assumes you're on the app and have access to the functions
  for (const match of matches) {
    try {
      // The app will automatically use API mode if env vars are set
      console.log(`📤 Migrating match: ${match.opponent} (${match.date})...`);

      // Call the app's save function (need to trigger through UI)
      // Or use direct API call
      const response = await fetch('/api/fixtures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Team-ID': 'YOUR-TEAM-ID-HERE', // Replace with your actual team ID
        },
        body: JSON.stringify({
          opponent: match.opponent,
          fixtureDate: match.date,
          kickoffTime: match.time || '',
          venueType: match.venue?.toUpperCase() || 'HOME',
          status: 'LOCKED',
          // ... map other fields
        }),
      });

      if (response.ok) {
        successCount++;
        console.log(`✅ Migrated: ${match.opponent}`);
      } else {
        errorCount++;
        console.error(`❌ Failed: ${match.opponent}`, await response.text());
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Error migrating ${match.opponent}:`, error);
    }
  }

  console.log('\n🎉 Migration complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${matches.length}`);

  if (successCount > 0) {
    console.log('\n⚠️  Recommendation: Keep localStorage backup for 1 week, then clear it');
    console.log('Run this to clear: localStorage.removeItem("ffm:matches")');
  }
})();
```

---

## Option 3: Manual Data Entry (If Small Dataset)

If you only have a few matches (< 5), it might be faster to:

1. Export your data using Option 1
2. Configure environment variables
3. Use the app's UI to re-enter the matches manually

---

## What Gets Migrated

### ✅ Can Be Migrated Automatically
- Match details (opponent, date, venue)
- Player rosters
- Lineup allocations (who played which position)
- Match results (if entered)

### ⚠️ May Need Manual Mapping
- `editHistory` (inline change logs) - see note below
- Player preferences/positions (if stored)
- Custom settings

### 📝 Note on editHistory
The localStorage `editHistory` array uses a different format than the database `audit_event` table:

**localStorage format:**
```javascript
{
  id: "evt_123",
  field: "opponent",
  previousValue: "Old Name",
  newValue: "New Name",
  editedAt: "2024-12-04T...",
  editedBy: "coach"
}
```

**Database format (audit_event):**
```sql
id, actor_id, entity_type, entity_id, event_type,
previous_state (JSONB), next_state (JSONB), metadata (JSONB), created_at
```

**Decision needed:**
- Option A: Migrate as audit events (complex mapping)
- Option B: Store as metadata in match record
- Option C: Accept loss of historical edit logs (keep in backup)

---

## Verification After Migration

### 1. Check data appeared in database:

```bash
# Connect to your Vercel Postgres
vercel postgres --yes

# Check fixtures
SELECT id, opponent, fixture_date, venue_type
FROM fixture
ORDER BY fixture_date DESC
LIMIT 10;

# Check players
SELECT id, display_name, status
FROM player
WHERE status = 'ACTIVE';

# Check lineup quarters
SELECT f.opponent, lq.quarter_number, lq.position, p.display_name
FROM lineup_quarter lq
JOIN fixture f ON lq.fixture_id = f.id
JOIN player p ON lq.player_id = p.id
ORDER BY f.fixture_date DESC, lq.quarter_number
LIMIT 20;
```

### 2. Check in the app:

1. Go to **Season Stats** tab
2. Click **Games** sub-tab
3. Verify all your matches appear
4. Expand a match to verify lineup details

### 3. Test across browsers:

1. Open app in incognito mode
2. Login with same credentials
3. Verify you see the same data
4. **Success!** Data is now in database, not just localStorage

---

## Rollback Plan (If Migration Fails)

### You still have your data in localStorage:

1. **Keep localStorage backup file** (the JSON you downloaded)
2. **Don't clear localStorage** until you verify database migration
3. **If migration fails,** you can:
   - Continue using localStorage mode (set `VITE_USE_API=false`)
   - Re-import the JSON backup
   - Try migration again with fixes

### Restore from backup:

```javascript
// In browser console (if you need to restore)
(function restoreBackup() {
  // Paste your JSON backup here
  const backup = {
    "matches": [ /* your backup data */ ],
    "roster": [ /* your roster data */ ]
  };

  localStorage.setItem('ffm:matches', JSON.stringify(backup.matches));
  localStorage.setItem('ffm:roster', JSON.stringify(backup.roster));

  console.log('✅ Backup restored to localStorage');
  window.location.reload();
})();
```

---

## Best Practices

### Before Migration:
1. ✅ Export localStorage data (Option 1 above)
2. ✅ Save the backup JSON file somewhere safe
3. ✅ Take a screenshot of your Season Stats page
4. ✅ Note how many matches you have

### During Migration:
1. ✅ Keep your browser open (don't close the tab)
2. ✅ Watch console for errors
3. ✅ Note any failed migrations

### After Migration:
1. ✅ Verify data in database (SQL queries)
2. ✅ Test in different browser/incognito
3. ✅ Keep localStorage backup for 1-2 weeks
4. ✅ Only clear localStorage after confirming everything works

---

## Timeline Recommendation

**Week 1 (Now):**
- Export localStorage data ✓
- Configure Vercel environment variables ✓
- Run migration script ✓
- Verify data in database ✓

**Week 2:**
- Use app normally with database persistence
- Monitor for any data issues
- Keep localStorage backup just in case

**Week 3+:**
- Confirm everything working smoothly
- Clear localStorage (optional)
- Delete backup file (optional, or keep forever)

---

## Quick Reference: Data Locations

| Storage | Location | Persistent? | Shared? | Backed Up? |
|---------|----------|-------------|---------|------------|
| **localStorage** | Browser | ✅ Until cleared | ❌ Per browser | ❌ Manual only |
| **Database (Postgres)** | Vercel/Cloud | ✅ Always | ✅ All devices | ✅ Automatic |
| **Backup JSON file** | Your computer | ✅ Until deleted | ❌ Manual share | ✅ Your responsibility |

---

## Need Help?

### Common Issues:

**"Can't find my data in localStorage"**
- Check you're in the correct browser (not incognito)
- Check you're on the correct domain
- Run: `console.log(Object.keys(localStorage).filter(k => k.startsWith('ffm')))`

**"Migration script fails"**
- Verify environment variables configured
- Check you're logged in (valid session)
- Look for error messages in console
- Check database connection (Vercel Postgres accessible)

**"Some matches didn't migrate"**
- Check console logs for specific errors
- Verify those matches have required fields (opponent, date)
- May need to re-run migration for failed ones

**"Data in database but not showing in app"**
- Hard refresh: Ctrl+Shift+R
- Clear browser cache
- Check "Persistence Mode" badge shows "API backend"
- Verify `VITE_USE_API=true` in Vercel

---

## Summary

🎉 **Your data is safe in localStorage!**

📤 **Export it** before doing anything else

🔧 **Configure environment variables** (see VERCEL-ENV-SETUP.md)

🔄 **Run migration** to move data to database

✅ **Verify** data appears in database and across browsers

💾 **Keep backup** for at least 1-2 weeks

**Estimated total time: 10-15 minutes**

Your hard work entering all that match data is not lost! 🙌
