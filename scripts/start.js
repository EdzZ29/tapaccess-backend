/* eslint-disable */
/**
 * `npm start` — runs the compiled API (dist/main.js).
 *
 * Hosting platforms often default to `npm start`. If the build step was
 * skipped, this builds once first (when the Nest CLI is installed) or explains
 * which build command to set, instead of failing with an obscure error.
 */
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const main = join(__dirname, '..', 'dist', 'main.js');

if (!existsSync(main)) {
  const nest = join(__dirname, '..', 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  if (!existsSync(nest)) {
    console.error(
      [
        '',
        'TapAccess API: the app has not been built (dist/main.js is missing).',
        'Set the Build Command to:   npm ci --include=dev && npm run build',
        'and the Start Command to:   npm start',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  console.log('dist/main.js not found — building once before starting…');
  const result = spawnSync(process.execPath, [nest, 'build'], { stdio: 'inherit', cwd: join(__dirname, '..') });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

require(main);
