# Football Minutes

> Multi-user team management platform for tracking your football season - lineups, stats, and fair playing time distribution.

A full-stack TypeScript application with **PostgreSQL persistence** for managing football team rosters, generating fair playing time allocations, tracking match results, analyzing season statistics, and maintaining complete season records.

## Features

- **Multi-User**: PostgreSQL-backed persistence - works across browsers and users
- **Smart Allocation**: Automatic fair distribution of playing minutes across 4 quarters
- **Flexible Rosters**: Support for 5-15 players with GK rotation and mandatory outfield time
- **Interactive Editor**: Drag/drop quarter editor with real-time validation
- **Match Management**: Complete flow for recording matches, scores, awards, and lineups
- **Season Analytics**: Player stats, minutes tracking, goals, awards, and audit history
- **Data Import**: Import historical data from Excel spreadsheets
- **Secure Auth**: Session-based authentication with CSRF protection (TODO)
- **Rules Engine**: Configurable fairness rules and timing constraints

## Quick Start

### Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** 15+ (via Docker, local, or cloud)

### Installation

```bash
# Clone and install
git clone https://github.com/davidroche7/Football-Minutes-Beta.git
cd Football-Minutes-Beta
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Run database migrations
npm run db:migrate

# Start development servers (frontend + backend)
npm run dev
```

The app will be available at **http://localhost:3000**

### Default Credentials

Two accounts are pre-configured:

- **Coach**: `coach` / `CoachSecure1!`
- **Manager**: `manager` / `ManagerSecure2@`

## Documentation

- **[Development Guide](./docs/DEVELOPMENT.md)** - Local development setup, workflows, and troubleshooting
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Deploy to Vercel, Railway, Heroku, Docker, or VPS
- **[Architecture Decision Records](./docs/adr/)** - Key architectural decisions and rationale
- **[API Documentation](./docs/api-surface-v2.md)** - REST API endpoints reference
- **[Security Guide](./docs/security.md)** - Authentication, CSRF, and session management

## Architecture

```
Frontend (Vite + React)       Backend (Express API)
     :3000                         :3001
┌──────────────┐              ┌────────────────────────┐
│              │──── /api ────▶│  Express Server        │
│  React SPA   │   (proxy)     │  ├─ Players CRUD       │
│  TypeScript  │               │  ├─ Fixtures CRUD      │
│  Tailwind    │               │  ├─ Stats endpoints    │
└──────────────┘              │  ├─ Rules/Audit        │
                              │  └─ Health checks      │
                              └────────────────────────┘
                                        │
                                        ▼
                              ┌────────────────────────┐
                              │  PostgreSQL Database   │
                              │  (Neon / Railway)      │
                              └────────────────────────┘
```

### Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- Vitest (testing)

**Backend**
- Node.js 20 + TypeScript
- Express.js (unified dev + production server)
- PostgreSQL + pg driver (raw SQL, ~1200 LOC service layer)
- Zod (validation)

**Deployment**
- Railway (recommended - built-in PostgreSQL)
- Heroku (via Procfile)
- Docker support
- Any Node.js hosting platform

## Testing & Quality

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint

# Format code
npm run format
```

## Project Structure

```
Football-Minutes-Beta/
├── src/                   # Frontend React application
│   ├── components/        # React components
│   ├── lib/               # Client-side utilities
│   └── config/            # Configuration files
├── api/                   # Backend API functions (Vercel serverless)
│   ├── _lib/              # Shared utilities
│   ├── players/           # Player endpoints
│   ├── fixtures/          # Fixture endpoints
│   └── stats/             # Statistics endpoints
├── server/                # Server code
│   ├── dev-server.ts      # Express dev server
│   ├── production-server.ts # Express production server
│   ├── db/                # Database client
│   └── services/          # Business logic
├── docs/                  # Documentation
│   ├── adr/               # Architecture Decision Records
│   ├── DEVELOPMENT.md     # Development guide
│   └── DEPLOYMENT.md      # Deployment guide
├── scripts/               # Utility scripts
└── types/                 # Shared TypeScript types
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

### Fairness Rules

Rule settings are configured in `src/config/rules.ts` and can be overridden via the Rules Engine tab in the UI. Changes persist to the database when using API mode.

### Environment Variables

See `.env.example` for all configuration options. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `FFM_SESSION_SECRET` - Session signing secret (32+ characters)
- `VITE_USE_API` - Enable backend API mode (vs. localStorage)
- `VITE_TEAM_ID` - Team UUID for API requests

For detailed environment setup, see the [Development Guide](./docs/DEVELOPMENT.md).

## Deployment

### Railway (Recommended)

Railway provides managed PostgreSQL and auto-deploys from GitHub:

1. **Create Railway account** at [railway.app](https://railway.app)
2. **New Project** → Deploy from GitHub repo
3. **Add PostgreSQL** database to project
4. **Set environment variables**:
   - `DATABASE_URL` (auto-populated by Railway)
   - `PORT` (auto-populated)
   - `NODE_ENV=production`
   - `VITE_TEAM_ID` (get from database after migration)
   - `VITE_USE_API=true`
5. **Run migrations**: Railway console → `node scripts/db/migrate.cjs`
6. **Create team**: `node scripts/seed-team.cjs` → copy team UUID
7. **Update** `VITE_TEAM_ID` with team UUID
8. **Deploy**: Commits to `main` branch auto-deploy

### Other Platforms

- **Heroku**: Uses `Procfile`, add PostgreSQL addon
- **Docker**: See Dockerfile (TODO)
- **VPS**: PM2 + Nginx (see [DEPLOYMENT.md](./docs/DEPLOYMENT.md))

## Data Import

Import historical match data from Excel:

```bash
# Parse Excel file to JSON
npm run import:legacy

# Seed database from JSON
node scripts/db/seed-from-json.cjs
```

See [Development Guide](./docs/DEVELOPMENT.md#database-operations) for details.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and test: `npm test && npm run typecheck`
4. Commit with clear messages
5. Push and create a pull request

See [Development Guide](./docs/DEVELOPMENT.md) for detailed workflow.

## License

MIT - see [LICENSE](./LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/davidroche7/Football-Minutes-Beta/issues)
- **Discussions**: [GitHub Discussions](https://github.com/davidroche7/Football-Minutes-Beta/discussions)
- **Documentation**: [docs/](./docs/)

## Further Reading

- [Architecture Decision Records](./docs/adr/) - Why we made key technical decisions
- [API Documentation](./docs/api-surface-v2.md) - REST API reference
- [Security Guide](./docs/security.md) - Authentication and security model
- [Data Model](./docs/data-model-v2.md) - Database schema and relationships
# Trigger rebuild with correct env vars


