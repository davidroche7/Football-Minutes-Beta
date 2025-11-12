#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

try {
  await build({
    entryPoints: [join(rootDir, 'api/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: join(rootDir, 'api/index.mjs'),
    external: ['@vercel/node', 'pg', 'express', 'cors'],
    tsconfig: join(rootDir, 'tsconfig.api.json'),
    // Resolve all imports relative to project root
    absWorkingDir: rootDir,
    // Allow TypeScript file extensions in imports
    resolveExtensions: ['.ts', '.js', '.mjs'],
    logLevel: 'info',
  });
  console.log('✓ API bundle built successfully');
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
