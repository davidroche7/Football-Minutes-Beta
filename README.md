# Fair Football Minutes

Calculate fair playing time distribution for 5-a-side football teams across 4 quarters.

## Features

- Automatic fair distribution of playing minutes
- Support for 6-12 players
- Position-based allocation (GK, DEF, ATT)
- Goalkeeper rotation with mandatory outfield time
- Manual editing with automatic rebalancing
- Export to Excel

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
fair-football-minutes/
├── src/
│   ├── components/       # React components
│   ├── lib/              # Business logic (allocation algorithm)
│   ├── config/           # Configuration constants
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Helper functions
│   └── tests/            # Test files
├── public/               # Static assets
└── index.html            # Entry HTML
```

## How It Works

### Match Structure

- **4 quarters** x **15 minutes** each
- **5 positions per quarter**: 1 GK, 2 DEF, 2 ATT

### Time Blocks

- **GK**: Plays full 15-minute quarter
- **Outfield (DEF/ATT)**: Either first 10 minutes OR last 5 minutes per quarter
- **Sub**: Not playing (0 minutes)

### Fairness Rules

1. Minimize variance between player total minutes
2. No player plays more than 5 minutes more than another (where possible)
3. Players assigned GK must get at least one 10-minute outfield block
4. All quarters must be fully staffed

## Configuration

Edit `src/config/constants.ts` to customize:

- Quarter duration
- Position counts
- GK desirability rules
- Max minute variance

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint + Prettier
- **Export**: SheetJS (xlsx)

## License

MIT

## Support

For issues or feature requests, please open an issue in the project repository.
