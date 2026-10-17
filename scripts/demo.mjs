#!/usr/bin/env node
// npm run demo: a fresh demo database in .data/demo, the fictional group loaded, three commands,
// then every view and document rendered into .data/demo-output. Your own data is never touched.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/db.mjs';

const dataDir = path.join(REPO_ROOT, '.data', 'demo');
fs.rmSync(dataDir, { recursive: true, force: true });
fs.rmSync(path.join(REPO_ROOT, '.data', 'demo-output'), { recursive: true, force: true });
const env = { ...process.env, DATABASE_URL: '', DATA_DIR: dataDir, OUTPUT_DIR: path.join(REPO_ROOT, '.data', 'demo-output') };
const steps = [['scripts/migrate.mjs'], ['scripts/seed.mjs'], ['scripts/treasury.mjs', 'forecast'], ['scripts/treasury.mjs', 'fx-cover'], ['scripts/treasury.mjs', 'attention'], ['scripts/view.mjs'], ['scripts/docs.mjs']];
for (const args of steps) {
  if (args[1]) console.log(`\n> treasury ${args[1]}`);
  const p = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env, stdio: 'inherit' });
  if (p.status !== 0) process.exit(p.status || 1);
}
console.log('\nDemo ready. Views in .data/demo-output/views, documents in .data/demo-output/docs-out.');
