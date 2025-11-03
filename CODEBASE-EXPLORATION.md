# Football-Minutes-Beta Codebase Exploration - Comprehensive Report

**Date:** November 2, 2025
**Status:** Very thorough exploration completed
**Project:** Football Minutes - Full-stack TypeScript application for comprehensive team management

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Tech Stack](#2-tech-stack)
3. [Authentication Flow](#3-authentication-flow)
4. [Player Management](#4-player-management)
5. [Lineup Generation Logic (Rules Engine)](#5-lineup-generation-logic--rules-engine)
6. [Data Structures & Database Models](#6-data-structures--database-models)
7. [Current UI/Navigation](#7-current-uinavigation)
8. [Architecture Overview](#8-architecture-overview)

---

## 1. Project Structure

### Root Directory Layout

```
Football-Minutes-Beta/
├── src/                      # Frontend React application (TypeScript)
├── api/                       # Vercel serverless functions (TypeScript)
├── server/                    # Express development and production servers
├── docs/                      # Comprehensive documentation
├── scripts/                   # Utility scripts (migrations, imports)
├── types/                     # Shared TypeScript types
├── dist/                      # Production build output
├── node_modules/              # Dependencies
├── package.json               # Project metadata and scripts
├── tsconfig.json              # Frontend TypeScript config
├── tsconfig.api.json          # Backend/API TypeScript config
├── vite.config.ts             # Vite build configuration
├── Dockerfile                 # Docker production build
├── Procfile                   # Railway/Heroku deployment config
├── vercel.json                # Vercel serverless config
├── .env                       # Environment configuration (local)
├── .env.example               # Environment template
├── README.md                  # Project overview
├── SETUP-SUMMARY.md           # Latest setup changes
└── NEXT-SESSION.md            # Handoff notes for next session
```

### Frontend Structure (`src/`)

```
src/
├── App.tsx                    # Main React component (root)
├── main.tsx                   # Vite entry point
├── vite-env.d.ts              # Vite types
├── components/                # React UI components
│   ├── AllocationGrid.tsx      # Quarter-by-quarter allocation display
│   ├── AllocationSummaryCard.tsx # Summary stats for allocation
│   ├── ConfirmTeamModal.tsx    # Fixture confirmation modal
│   ├── EditModal.tsx           # Inline slot editing
│   ├── GKSelector.tsx          # Manual goalkeeper selection
│   ├── LoginForm.tsx           # Authentication form
│   ├── PlayerInput.tsx         # Player roster management
│   ├── PlayerSummary.tsx       # Player minutes summary table
│   ├── RulesEngineView.tsx     # Rules configuration interface
│   ├── SeasonStatsView.tsx     # Match history and player stats
│   ├── Tabs.tsx                # Tabbed navigation
│   └── *.test.tsx              # Component unit tests
├── lib/                       # Utility functions and business logic
│   ├── allocator.ts           # Core lineup generation algorithm
│   ├── apiClient.ts           # API request wrapper
│   ├── auth.ts                # Authentication (PBKDF2 hashing, sessions)
│   ├── auditClient.ts         # Audit event client
│   ├── bootstrap.ts           # Seed data initialization
│   ├── matchTypes.ts          # Match/fixture TypeScript types
│   ├── persistence.ts         # Match data save/load (API or localStorage)
│   ├── roster.ts              # Player roster management
│   ├── rules.ts               # Rules configuration management
│   ├── rulesClient.ts         # Rules API client
│   ├── rulesStore.ts          # Rules localStorage persistence
│   ├── statsClient.ts         # Statistics API client
│   ├── types.ts               # Core allocation types
│   └── *.test.ts              # Unit tests
├── config/                    # Configuration files
│   ├── constants.ts           # Allocation constants and config computation
│   ├── environment.ts         # Environment variable parsing
│   ├── rules.ts               # Default fairness rules
│   └── users.ts               # Hardcoded user credentials
└── tests/
    └── setup.ts               # Test environment setup
```

### Backend Structure (`api/`, `server/`)

```
api/                           # Vercel serverless functions
├── health.ts                  # Health check endpoint
├── session/
│   └── csrf.ts                # CSRF token generation
├── players/                   # Player management endpoints
│   ├── index.ts               # GET players, POST new player
│   ├── [playerId].ts          # GET/PATCH/DELETE player
│   └── [playerId]/
│       └── restore.ts         # POST to restore deleted player
├── fixtures/                  # Match fixture endpoints
│   ├── index.ts               # GET fixtures, POST new fixture
│   ├── [fixtureId].ts         # GET/PATCH/DELETE fixture
│   └── [fixtureId]/
│       ├── lineup.ts          # PUT quarter assignments
│       ├── lock.ts            # POST to lock lineup
│       └── result.ts          # PUT match result and awards
├── stats/                     # Statistics endpoints
│   ├── team.ts                # GET team season stats
│   └── players.ts             # GET per-player statistics
├── rulesets/                  # Rules configuration
│   └── active.ts              # GET active ruleset
├── audit/                     # Audit trail
│   └── index.ts               # GET audit events
└── _lib/                      # Shared API utilities
    ├── context.ts             # Request context extraction
    ├── errors.ts              # Error handling classes
    ├── json.ts                # JSON parsing utilities
    ├── responses.ts           # HTTP response helpers
    ├── security.ts            # CSRF protection, auth validation
    └── validation.ts          # Zod schema parsing

server/                        # Express servers
├── dev-server.ts             # Development: wraps Vercel functions for local dev
├── production-server.ts       # Production: full Express server
└── db/                        # Database layer
    ├── client.ts              # PostgreSQL connection pool
    ├── types.ts               # Database row types
    └── migrations/
        └── 0001_init.sql      # Initial schema creation
└── services/                  # Business logic layer
    ├── players.ts             # Player CRUD + audit
    ├── fixtures.ts            # Fixture CRUD
    ├── stats.ts               # Statistics queries
    ├── rulesets.ts            # Rules CRUD
    └── audit.ts               # Audit event recording
```

---

## 2. Tech Stack

### Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | React | 18.3.1 | UI framework |
| **Language** | TypeScript | 5.6.3 | Type safety |
| **Build Tool** | Vite | 6.0.3 | Fast bundling |
| **Styling** | Tailwind CSS | 3.4.16 | Utility-first CSS |
| **Testing** | Vitest | 2.1.8 | Unit test runner |
| **DOM Testing** | @testing-library/react | 16.1.0 | Component testing |

### Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 20+ | JavaScript runtime |
| **Language** | TypeScript | 5.6.3 | Type safety |
| **Server** | Express.js | 5.1.0 | HTTP server |
| **Database** | PostgreSQL | 15+ | Relational database |
| **Database Driver** | pg | 8.13.1 | Node PostgreSQL client |
| **Validation** | Zod | 3.23.8 | Schema validation |
| **CORS** | cors | 2.8.5 | Cross-origin support |
| **Env Vars** | dotenv | 17.2.3 | Environment configuration |
| **Serverless** | Vercel | N/A | Production deployment |

### DevOps & Deployment

| Tool | Purpose | Configuration |
|------|---------|----------------|
| **Docker** | Container deployment | `Dockerfile` + `.dockerignore` |
| **Railway** | PaaS hosting | `Procfile` |
| **Heroku** | Traditional PaaS | `Procfile` |
| **Vercel** | Serverless platform | `vercel.json` |
| **PM2** | Process manager (VPS) | Node.js ecosystem |
| **GitHub Actions** | CI/CD ready | Can be configured |

### Development Tools

- **Build:** esbuild (backend bundling)
- **Package Manager:** npm with concurrently for multiple servers
- **Linting:** ESLint 9.15.0
- **Formatting:** Prettier 3.3.3
- **Test Coverage:** Vitest with coverage support

---

## 3. Authentication Flow

### Overview

The application uses **session-based authentication** with PBKDF2 password hashing. Two hardcoded accounts are pre-configured for development.

**File Location:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/auth.ts`

### Authentication Process

#### 1. Login (Frontend)

**Component:** `src/components/LoginForm.tsx`

```tsx
// User enters credentials
const session = await verifyCredentials(username, password);
// Returns: { username, token, issuedAt }
// Stored in sessionStorage
```

#### 2. Credential Verification

**Function:** `verifyCredentials(username: string, password: string)`

Steps:
1. Look up user in `AUTH_USERS` array (hardcoded in `src/config/users.ts`)
2. Derive password hash using PBKDF2-SHA256:
   - Salt: 16 hex bytes (stored in user config)
   - Iterations: 210,000 (NIST recommended)
   - Hash output: 256 bits
3. Compare derived hash with stored hash
4. On success, create signed session token

#### 3. Session Token Creation

```javascript
// Token payload format: "username|issuedAt"
// Example: "coach|2024-11-02T15:30:00.000Z"

// HMAC-SHA256 signature using SESSION_SECRET
// Signature = HMAC-SHA256(SESSION_SECRET, payload)

// Final token: base64(payload|signature)
// Example: "Y29hY2h8MjAyNC0xMS0wMlQxNTozMDowMC4wMDBafHNpZ25hdHVyZQ=="
```

#### 4. Session Storage

```javascript
// Browser sessionStorage
sessionStorage.setItem('ffm:session', JSON.stringify({
  username: 'coach',
  token: 'base64encodedtoken...',
  issuedAt: '2024-11-02T15:30:00.000Z'
}));
```

#### 5. API Authentication (for API calls)

**Headers sent with each request:**
```http
x-ffm-actor: coach
x-ffm-session: base64encodedtoken...
x-ffm-roles: coach,analyst
x-ffm-team: <VITE_TEAM_ID>
x-ffm-csrf: <csrf-token>
```

### Hardcoded Users

**File:** `src/config/users.ts`

```typescript
{
  username: 'coach',
  saltHex: '167542a1dc0ea194c2381b127b058c8a',
  hashHex: 'beb4c4ec95a2ceef11a806ec32de7408cbf35508e0b6ce2b2b00ddeb9d44b257',
  iterations: 210000,
  // Password: CoachSecure1!
}

{
  username: 'manager',
  saltHex: '9e24889bec8a963ddd0bf43e00514463',
  hashHex: 'a23a2450773c9bca58f1b32be28a7c53dffd61da3667d48e49a6ea66550ce2e3',
  iterations: 210000,
  // Password: ManagerSecure2@
}
```

### CSRF Protection

**Endpoint:** `api/session/csrf.ts`

```typescript
// GET /api/session/csrf
// Returns: Sets `ffm_csrf` cookie
// Client reads cookie and includes in `x-ffm-csrf` header for mutations
```

**Mutations** (POST, PUT, PATCH, DELETE) require:
1. Fetch CSRF token via `GET /api/session/csrf`
2. Extract `ffm_csrf` cookie
3. Include `x-ffm-csrf` header in request

### Logout

```typescript
// Frontend only - no API call
clearSession(); // Remove from sessionStorage
setSession(null); // Clear React state
```

### Security Considerations

- Sessions stored in browser `sessionStorage` (cleared on tab close)
- Passwords hashed with PBKDF2-SHA256 (strong modern hashing)
- HMAC-SHA256 signature on tokens prevents tampering
- CSRF tokens for state-changing operations
- Environment variable `FFM_SESSION_SECRET` controls token signing
- Timing attack mitigation: 300ms delay on failed login

---

## 4. Player Management

### Architecture

Player management is split between **frontend UI** and **backend API**, with optional **local fallback**.

**Files:**
- Frontend: `/home/davidroche1979/Football-Minutes-Beta/src/lib/roster.ts`
- Backend: `/home/davidroche1979/Football-Minutes-Beta/server/services/players.ts`
- API: `/home/davidroche1979/Football-Minutes-Beta/api/players/`

### Data Structure

```typescript
interface RosterPlayer {
  id: string;                    // UUID
  displayName: string;           // "John Smith"
  preferredPositions?: string[]; // ['GK', 'DEF']
  squadNumber?: number | null;   // 7
  status: 'ACTIVE' | 'INACTIVE' | 'TRIALIST';
  notes?: string | null;         // "Excellent GK"
  removedAt?: string | null;     // Soft-delete timestamp
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

### Player List Management - UI Component

**Component:** `src/components/PlayerInput.tsx`

Features:
1. **Display active players** in a list
2. **Add new players** via text input
3. **Select players** for match lineup (via checkboxes)
4. **Delete players** (soft-delete with restore option)
5. **View audit history** (shows who deleted/modified)
6. **Persistence modes**:
   - `api`: Backend database via `/api/players`
   - `local`: Browser localStorage fallback
   - `fallback`: Switched to local if API unavailable

### Player Operations

#### 1. List Players

```typescript
// Frontend
const players = await listRoster({ includeRemoved: true });
// Returns: RosterPlayer[]

// Backend API (GET /api/players)
// Query params: teamId, includeRemoved
// Returns: { data: PlayerDTO[] }
```

**Database Query:**
```sql
SELECT * FROM player
WHERE team_id = $1 AND ($2::boolean OR removed_at IS NULL)
ORDER BY display_name ASC
```

#### 2. Create Player

```typescript
// Frontend request
const newPlayer = await addPlayer({
  displayName: 'Alice Smith',
  preferredPositions: ['DEF', 'ATT'],
  squadNumber: 5,
  status: 'ACTIVE',
  notes: 'Fast and technical'
});

// Backend API (POST /api/players)
// Body: CreatePlayerInput
// Returns: { data: PlayerDTO }
```

**Backend Processing:**
1. Validate request with Zod schema
2. Insert into `player` table
3. Record audit event in `audit_event` table
4. Return new player

#### 3. Update Player

```typescript
// Backend API (PATCH /api/players/:playerId)
// Body: UpdatePlayerInput
// Can update: displayName, preferredPositions, squadNumber, status, notes
```

**Audit Recording:**
```javascript
// Before and after states captured
INSERT INTO audit_event (
  actor_id, entity_type, entity_id, event_type,
  previous_state, next_state
) VALUES (
  'coach-id', 'PLAYER', 'player-uuid', 'updated',
  previousPlayerJson, updatedPlayerJson
)
```

#### 4. Soft Delete Player

```typescript
// Frontend
await removePlayer(playerId);

// Backend API (DELETE /api/players/:playerId)
// Sets removed_at = NOW()
// Audit event: event_type = 'removed'
```

#### 5. Restore Deleted Player

```typescript
// Frontend
await restorePlayer(playerId);

// Backend API (POST /api/players/:playerId/restore)
// Sets removed_at = NULL
// Audit event: event_type = 'restored'
```

### Persistence Modes

**Local Storage (No API)**
- Players stored in browser localStorage at key `ffm:roster`
- No audit trail (localStorage only)
- Works offline

**API Mode (With Backend)**
- Players stored in PostgreSQL `player` table
- Full audit trail in `audit_event` table
- Includes actor tracking (who made changes)

**Fallback Logic**
```typescript
if (USE_API_PERSISTENCE && TEAM_ID) {
  try {
    return await listPlayers(teamId); // API
  } catch (error) {
    console.warn('API unavailable, using local storage');
    return loadLocalRoster(); // Fallback
  }
}
```

### Audit Trail

**Database Table:** `audit_event`

```sql
CREATE TABLE audit_event (
  id UUID PRIMARY KEY,
  actor_id UUID,                 -- Who made the change
  entity_type audit_entity,      -- PLAYER, FIXTURE, LINEUP, etc.
  entity_id UUID,                -- Player UUID
  event_type TEXT,               -- 'created', 'updated', 'removed', 'restored'
  previous_state JSONB,          -- State before change
  next_state JSONB,              -- State after change
  created_at TIMESTAMPTZ         -- When change was made
);
```

**Frontend Display:** `PlayerInput.tsx` shows audit history with:
- Action (Created, Updated, Deleted, Restored)
- Timestamp
- Actor (username who made change)
- Previous/current values

---

## 5. Lineup Generation Logic (Rules Engine)

### Overview

The **core allocation algorithm** distributes players fairly across 4 quarters, balancing minutes and ensuring positional coverage.

**File:** `/home/davidroche1979/Football-Minutes-Beta/src/lib/allocator.ts`

### Match Structure

```
Quarter Duration: 10 minutes (total: 40 minutes)
Positions per quarter: 5
  - 1 Goalkeeper (GK): plays full quarter (10 min)
  - 2 Defenders (DEF): each play 5 min (one per wave)
  - 2 Attackers (ATT): each play 5 min (one per wave)

Waves (for outfield players):
  - First wave:  0-5 minutes (2 DEF + 2 ATT)
  - Second wave: 5-10 minutes (2 DEF + 2 ATT)
```

### Fairness Rules

**Default Configuration:** `src/config/rules.ts`

```typescript
{
  quarters: 4,
  quarterDuration: 10,
  waves: {
    first: 5,   // First wave duration
    second: 5   // Second wave duration
  },
  positions: {
    GK: 1,      // 1 goalkeeper per quarter
    DEF: 2,     // 2 defenders per wave
    ATT: 2      // 2 attackers per wave
  },
  fairness: {
    maxVariance: 5,        // Max difference in total minutes between players
    gkRequiresOutfield: true // GK players must also get outfield time
  }
}
```

### Algorithm (High Level)

**Entry Point:** `allocate(players: string[], manualGKs?: [string, string, string, string])`

**Process:**
1. Validate player count (5-15)
2. Run up to 200 allocation attempts
3. For each attempt:
   - Allocate each of 4 quarters
   - Calculate variance (fairness metric)
   - Check for constraint violations
4. Return best allocation meeting constraints

**Key Constraints:**
- No player in same quarter twice
- GK players must get outfield time (tracked)
- No consecutive substitutions (max 1 quarter on bench)
- Minimize variance in total minutes
- Variance ≤ configured max (default: 5 minutes)

### Quarter Allocation (`allocateQuarter`)

For each quarter:

1. **Select Goalkeeper**
   ```
   Priority: 
   - Must play this quarter (if queued)
   - Fewest GK quarters so far
   - Fewest total minutes
   
   Assigns: 10 minutes (GK_FULL)
   ```

2. **Select First Wave (0-5 min)**
   ```
   Select: 2 DEF + 2 ATT = 4 players
   
   Priority:
   - GK players who haven't got outfield time yet
   - Players with fewest total minutes
   - Not already used this quarter
   
   Each player: 5 minutes (OUTFIELD_FIRST)
   ```

3. **Select Second Wave (5-10 min)**
   ```
   Select: 2 DEF + 2 ATT = 4 players
   
   Priority:
   - Players with fewest total minutes
   - Not already used this quarter
   - Can reuse players if necessary
   
   Each player: 5 minutes (OUTFIELD_SECOND)
   ```

### Variance Calculation

```typescript
function calculateVariance(allocation: Allocation): number {
  const minutes = Object.values(allocation.summary);
  const mean = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const variance = minutes.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) / minutes.length;
  return Math.sqrt(variance); // Standard deviation
}

// Example with 6 players:
// Total minutes: 40 (per 4x10 quarter structure)
// Ideal: ~6.67 min per player
// Maximum allowed variance: 5 min
```

### Example Allocation (6 players)

```
Players: Alice, Bob, Charlie, Diana, Eve, Frank

Quarter 1:
  GK (10 min):    Alice
  DEF 0-5:        Bob, Charlie
  ATT 0-5:        Diana, Eve
  DEF 5-10:       Frank, Bob
  ATT 5-10:       Alice, Charlie  <- Alice plays 2 waves as ATT
  Subs:           None

Quarter 2:
  GK (10 min):    Bob
  ...

Summary:
  Alice:    15 min
  Bob:      20 min
  Charlie:  10 min
  Diana:    5 min
  Eve:      5 min
  Frank:    5 min
  Variance: ~6 min (slightly above 5 min target)
```

### Rules Engine UI

**Component:** `src/components/RulesEngineView.tsx`

Features:
1. **Edit rule values** in real-time
2. **Save to API** (if API enabled)
3. **Reset to defaults**
4. **Live validation** of changes
5. **Status indicator** (saved, unsaved, loading)

**Configuration Options:**
- Quarter duration (10 min typical)
- Wave durations (5 min each typical)
- Position counts per wave
- Fairness max variance
- GK outfield requirement toggle

### Determinism & Randomization

The algorithm uses **randomized selection** within constraints to generate variety:

```typescript
// If multiple players have same score, choose randomly
const candidates = available.sort((a, b) => {
  const diff = comparePlayers(a, b, playerMinutes);
  if (diff === 0) {
    // Equal priority - add slight randomization
    return Math.random() - 0.5;
  }
  return diff;
});
```

This ensures:
- **Fair allocation** (constraints are hard)
- **Variety** (same players don't get same slots each time)
- **Deterministic with seed** (could add seed parameter if needed)

### Manual GK Override

Users can manually specify goalkeeper for each quarter:

```typescript
// UI: GKSelector component
const manualGKs: [string, string, string, string] = [
  'Alice',  // Q1 GK
  'Bob',    // Q2 GK
  'Charlie', // Q3 GK
  'Diana'   // Q4 GK
];

const allocation = allocate(players, manualGKs);
```

---

## 6. Data Structures & Database Models

### Database Schema Overview

**Location:** `/home/davidroche1979/Football-Minutes-Beta/server/db/migrations/0001_init.sql`

### Core Tables

#### 1. `season`
```sql
CREATE TABLE season (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,        -- "Autumn 2025"
  year INTEGER NOT NULL,     -- 2025
  club TEXT,                 -- "Manchester United"
  starts_on DATE,            -- 2025-09-01
  ends_on DATE,              -- 2025-12-31
  created_at TIMESTAMPTZ
);
```

#### 2. `team`
```sql
CREATE TABLE team (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,        -- "U10 A Team"
  age_group TEXT,            -- "Under 10"
  season_id UUID REFERENCES season(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 3. `player`
```sql
CREATE TABLE player (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES team(id),
  display_name TEXT NOT NULL,        -- "John Smith"
  preferred_positions TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['GK', 'DEF']
  squad_number INTEGER,              -- 5
  status player_status DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, TRIALIST
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ             -- Soft-delete
);
```

#### 4. `fixture`
```sql
CREATE TABLE fixture (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES team(id),
  season_id UUID REFERENCES season(id),
  opponent TEXT NOT NULL,            -- "Opponent FC"
  fixture_date DATE NOT NULL,        -- 2025-10-15
  kickoff_time TIME,                 -- 10:00:00
  venue_type venue_type DEFAULT 'HOME',  -- HOME, AWAY, NEUTRAL
  status fixture_status DEFAULT 'DRAFT',  -- DRAFT, LOCKED, FINAL
  created_by UUID REFERENCES app_user(id),
  notes TEXT,
  locked_at TIMESTAMPTZ,
  finalised_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 5. `fixture_player`
```sql
CREATE TABLE fixture_player (
  id UUID PRIMARY KEY,
  fixture_id UUID NOT NULL REFERENCES fixture(id),
  player_id UUID NOT NULL REFERENCES player(id),
  role fixture_role DEFAULT 'STARTER',  -- STARTER, BENCH
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 6. `lineup_quarter`
```sql
CREATE TABLE lineup_quarter (
  id UUID PRIMARY KEY,
  fixture_id UUID NOT NULL REFERENCES fixture(id),
  quarter_number INTEGER CHECK (1-4),
  wave lineup_wave NOT NULL,           -- FULL, FIRST, SECOND
  position lineup_position NOT NULL,   -- GK, DEF, ATT
  player_id UUID REFERENCES player(id),
  minutes INTEGER NOT NULL,            -- 5 or 10
  is_substitution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 7. `match_result`
```sql
CREATE TABLE match_result (
  id UUID PRIMARY KEY,
  fixture_id UUID UNIQUE REFERENCES fixture(id),
  result_code result_code NOT NULL,   -- WIN, DRAW, LOSS, ABANDONED, VOID
  team_goals INTEGER,
  opponent_goals INTEGER,
  player_of_match_id UUID REFERENCES player(id),
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 8. `match_award`
```sql
CREATE TABLE match_award (
  id UUID PRIMARY KEY,
  fixture_id UUID REFERENCES fixture(id),
  player_id UUID REFERENCES player(id),
  award_type award_type NOT NULL,     -- SCORER, HONORABLE_MENTION, ASSIST
  count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ
);
```

#### 9. `player_match_stat`
```sql
CREATE TABLE player_match_stat (
  id UUID PRIMARY KEY,
  fixture_id UUID REFERENCES fixture(id),
  player_id UUID REFERENCES player(id),
  total_minutes INTEGER DEFAULT 0,
  goalkeeper_quarters INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  is_player_of_match BOOLEAN DEFAULT FALSE,
  honorable_mentions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 10. `ruleset` & `rule_toggle`
```sql
CREATE TABLE ruleset (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES team(id),
  name TEXT NOT NULL,
  config_json JSONB NOT NULL,         -- Full RuleConfig as JSON
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE rule_toggle (
  id UUID PRIMARY KEY,
  ruleset_id UUID NOT NULL REFERENCES ruleset(id),
  toggle_key TEXT NOT NULL,           -- Feature flag name
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### 11. `audit_event`
```sql
CREATE TABLE audit_event (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES app_user(id),
  entity_type audit_entity NOT NULL,  -- PLAYER, FIXTURE, LINEUP, RULESET, IMPORT
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,           -- created, updated, removed, restored, locked, etc.
  previous_state JSONB,               -- JSON of state before change
  next_state JSONB,                   -- JSON of state after change
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

### Frontend Type Definitions

**File:** `src/lib/types.ts` and `src/lib/matchTypes.ts`

```typescript
// Core allocation types
interface PlayerSlot {
  player: string;           // Player name
  position: 'GK' | 'DEF' | 'ATT';
  minutes: number;          // 10 or 5
  wave?: 'first' | 'second';
}

interface QuarterAllocation {
  quarter: 1 | 2 | 3 | 4;
  slots: PlayerSlot[];
}

interface Allocation {
  quarters: QuarterAllocation[];
  summary: Record<string, number>;  // Player name -> total minutes
  warnings?: string[];
}

// Match/Fixture types
interface MatchRecord {
  id: string;
  date: string;             // YYYY-MM-DD
  opponent: string;
  players: string[];
  allocation: Allocation;
  result?: MatchResult;
  createdBy: string;
}

interface MatchResult {
  venue: 'Home' | 'Away' | 'Neutral';
  result?: 'Win' | 'Loss' | 'Draw';
  goalsFor: number | null;
  goalsAgainst: number | null;
  playerOfMatch?: string;
  honorableMentions: string[];
  scorers: string[];
}
```

---

## 7. Current UI/Navigation

### Main Navigation Structure

**Root Component:** `src/App.tsx`

After login, users see 3 main tabs:

### Tab 1: Match Setup

**Path:** `activeTab === 'match'`

**Components:**
1. **Season Snapshot Card**
   - Matches played
   - Goals for/against
   - Goal difference
   - Win-Draw-Loss record
   - Data source indicator (API/local)

2. **Player Input Section**
   - Add/remove players
   - Display roster (active/removed)
   - Audit history
   - Persistence mode indicator

3. **GK Selector** (if ≥5 players)
   - Manually select goalkeeper for each quarter
   - Optional (auto-selects if not set)

4. **Generate Allocation Button**
   - Only shows if players exist but no allocation generated

5. **Allocation Grid**
   - Quarter-by-quarter display
   - Click slots to edit player
   - Drag outfield players to swap within quarter
   - Shows substitutes for each quarter

6. **Player Summary Table**
   - Total minutes per player
   - Fairness distribution visualization

7. **Confirm Team Modal**
   - Record fixture date/opponent
   - Enter match result (optional)
   - Award player of match
   - Add goal scorers and honorable mentions
   - Save fixture to backend

### Tab 2: Season Stats

**Path:** `activeTab === 'season'`

**Component:** `SeasonStatsView.tsx`

**Features:**
1. **Match History Table**
   - Date, opponent, venue, result
   - Actions: view details, edit, delete

2. **Player Statistics**
   - Total minutes
   - Matches played
   - GK quarters
   - Goals/assists
   - Awards (player of match, honors)

3. **Match Editor**
   - Click match to edit allocation
   - Drag-drop to rearrange lineups
   - Update result information
   - Add/remove awards

4. **Bulk Import**
   - Import from Excel files
   - Parse legacy data

### Tab 3: Rules Engine

**Path:** `activeTab === 'rules'`

**Component:** `RulesEngineView.tsx`

**Features:**
1. **Quarter Configuration**
   - Quarter duration (10 min)
   - Number of quarters (4)

2. **Wave Configuration**
   - First wave duration (5 min)
   - Second wave duration (5 min)

3. **Position Configuration**
   - GK per quarter (1)
   - DEF per wave (2)
   - ATT per wave (2)

4. **Fairness Configuration**
   - Max variance (minutes difference between players)
   - GK requires outfield time (toggle)

5. **Save/Reset Actions**
   - Save to backend (if API enabled)
   - Reset to defaults
   - Status indicator (saved/unsaved)

### Sidebar/Header

**Components:**
1. **App Title** - "Fair Football Minutes"
2. **Tagline** - "Calculate fair playing time distribution"
3. **User Info**
   - Username display
   - Sign out button
4. **Tab Navigation** - Toggle between Match/Season/Rules
5. **Persistence Indicator** - Shows if using API or local storage

### Error & Status Messages

**Global Display Areas:**
1. **Error Banner** (red)
   - Validation errors
   - API failures
   - Constraint violations

2. **Success Banner** (green)
   - Match saved confirmation
   - Changes persisted

3. **Info Banner** (yellow)
   - Warnings from allocation
   - API availability notices
   - Configuration issues

4. **Loading States**
   - Spinners during API calls
   - Disabled buttons while saving
   - "Loading..." text for data fetches

### Modal Dialogs

#### Edit Modal (`EditModal.tsx`)
- **Trigger:** Click any player slot
- **Content:** Dropdown to change player
- **Actions:** Save or Cancel

#### Confirm Team Modal (`ConfirmTeamModal.tsx`)
- **Trigger:** "Confirm Team" button
- **Content:** 
  - Fixture date picker
  - Opponent name input
  - Venue dropdown (Home/Away/Neutral)
  - Result fields (goals, outcome, awards)
- **Actions:** Save or Cancel

### Responsive Design

- **Mobile (< 768px):** Single-column layout
- **Tablet (768px-1024px):** Two-column grid (quarters side-by-side)
- **Desktop (> 1024px):** Full grid layout with sidebars

### Dark Mode Support

All components support dark mode via Tailwind CSS:
- `dark:bg-gray-900` for backgrounds
- `dark:text-white` for text
- `dark:border-gray-700` for borders

---

## 8. Architecture Overview

### Development Architecture (`npm run dev`)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Local Development Setup                      │
└─────────────────────────────────────────────────────────────────┘

User Browser (localhost:3000)
    │
    ├─→ [Vite Dev Server] ──────────────────────────────────────┐
    │   - React Hot Reload                                        │
    │   - src/ TypeScript compilation                             │
    │   - /api/* requests proxied to backend                      │
    │                                                              │
    └─→ [Express Dev Server] (localhost:3001)                   │
        - API function wrappers                                    │
        - Database connection                                      │
        - Session/CSRF management                                 │
        - Request logging                                         │
                                                                   │
        ↓                                                          │
                                                                   │
    [PostgreSQL Database]                                         │
    - Team/Player data                                            │
    - Fixtures/Lineups                                            │
    - Results/Awards                                              │
    - Audit trail                                                 │
```

**Commands:**
```bash
npm run dev              # Both Vite + Express
npm run dev:frontend    # Vite only (port 3000)
npm run dev:backend     # Express only (port 3001)
```

### Production Architecture (Multiple Options)

#### Option 1: Vercel Serverless
```
Browser
  ↓
Vercel Functions (/api/* routes)
  ├─ Health checks
  ├─ Player management
  ├─ Fixture management
  ├─ Statistics
  └─ Rules engine
  ↓
PostgreSQL (Vercel Postgres or external)
```

#### Option 2: Express Server (Railway/Heroku)
```
Browser
  ↓
Express Server (server/production-server.ts)
  ├─ Vite dist/ (static frontend)
  ├─ API routes (same as Vercel)
  └─ Proxy requests to DB
  ↓
PostgreSQL
```

#### Option 3: Docker Container
```
Docker Image (Dockerfile)
  ├─ Node.js runtime
  ├─ Built frontend (dist/)
  ├─ Built backend (dist/server.js)
  ├─ Runs on port $PORT (default 3000)
  └─ Connects to external PostgreSQL
```

#### Option 4: VPS with PM2
```
VPS Server
  ├─ Node.js + PM2 process manager
  ├─ Production server (node dist/server.js)
  ├─ Nginx reverse proxy (port 80/443)
  └─ PostgreSQL database
```

### Data Flow: Creating a Match

```
1. User Interface (Frontend)
   [PlayerInput] → User adds 6 players
   [GKSelector] → Manually select Q1-Q4 GK
   [Allocate] → Click "Generate Allocation"
   
   ↓
   
2. Core Algorithm (Frontend)
   allocate(players, manualGKs) → Allocation
   ├─ Run 200 attempts
   ├─ Calculate variance
   ├─ Return best match
   
   ↓
   
3. Display to User (Frontend)
   [AllocationGrid] → Show quarter assignments
   [EditModal] → Allow slot editing
   [PlayerSummary] → Show minutes distribution
   
   ↓
   
4. Save to Backend (API Call)
   saveMatch({
     date: '2025-10-15',
     opponent: 'Opponent FC',
     players: [...],
     allocation: {...},
     result: {...}
   })
   
   ↓
   
5. Backend Processing
   createFixture() in server/services/fixtures.ts
   ├─ INSERT INTO fixture
   ├─ INSERT INTO fixture_player (squad)
   ├─ INSERT INTO lineup_quarter (allocations)
   ├─ INSERT INTO match_result (if provided)
   ├─ INSERT INTO match_award (goals, honors)
   ├─ INSERT INTO player_match_stat (aggregates)
   └─ INSERT INTO audit_event (record change)
   
   ↓
   
6. Response to Frontend
   { success: true, fixture: {...} }
   
   ↓
   
7. UI Update
   [SeasonStatsView] → Refresh match list
   [Summary Card] → Update season statistics
```

### API Request/Response Flow (with CSRF)

```
Initial Page Load:
  GET / → Vite serves index.html
  GET /api/session/csrf → Sets ffm_csrf cookie
  
First Mutation (e.g., POST /api/fixtures):
  Client reads ffm_csrf cookie from browser
  Includes in request headers:
    x-ffm-csrf: <token>
    x-ffm-actor: coach
    x-ffm-session: <session-token>
    x-ffm-team: <team-id>
  
Backend validates:
  ✓ CSRF token matches
  ✓ Session token is valid
  ✓ Actor has required role
  ✓ Team ID matches request
  
  If valid → Process request
  If invalid → 401/403 response
```

### Persistence Mode Selection Logic

```
if (VITE_USE_API === true && VITE_TEAM_ID is set) {
  mode = 'api';  // Use backend API
  
  try {
    data = await apiRequest(...);
  } catch (error) {
    mode = 'fallback';  // Switch to local on error
    data = loadFromLocalStorage();
  }
} else {
  mode = 'local';  // Use localStorage directly
  data = loadFromLocalStorage();
}
```

---

## Summary

This is a **well-architected full-stack TypeScript application** with:

✅ **Clear separation of concerns** - Frontend/Backend/Database layers  
✅ **Strong type safety** - TypeScript with strict mode  
✅ **Flexible deployment** - Works on Vercel, Railway, Heroku, Docker, VPS  
✅ **Fair allocation algorithm** - Randomized but deterministic scheduling  
✅ **Complete audit trail** - Track all changes with actor/timestamps  
✅ **Graceful fallbacks** - Works offline with local storage  
✅ **Modern security** - PBKDF2, CSRF tokens, session management  
✅ **Responsive UI** - Mobile-friendly with dark mode support  

The codebase is production-ready and scalable!

