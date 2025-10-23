# Fair Football Minutes

Calculate fair playing time distribution for 5-a-side football teams across 4 quarters.

## Features

- Automatic fair distribution of playing minutes across 4 quarters
- Support for 5-15 players with GK rotation and mandatory outfield time
- Quarter-by-quarter editor with drag/drop swaps and modal slot reassignment
- Roster management with add/remove/restore, audit log, and match-day selection
- Match confirmation flow capturing date, opponent, venue, score, scorers, POM, and honorable mentions
- Auto-seeded legacy data import from `data/FOOTBALL LINEUPS.xlsx`
- Season stats dashboard with player minutes, goals, awards, honorable mentions, audit history, and per-match editors
- Spreadsheet export tooling (SheetJS) for historical data
- Secure login (PBKDF2) with session storage, plus rules engine tab to tune timing/fairness constraints

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- (Phase 2 API) Postgres 15+ with `DATABASE_URL` configured – see `docs/backend-setup.md`

### Installation

```bash
# Install dependencies
cp .env.example .env.local    # customise VITE_* + DATABASE_URL as required
npm install
```

### Development

```bash
# Start dev server (opens at http://localhost:3000)
npm run dev
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Authentication

Two sample accounts are pre-provisioned for the beta build:

- `coach` / `CoachSecure1!`
- `manager` / `ManagerSecure2@`

You can regenerate hashed credentials by editing `src/config/users.ts` and using the PBKDF2 snippet in that file's comments.

### API Mode & Security Checklist

The application can persist to the Postgres API instead of browser storage. To enable this, set up the following environment variables on your backend (Vercel/local Node runtime) and frontend build:

Backend (`.env` or Vercel Project Settings):

```
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
FFM_SESSION_SECRET=generate-a-long-random-string
```

Frontend (`.env.local`):

```
VITE_USE_API=true
VITE_API_BASE_URL=/api           # or https://your-api-host
VITE_TEAM_ID=<uuid-of-your-team>
VITE_SESSION_SECRET=mirror-your-session-secret-or-env-appropriate-value
```

What happens after configuration:

- On login the client signs its session token with `VITE_SESSION_SECRET` and sends it in the `x-ffm-session` header on every request; the server verifies it against `FFM_SESSION_SECRET`.
- Every mutating request automatically calls `GET /api/session/csrf` (once per session) to obtain a `ffm_csrf` cookie and attaches it via the `x-ffm-csrf` header. Requests missing the header or cookie will be rejected with `403 CSRF_TOKEN_MISMATCH`.
- The client also always supplies `x-ffm-actor`, `x-ffm-roles`, and `x-ffm-team` headers. If `VITE_TEAM_ID` is missing, the UI will fall back to local storage and display a yellow warning banner.

Troubleshooting:

- **401 SESSION_REQUIRED** → ensure the app stored a session token (login again) and that `FFM_SESSION_SECRET` matches `VITE_SESSION_SECRET`.
- **403 CSRF_TOKEN_MISSING** → confirm the browser allows cookies for your API domain and that `credentials: 'include'` is not being stripped by CORS settings.
- **TEAM_ID_REQUIRED** → set `VITE_TEAM_ID` (client) and supply the same team ID via header or query when calling APIs directly.
- **DATABASE_URL missing** → backend now refuses to start API routes without `DATABASE_URL`; double-check Vercel secrets.

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage
npm test:coverage
```

### Linting & Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

## Project Structure

```
src/
├── components/            # React components (Match setup, Season stats, Rules engine, auth)
├── config/                # Rule defaults & constant helpers
├── lib/                   # Allocation logic, persistence, auth, rule store
├── App.tsx                # Tab layout + application shell
└── main.tsx               # Entry point
docs/
├── requirements.md        # High-level backlog
├── data-model.json        # Original TOGAF-aligned data model
├── data-model-v2.md       # Phase 2 relational model for Postgres backend
├── api-surface-v2.md      # Planned REST endpoints & security baseline
├── backend-setup.md       # Local/Vercel database setup guide
├── progress-2025-10-17.md  # Latest implementation notes / next steps
index.html / vite.config.ts
server/
└── db/                    # SQL migrations, typed enumerations, connection helpers
scripts/
└── db/                    # Migration runner (npm run db:migrate)
```

## How It Works

### Match Structure

- **4 quarters** × **10 minutes** each
- **5 positions per quarter**: 1 GK, 2 DEF, 2 ATT

### Time Blocks

- **GK**: Plays the full 10-minute quarter
- **Outfield (DEF/ATT)**: Two 5-minute shifts (0–5 minutes and 5–10 minutes)
- **Sub**: Not playing (0 minutes)

### Fairness Rules

1. Minimize variance between player total minutes
2. No player plays more than 5 minutes more than another (where possible)
3. Players assigned GK must get at least one 5-minute outfield block
4. All quarters must be fully staffed

## Configuration

