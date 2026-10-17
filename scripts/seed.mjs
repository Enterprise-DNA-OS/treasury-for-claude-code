#!/usr/bin/env node
// Loads the fictional demo group from supabase/seed.sql. Safe to run twice.
import fs from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';

const db = await getDb();
try {
  await db.exec('BEGIN');
  await db.exec(fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
  await db.exec('COMMIT');
  console.log('seed: demo group loaded (Tasman Orchards Demo, NZ parent and AU subsidiary)');
} catch (e) {
  await db.exec('ROLLBACK');
  throw e;
} finally {
  await db.close();
}
