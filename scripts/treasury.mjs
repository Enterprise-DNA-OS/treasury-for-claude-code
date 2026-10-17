#!/usr/bin/env node
// The one CLI. Human tables by default, --json for machines. Every write runs in one transaction
// and lands in the audit trail; reads run read-only.
//
//   node scripts/treasury.mjs <command> [record] [--key=value] [--json]
import fs from 'node:fs';
import { getDb } from './lib/db.mjs';
import { exportAll, human, mutations, questions, reads, run } from './lib/domain.mjs';
import { importKyriba } from './lib/import.mjs';
import { boardReport, certificate, weeklyReview } from './lib/drafts.mjs';

const RECORD_READS = ['account', 'facility', 'hedge'];
const FLAGS = {
  add: ['file'], balance: ['on', 'amount'], rate: ['on', 'rate'], settle: ['on', 'actual'], cancel: ['reason'], move: ['to'],
  designate: ['on', 'ref', 'exposure'], 'settle-hedge': ['on'], 'test-covenant': ['period-end', 'value', 'on', 'by'], 'certificate-sent': ['on'],
  draw: ['amount'], repay: ['amount'], 'remove-signatory': ['person', 'on'], left: ['on'], 'approve-policy': ['on', 'by', 'ref'], log: ['note'],
  import: ['kind', 'file', 'map', 'dry-run'], export: ['out'],
};

const args = process.argv.slice(2), flags = {}, pos = [];
let db;
try {
  for (const a of args) {
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const eq = a.indexOf('='), k = a.slice(2, eq < 0 ? undefined : eq);
    if (k in flags) throw Error(`--${k} given twice`);
    flags[k] = eq < 0 ? true : a.slice(eq + 1);
  }
  const [cmd, term] = pos;
  if (!cmd || flags.help) {
    console.log(['treasury <command> [record] [--key=value] [--json]', '',
      'Reads:     ' + Object.keys(reads).join(', '), 'Records:   ' + RECORD_READS.map((c) => `${c} <code>`).join(', '),
      'Reviews:   insights, weekly-review, draft-board-report, draft-certificate <covenant>',
      'Writes:    ' + mutations.join(', ') + '  (all need --actor="Your Name")', 'Data:      import kyriba --kind=balances|flows|hedges --file= --map= [--dry-run], export [--out=file.json]'].join('\n'));
    process.exit(0);
  }
  if (pos.length > 2) throw Error('Too many arguments: quote names with spaces');
  const allowed = ['json', 'actor', ...(FLAGS[cmd] || [])];
  for (const k of Object.keys(flags)) if (!allowed.includes(k)) throw Error(`--${k} does not apply to ${cmd}`);
  for (const [k, v] of Object.entries(flags)) if (!['json', 'dry-run'].includes(k) && typeof v !== 'string') throw Error(`--${k} needs a value: --${k}=...`);

  const known = [...Object.keys(reads), ...RECORD_READS, ...mutations, 'insights', 'weekly-review', 'draft-board-report', 'draft-certificate', 'import', 'export'];
  if (!known.includes(cmd)) throw Error(`Unknown command ${cmd}. Run with --help for the list.`);
  if (RECORD_READS.includes(cmd) && !term) throw Error(`${cmd} needs a record: ${cmd} <code or name>`);

  db = await getDb();
  const writes = mutations.includes(cmd) || ['import', 'draft-board-report', 'draft-certificate'].includes(cmd);
  await db.exec(writes ? 'BEGIN' : 'BEGIN READ ONLY');
  let out;
  try {
    if (cmd === 'import') {
      if (term !== 'kyriba') throw Error('import supports kyriba: import kyriba --kind=balances|flows|hedges --file=report.csv --map=mapping.json');
      out = await importKyriba(db, { kind: flags.kind, file: flags.file, map: flags.map, actor: flags.actor, dryRun: flags['dry-run'] === true });
    } else if (cmd === 'export') {
      const data = await exportAll(db);
      if (flags.out) { fs.writeFileSync(flags.out, JSON.stringify(data, null, 2)); out = { file: flags.out, tables: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) }; }
      else out = data;
    } else if (cmd === 'weekly-review') out = await weeklyReview(db);
    else if (cmd === 'draft-board-report') out = await boardReport(db);
    else if (cmd === 'draft-certificate') out = await certificate(db, term);
    else out = await run(db, cmd, term, flags);
    await db.exec(flags['dry-run'] === true ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  if (cmd === 'export' && !flags.out) console.log(JSON.stringify(out, null, 2));
  else console.log(flags.json ? JSON.stringify(out, null, 2) : human(out));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
export { questions };
