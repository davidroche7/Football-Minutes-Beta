# Football-Minutes-Beta - Key File Reference Guide

## Quick Lookup by Feature

### Authentication
- **Login Form UI:** `/home/davidroche1979/Football-Minutes-Beta/src/components/LoginForm.tsx`
- **Auth Logic:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/auth.ts`
- **User Credentials:** `/home/davidroche1979/Football-Minutes-Beta/src/config/users.ts`
- **API Security:** `/home/davidroche1979/Football-Minutes-Beta/api/_lib/security.ts`
- **CSRF Endpoint:** `/home/davidroche1979/Football-Minutes-Beta/api/session/csrf.ts`

### Player Management
- **Player UI Component:** `/home/davidroche1979/Football-Minutes-Beta/src/components/PlayerInput.tsx`
- **Roster Logic:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/roster.ts`
- **Player Service (Backend):** `/home/davidroche1979/Football-Minutes-Beta/server/services/players.ts`
- **Player API Endpoint:** `/home/davidroche1979/Football-Minutes-Beta/api/players/index.ts`
- **Player Detail API:** `/home/davidroche1979/Football-Minutes-Beta/api/players/[playerId].ts`

### Lineup Generation (Allocator)
- **Core Algorithm:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/allocator.ts`
- **Allocator Tests:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/allocator.test.ts`
- **Rules Configuration:** `/home/davidroche1979/Football-Minutes-Beta/src/config/rules.ts`
- **Constants:** `/home/davidroche1979/Football-Minutes-Beta/src/config/constants.ts`
- **Rules UI:** `/home/davidroche1979/Football-Minutes-Beta/src/components/RulesEngineView.tsx`

### Match/Fixture Management
- **Fixture Service (Backend):** `/home/davidroche1979/Football-Minutes-Beta/server/services/fixtures.ts`
- **Fixture API:** `/home/davidroche1979/Football-Minutes-Beta/api/fixtures/index.ts`
- **Fixture Detail API:** `/home/davidroche1979/Football-Minutes-Beta/api/fixtures/[fixtureId].ts`
- **Lineup API:** `/home/davidroche1979/Football-Minutes-Beta/api/fixtures/[fixtureId]/lineup.ts`
- **Result API:** `/home/davidroche1979/Football-Minutes-Beta/api/fixtures/[fixtureId]/result.ts`
- **Persistence (Save/Load):** `/home/davidroche1979/Football-Minutes-Beta/src/lib/persistence.ts`

### UI Components
- **Main App:** `/home/davidroche1979/Football-Minutes-Beta/src/App.tsx`
- **Allocation Grid Display:** `/home/davidroche1979/Football-Minutes-Beta/src/components/AllocationGrid.tsx`
- **Player Summary Table:** `/home/davidroche1979/Football-Minutes-Beta/src/components/PlayerSummary.tsx`
- **Season Stats View:** `/home/davidroche1979/Football-Minutes-Beta/src/components/SeasonStatsView.tsx`
- **GK Selector:** `/home/davidroche1979/Football-Minutes-Beta/src/components/GKSelector.tsx`
- **Edit Modal:** `/home/davidroche1979/Football-Minutes-Beta/src/components/EditModal.tsx`
- **Confirm Team Modal:** `/home/davidroche1979/Football-Minutes-Beta/src/components/ConfirmTeamModal.tsx`

