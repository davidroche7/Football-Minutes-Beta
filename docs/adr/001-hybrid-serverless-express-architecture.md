# ADR 001: Hybrid Serverless + Express Architecture

**Status:** Accepted
**Date:** 2025-10-23
**Decision Makers:** Development Team
**Tags:** architecture, backend, deployment

## Context

The Football Minutes application started with a Vercel serverless architecture (`/api` folder with TypeScript functions). While this works well for Vercel deployment, it created several challenges for local development:

1. **Complex local development**: Required Vercel CLI (`vercel dev`) which is slow and has startup overhead
2. **Inflexible deployment**: Locked into Vercel ecosystem, couldn't easily deploy to Railway, Heroku, VPS, or Docker
3. **Module resolution issues**: Serverless functions expect specific runtime environment different from Node.js
4. **No unified dev command**: Frontend and backend required separate terminal sessions

## Decision

We will adopt a **hybrid architecture** that maintains Vercel serverless compatibility while adding Express.js server capability:

### Architecture Components

```
Development:
  - Express dev server (server/dev-server.ts) on port 3001
  - Vite dev server (frontend) on port 3000 with proxy to :3001
  - Single command: npm run dev (runs both concurrently)

Production Options:
  ├─ Vercel: Uses /api serverless functions (existing setup)
  ├─ Railway/Heroku: Uses Express production server via Procfile
  ├─ Docker: Uses Express production server via Dockerfile
  └─ VPS/Self-hosted: Uses Express production server directly
```

### Key Principles

1. **Serverless functions remain unchanged**: API functions in `/api` folder stay Vercel-compatible
2. **Express wrapper for dev**: `server/dev-server.ts` dynamically imports and wraps serverless functions
3. **Separate production server**: `server/production-server.ts` serves both API and static frontend
4. **Vite proxy**: Frontend proxies `/api` requests to backend server in development
5. **TypeScript configuration**: Separate `tsconfig.api.json` for backend code with proper module resolution

## Consequences

### Positive

- ✅ **Fast local development**: No Vercel CLI overhead, instant server restarts with `tsx watch`
- ✅ **Deployment flexibility**: Can deploy to any platform (Vercel, Railway, Heroku, Docker, VPS)
- ✅ **Single dev command**: `npm run dev` starts both frontend and backend
- ✅ **Production-ready Express**: Full featured server with static file serving, health checks
- ✅ **Type safety maintained**: Strict TypeScript checking for both frontend and backend
- ✅ **Code reuse**: Same API code works for both Vercel and Express deployments

### Negative

- ⚠️ **Two server files to maintain**: `dev-server.ts` and `production-server.ts` (but they're nearly identical)
- ⚠️ **Route registration overhead**: API routes must be manually registered in server files
- ⚠️ **Testing complexity**: Need to test both Vercel serverless and Express deployment paths

### Neutral

- 🔄 **Build process**: Now builds both frontend and backend (`npm run build`)
- 🔄 **Dependencies**: Added Express, CORS, tsx, esbuild as dependencies

## Alternatives Considered

### 1. Pure Vercel Serverless (Status Quo)

**Pros:**
- No changes needed
- Vercel deployment is seamless

**Cons:**
- Slow local development
- Locked into Vercel
- Complex module resolution

**Rejected because:** Too limiting for development experience and deployment flexibility

### 2. Convert Fully to Express

**Pros:**
- Simple architecture
- Fast development
- Flexible deployment

**Cons:**
- Lose Vercel serverless compatibility
- Need to rewrite all API functions
- Breaking change for existing codebase

**Rejected because:** Too much refactoring, loses Vercel compatibility

### 3. Use Vercel CLI for Development

**Pros:**
- Matches production exactly
- No wrapper code needed

**Cons:**
- Slow startup (~10-30 seconds)
- Complex debugging
- Still locked into Vercel

**Rejected because:** Poor developer experience

## Implementation Notes

### File Structure

```
server/
  ├── dev-server.ts           # Express wrapper for local development
  ├── production-server.ts    # Full Express server for production
  ├── db/                     # Database client and types
  └── services/               # Business logic services

api/                          # Vercel serverless functions (unchanged)
  ├── _lib/                   # Shared utilities
  ├── players/
  ├── fixtures/
  └── ...

tsconfig.api.json            # Backend TypeScript configuration
package.json                 # Updated with dev/build scripts
```

### Script Changes

```json
{
  "dev": "concurrently npm:dev:frontend npm:dev:backend",
  "dev:frontend": "vite",
  "dev:backend": "tsx watch --env-file=.env server/dev-server.ts",
  "build": "npm run build:frontend && npm run build:backend",
  "start": "NODE_ENV=production node dist/server.js"
}
```

### Environment Variables

Consolidated to single `.env` file with clear sections for server, database, security, and frontend config.

## References

- [Vercel Node.js Runtime](https://vercel.com/docs/runtimes/node-js)
- [Express.js Documentation](https://expressjs.com/)
- [tsx - TypeScript Execute](https://github.com/privatenumber/tsx)
- [esbuild - Bundler](https://esbuild.github.io/)

## Related ADRs

- [ADR 002: TypeScript Module Resolution Strategy](./002-typescript-module-resolution.md)
