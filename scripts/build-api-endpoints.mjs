#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const apiDir = join(rootDir, 'api');

// Find all .ts files in /api (not subdirectories, not .test.ts)
const apiFiles = readdirSync(apiDir)
  .filter(file => file.endsWith('.ts') && !file.includes('.test.'))
  .map(file => join(apiDir, file));

console.log(`Building ${apiFiles.length} API endpoints...`);

for (const file of apiFiles) {
  const filename = file.split('/').pop().replace('.ts', '');
  console.log(`  - Building ${filename}.ts`);

  try {
    await build({
      entryPoints: [file],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      outfile: join(apiDir, `${filename}.mjs`),
      external: ['@vercel/node', '@vercel/postgres', 'pg', 'express', 'cors', 'dotenv'],
      tsconfig: join(rootDir, 'tsconfig.api.json'),
      absWorkingDir: rootDir,
      resolveExtensions: ['.ts', '.js', '.mjs'],
      logLevel: 'error',
    });
  } catch (error) {
    console.error(`✗ Failed to build ${filename}.ts:`, error);
    process.exit(1);
  }
}

console.log('✓ All API endpoints built successfully');
