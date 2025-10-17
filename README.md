# Fair Football Minutes

Calculate fair playing time distribution for 5-a-side football teams across 4 quarters.

## Features

- Automatic fair distribution of playing minutes
- Support for 5-15 players
- Position-based allocation (GK, DEF, ATT)
- Goalkeeper rotation with mandatory outfield time
- Manual editing with automatic rebalancing
- Export to Excel
- Secure login (PBKDF2) with session management
- Rules engine tab to tune timing/fairness constraints
- Season stats dashboard with audit history for match edits

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
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
└── data-model.json        # TOGAF-aligned data model
index.html / vite.config.ts
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
