# ADR 002: TypeScript Module Resolution Strategy

**Status:** Accepted
**Date:** 2025-10-23
**Decision Makers:** Development Team
**Tags:** typescript, configuration, tooling

## Context

The project uses TypeScript 5.9.3 with multiple runtime environments:

1. **Frontend (Vite)**: React app bundled by Vite
2. **Backend (Node.js)**: API functions and services running in Node.js/Vercel
3. **Tests (Vitest)**: Test files running in jsdom environment

Initial TypeScript configuration had several issues:

- Single `tsconfig.json` using `"moduleResolution": "bundler"` for everything
- Backend code included in frontend tsconfig, causing conflicts
- Node16 module resolution requiring `.js` extensions in imports
- Compilation errors with newer TypeScript strictness

## Decision

We will use **separate TypeScript configurations** with "bundler" module resolution for both frontend and backend:

### Configuration Structure

```
tsconfig.json              → Frontend (src/) only
tsconfig.api.json          → Backend (api/, server/, scripts/)
tsconfig.node.json         → Build tools (vite.config.ts)
```

### Key Configuration Decisions

1. **Use "bundler" module resolution everywhere**
   - Simpler import syntax (no `.js` extensions needed)
   - Works with Vite, tsx, and esbuild
   - Matches modern JavaScript tooling expectations

2. **Separate frontend and backend configs**
   - Prevents cross-contamination
   - Different `lib` and `types` for each environment
   - Clear separation of concerns

3. **Maintain strict type checking**
   - `strict: true`
   - `noUnusedLocals: true`
   - `noUnusedParameters: true`
   - `noUncheckedIndexedAccess: true`
   - `noFallthroughCasesInSwitch: true`

### tsconfig.json (Frontend)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "strict": true
  },
  "include": ["src"]
}
```

### tsconfig.api.json (Backend)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "noEmit": true
  },
  "include": ["api/**/*", "server/**/*", "types/**/*", "scripts/**/*"]
}
```

## Consequences

### Positive

- ✅ **No .js extension imports**: Cleaner import statements
- ✅ **Fast type checking**: Both configs run independently
- ✅ **Better IDE support**: Clear boundaries for IntelliSense
- ✅ **Strict type safety**: Catches more bugs at compile time
- ✅ **Works with modern tooling**: Compatible with Vite, tsx, esbuild

### Negative

- ⚠️ **Multiple configs to maintain**: Need to keep configs in sync
- ⚠️ **Not "true" Node ESM**: Using bundler resolution instead of Node16/NodeNext
- ⚠️ **Runtime vs compile time**: TypeScript paths don't match runtime paths exactly

### Neutral

- 🔄 **Build process handles transformation**: tsx and esbuild handle actual module resolution
- 🔄 **Type checking separated**: `npm run typecheck` checks both configs

## Alternatives Considered

### 1. Node16/NodeNext Module Resolution

**Pros:**
- "Correct" for Node.js ESM
- Enforces .js extensions
- Future-proof

**Cons:**
- Requires .js extensions in imports (even for .ts files)
- Conflicts with Vite bundler mode
- Poor developer experience

**Rejected because:** Incompatible with Vite and adds import friction

### 2. Single tsconfig.json for Everything

**Pros:**
- Simple, one config
- No duplication

**Cons:**
- Frontend gets Node.js types
- Backend gets DOM types
- Slower compilation
- Conflicting module resolution needs

**Rejected because:** Causes type pollution and slower builds

### 3. Use TypeScript Project References

**Pros:**
- Official way to split configs
- Incremental builds
- Clear dependencies

**Cons:**
- Requires `composite: true`
- Must emit declaration files
- Complex setup for our use case

**Rejected because:** Over-engineered for our needs, conflicts with `noEmit: true`

## Implementation Notes

### Type Checking

```bash
# Check frontend only
npx tsc --noEmit

# Check backend only
npx tsc --project tsconfig.api.json --noEmit

# Check both (added to package.json)
npm run typecheck
```

### Build Process

- **Frontend**: Vite handles bundling, uses tsconfig.json
- **Backend**: tsx (dev) and esbuild (prod) handle execution/bundling, use tsconfig.api.json
- **Tests**: Vitest uses tsconfig.json with test environment

### Strict Type Errors Fixed

1. **security.ts**: Changed `sessionSecret` initialization to guarantee non-undefined
2. **Test mocks**: Created proper `MockResponse` type for VercelResponse mocks
3. **Vercel types**: Added proper type assertions for Express↔Vercel compatibility

## Migration Guide

For developers updating existing code:

1. **No import changes needed**: Continue using `.ts` extensions in imports
2. **IDE restart**: Restart TypeScript server after pulling config changes
3. **New npm script**: Use `npm run typecheck` to check all TypeScript files

## References

- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [TypeScript 5.0+ Bundler Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#bundler)
- [Vite TypeScript Guide](https://vitejs.dev/guide/features.html#typescript)

## Related ADRs

- [ADR 001: Hybrid Serverless + Express Architecture](./001-hybrid-serverless-express-architecture.md)