### API & Data Access
- **API Client Wrapper:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/apiClient.ts`
- **Stats Client:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/statsClient.ts`
- **Stats API:** `/home/davidroche1979/Football-Minutes-Beta/api/stats/team.ts`
- **Audit Client:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/auditClient.ts`
- **Audit Service:** `/home/davidroche1979/Football-Minutes-Beta/server/services/audit.ts`

### Database
- **Database Client:** `/home/davidroche1979/Football-Minutes-Beta/server/db/client.ts`
- **Database Types:** `/home/davidroche1979/Football-Minutes-Beta/server/db/types.ts`
- **Database Schema:** `/home/davidroche1979/Football-Minutes-Beta/server/db/migrations/0001_init.sql`

### Configuration & Environment
- **Environment Variables:** `/home/davidroche1979/Football-Minutes-Beta/.env`
- **Environment Template:** `/home/davidroche1979/Football-Minutes-Beta/.env.example`
- **Environment Parsing:** `/home/davidroche1979/Football-Minutes-Beta/src/config/environment.ts`

### Servers
- **Development Server:** `/home/davidroche1979/Football-Minutes-Beta/server/dev-server.ts`
- **Production Server:** `/home/davidroche1979/Football-Minutes-Beta/server/production-server.ts`

### Configuration Files
- **TypeScript Frontend:** `/home/davidroche1979/Football-Minutes-Beta/tsconfig.json`
- **TypeScript Backend:** `/home/davidroche1979/Football-Minutes-Beta/tsconfig.api.json`
- **Vite Config:** `/home/davidroche1979/Football-Minutes-Beta/vite.config.ts`
- **ESLint Config:** `/home/davidroche1979/Football-Minutes-Beta/eslint.config.js`
- **Prettier Config:** `/home/davidroche1979/Football-Minutes-Beta/.prettierrc`
- **Tailwind Config:** `/home/davidroche1979/Football-Minutes-Beta/tailwind.config.js`
- **PostCSS Config:** `/home/davidroche1979/Football-Minutes-Beta/postcss.config.js`

### Documentation
- **Project Overview:** `/home/davidroche1979/Football-Minutes-Beta/README.md`
- **Codebase Exploration:** `/home/davidroche1979/Football-Minutes-Beta/CODEBASE-EXPLORATION.md`
- **Setup Summary:** `/home/davidroche1979/Football-Minutes-Beta/SETUP-SUMMARY.md`
- **Next Session Notes:** `/home/davidroche1979/Football-Minutes-Beta/NEXT-SESSION.md`
- **Development Guide:** `/home/davidroche1979/Football-Minutes-Beta/docs/DEVELOPMENT.md`
- **Deployment Guide:** `/home/davidroche1979/Football-Minutes-Beta/docs/DEPLOYMENT.md`
- **Security Guide:** `/home/davidroche1979/Football-Minutes-Beta/docs/security.md`
- **Data Model:** `/home/davidroche1979/Football-Minutes-Beta/docs/data-model-v2.md`
- **Architecture Decision Records:** `/home/davidroche1979/Football-Minutes-Beta/docs/adr/`

### Deployment
- **Docker Build:** `/home/davidroche1979/Football-Minutes-Beta/Dockerfile`
- **Docker Ignore:** `/home/davidroche1979/Football-Minutes-Beta/.dockerignore`
- **Procfile (Railway/Heroku):** `/home/davidroche1979/Football-Minutes-Beta/Procfile`
- **Vercel Config:** `/home/davidroche1979/Football-Minutes-Beta/vercel.json`

### Package Management
- **NPM Package Config:** `/home/davidroche1979/Football-Minutes-Beta/package.json`
- **NPM Lock File:** `/home/davidroche1979/Football-Minutes-Beta/package-lock.json`

### Utilities & Scripts
- **Legacy Import Script:** `/home/davidroche1979/Football-Minutes-Beta/scripts/import-legacy.cjs`
- **Migration Scripts:** `/home/davidroche1979/Football-Minutes-Beta/scripts/db/`

### Testing
- **Test Setup:** `/home/davidroche1979/Football-Minutes-Beta/src/tests/setup.ts`
- **Component Tests:** Multiple `*.test.tsx` files in `/home/davidroche1979/Football-Minutes-Beta/src/components/`
- **Lib Tests:** Multiple `*.test.ts` files in `/home/davidroche1979/Football-Minutes-Beta/src/lib/`
- **API Tests:** Multiple `*.test.ts` files in `/home/davidroche1979/Football-Minutes-Beta/api/`

---

## Entry Points

### Frontend
- **HTML Entry:** `/home/davidroche1979/Football-Minutes-Beta/index.html`
- **TypeScript Entry:** `/home/davidroche1979/Football-Minutes-Beta/src/main.tsx`
- **Main Component:** `/home/davidroche1979/Football-Minutes-Beta/src/App.tsx`

### Backend (Development)
- **Dev Server:** `/home/davidroche1979/Football-Minutes-Beta/server/dev-server.ts`
- **Start Command:** `npm run dev:backend`

### Backend (Production)
- **Production Server:** `/home/davidroche1979/Football-Minutes-Beta/server/production-server.ts`
- **Built Output:** `/home/davidroche1979/Football-Minutes-Beta/dist/server.js`
- **Start Command:** `npm start`

---

## Common Development Tasks

### To understand lineup generation:
1. Start: `src/lib/allocator.ts` - Main `allocate()` function
2. Read: `src/config/rules.ts` - Default rules
3. Read: `src/config/constants.ts` - Configuration values
4. Test: `src/lib/allocator.test.ts` - Examples of usage

### To understand authentication:
1. Start: `src/components/LoginForm.tsx` - UI
2. Read: `src/lib/auth.ts` - PBKDF2 hashing and session logic
3. Read: `src/config/users.ts` - Hardcoded accounts
4. Read: `api/_lib/security.ts` - Backend validation

### To understand data persistence:
1. Start: `src/lib/persistence.ts` - Main save/load logic
2. Read: `src/lib/apiClient.ts` - API wrapper
3. Read: `server/services/fixtures.ts` - Backend handling
4. Read: `server/db/migrations/0001_init.sql` - Schema

### To understand player management:
1. Start: `src/components/PlayerInput.tsx` - UI
2. Read: `src/lib/roster.ts` - Frontend logic
3. Read: `server/services/players.ts` - Backend service
4. Read: `api/players/index.ts` - API endpoint

---

## Database Operations

### To understand the database:
1. Schema: `server/db/migrations/0001_init.sql`
2. Types: `server/db/types.ts`
3. Client: `server/db/client.ts`

### To run migrations:
```bash
npm run db:migrate
```

### To understand service layer:
- Players: `server/services/players.ts`
- Fixtures: `server/services/fixtures.ts`
- Statistics: `server/services/stats.ts`
- Rules: `server/services/rulesets.ts`
- Audit: `server/services/audit.ts`

---

## Environment Variables

See full details: `/home/davidroche1979/Football-Minutes-Beta/.env.example`

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `FFM_SESSION_SECRET` - Session token signing key
- `VITE_USE_API` - Enable backend API
- `VITE_TEAM_ID` - Team UUID for API requests
- `VITE_SESSION_SECRET` - Frontend session secret