Rule settings are defined in `src/config/rules.ts` (defaults) and can be overridden via the UI. Overrides persist to localStorage and hydrate through `src/lib/rules.ts`.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint + Prettier
- **Export**: SheetJS (xlsx)

## Testing & Build

```bash
npm test -- --run   # Vitest suite
npm run build       # Production build
```

## Deployment

### Static Frontend

1. Build the production bundle:
   ```bash
   npm install
   npm run build
   ```
   The static assets are emitted to `dist/`.

2. Deploy `dist/` to your hosting provider. Common options:
   - **Netlify / Vercel**: drag-and-drop the `dist` folder or connect the repo and set `npm run build` as the build command with `dist` as the publish directory.
   - **Static S3/CloudFront**: upload `dist/` contents to an S3 bucket and front with CloudFront (ensure index.html rewrites).
   - **Self-hosted Node server**: serve `dist/` via a static middleware (e.g., `serve -s dist`).

3. If using the built-in login, keep the `src/config/users.ts` hash list safe and rotate passwords before going live. For production you’ll likely swap this for a backend-authenticated token exchange.

4. Configure HTTPS and any desired HTTP security headers at the hosting layer.

### Deployment Checklist (Vercel / Node Hosting)

1. **Environment Variables**

   | Layer     | Key                  | Example / Notes                                   |
   |-----------|----------------------|----------------------------------------------------|
   | Backend   | `DATABASE_URL`       | `postgres://user:pass@host:5432/db`                |
   | Backend   | `FFM_SESSION_SECRET` | 32+ char random string (rotate periodically)       |
   | Frontend  | `VITE_USE_API`       | `true` to enable API persistence                   |
   | Frontend  | `VITE_API_BASE_URL`  | `/api` (Vercel) or full URL for separate backend   |
   | Frontend  | `VITE_TEAM_ID`       | UUID of the active team (matches backend records)  |
   | Frontend  | `VITE_SESSION_SECRET`| Match `FFM_SESSION_SECRET`                         |

   Optional:
   - `DB_POOL_MAX`, `DB_SSL_REJECT_UNAUTHORIZED`
   - `VITE_ACTOR_ROLES` (comma-separated default roles)

2. **Secrets on Vercel**

   ```bash
   vercel secrets add football_minutes_database_url postgres://user:pass@host:5432/db
   vercel secrets add football_minutes_session_secret <random-string>
   ```

3. **Build / Migrate**

   Ensure the deployment command runs migrations before building:

   ```bash
   npm run db:migrate
   npm run build
   ```

4. **Pre-Release Validation**

   - `npm test -- --run --pool=threads`
   - Manual QA (see checklist below).
   - Verify environment guards: app should refuse to start if secrets missing.

5. **Post-Deploy Smoke Test**

   - Login, create roster player, confirm match, edit Season Stats.
   - Check `/api/health` endpoint returns 200.

6. **Monitoring & Logs**

   - Enable Vercel log drains (or alternative aggregation) so `SESSION_*`/`CSRF_*` rejections are visible.
   - Watch for repeated `TEAM_OR_ENTITY_REQUIRED` or `SESSION_INVALID` errors after rollout.
   - Configure alerting once traffic patterns are known (e.g., >20 security failures in 5 minutes).

### Vercel (Full Stack Preview)

- The repository now includes `vercel.json` that pins `nodejs20.x` for API functions and maps the secret `football_minutes_database_url` to `DATABASE_URL`.
- Add the secret in Vercel:
  ```bash
  vercel secrets add football_minutes_database_url postgres://user:pass@host:5432/db
  ```
- Configure a build hook or deploy command that runs `npm run db:migrate && npm run build` (handled by `prebuildCommand`).
- Health check endpoint: `GET /api/health` (performs optional DB ping).

## Historic Data Import (Excel)

To pull legacy fixtures from `data/FOOTBALL LINEUPS.xlsx`:

```bash
npm run import:legacy
```

The script parses the workbook (Lineups/Results sheets) and serialises matches to JSON. In environments where writing to `data/imported-matches.json` is not permitted, the JSON will be emitted to stdout—redirect it if you want to persist locally:

```bash
npm run import:legacy > data/imported-matches.json
```

The generated data mirrors the allocator model (quarters, player minutes, results) so it can be fed into the web app or used for regression tests.

## License

MIT

## Support

For issues or feature requests, please open an issue in the project repository.

## Manual QA Checklist

Run this list before tagging a release:

- [ ] Login with `coach` / confirm session banner shows API backend.
- [ ] Add a roster player, remove, restore, and verify audit log entries.
- [ ] Pick a Team: generate allocation, confirm match, then edit via Season Stats (ensure backend stats refresh).
- [ ] Season Stats: edit score/venue and ensure player table updates.
- [ ] Rules Engine view loads active ruleset from API.
- [ ] Run `npm test -- --run --pool=threads` locally (CI equivalent).
- [ ] Legacy importer (`npm run import:legacy`) completes without errors (optional for API mode).
