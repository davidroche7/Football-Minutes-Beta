# Development Guide

This guide covers local development setup and workflows for the Football Minutes application.

## Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** 15+ (via Docker, local install, or cloud service)
- **Git** for version control

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/davidroche7/Football-Minutes-Beta.git
cd Football-Minutes-Beta
npm install
```

### 2. Set Up Database

Start PostgreSQL (example using Docker):

```bash
docker run --name football-minutes-db \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=football_minutes \
  -p 5432:5432 \
  -d postgres:15
```

Run migrations:

```bash
npm run db:migrate
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings (database URL, etc.).

The default configuration works out of the box if you used the Docker command above.

### 4. Start Development Server

```bash
npm run dev
```

This starts:
- **Frontend** on http://localhost:3000 (Vite dev server)
- **Backend** on http://localhost:3001 (Express dev server)

The frontend automatically proxies API requests to the backend.

## Project Structure

```
Football-Minutes-Beta/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── lib/                # Client-side utilities
│   ├── config/             # Configuration files
│   └── App.tsx             # Main app component
│
├── api/                    # Backend API functions (Vercel serverless compatible)
│   ├── _lib/               # Shared API utilities
│   ├── players/            # Player endpoints
│   ├── fixtures/           # Fixture endpoints
│   ├── stats/              # Statistics endpoints
│   └── ...
│
├── server/                 # Server code
│   ├── dev-server.ts       # Express dev server
│   ├── production-server.ts # Express production server
│   ├── db/                 # Database client
│   └── services/           # Business logic services
│
├── docs/                   # Documentation
│   ├── adr/                # Architecture Decision Records
│   ├── backend-setup.md
│   └── ...
│
├── scripts/                # Utility scripts
│   └── db/                 # Database scripts
│
├── types/                  # Shared TypeScript types
├── tsconfig.json           # Frontend TypeScript config
├── tsconfig.api.json       # Backend TypeScript config
└── vite.config.ts          # Vite configuration
```

## Development Workflows

### Running Only Frontend

```bash
npm run dev:frontend
```

### Running Only Backend

```bash
npm run dev:backend
```

### Type Checking

```bash
# Check all TypeScript files
npm run typecheck

# Check only frontend
npx tsc --noEmit

# Check only backend
npx tsc --project tsconfig.api.json --noEmit
```

### Linting & Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format

# Check formatting without changing files
npm run format:check
```

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm test -- --run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Environment Variables

Environment variables are loaded from `.env` file. See `.env.example` for all available options.

### Key Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `FFM_SESSION_SECRET` | Session signing secret | Required |
| `API_PORT` | Backend server port | 3001 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |
| `VITE_USE_API` | Enable API mode vs localStorage | true |
| `VITE_API_BASE_URL` | API base URL for frontend | /api |
| `VITE_TEAM_ID` | Team UUID for API requests | Required if VITE_USE_API=true |

## Database Operations

### Run Migrations

```bash
npm run db:migrate
```

### Import Legacy Data

If you have historical data in `data/FOOTBALL LINEUPS.xlsx`:

```bash
# Parse Excel → JSON
npm run import:legacy

# Seed database from JSON
DATABASE_URL=your_url node scripts/db/seed-from-json.cjs
```

## Troubleshooting

### Port Already in Use

If ports 3000 or 3001 are taken, update `.env`:

```bash
API_PORT=3002  # or another available port
```

And update Vite config if changing frontend port.

### Database Connection Errors

1. Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
2. Check `DATABASE_URL` in `.env`
3. Ensure database exists: `createdb football_minutes`
4. Run migrations: `npm run db:migrate`

### TypeScript Errors

1. Make sure `node_modules` is up to date: `npm install`
2. Restart TypeScript server in your IDE
3. Run `npm run typecheck` to see all errors

### Module Not Found Errors

The project uses ESM (`"type": "module"` in package.json). If you see module errors:

1. Check import paths have `.ts` extensions in source files
2. Verify `tsconfig.json` and `tsconfig.api.json` are correct
3. Clear dist and restart: `rm -rf dist && npm run dev`

## Building for Production

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production build and deployment guides.

## Architecture

For architectural decisions and rationale, see:

- [ADR 001: Hybrid Serverless + Express Architecture](./adr/001-hybrid-serverless-express-architecture.md)
- [ADR 002: TypeScript Module Resolution](./adr/002-typescript-module-resolution.md)

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Commit with descriptive message
6. Push and create pull request

## Getting Help

- Check [docs/](.) for guides
- Review [ADRs](./adr/) for architectural context
- Open an issue on GitHub
