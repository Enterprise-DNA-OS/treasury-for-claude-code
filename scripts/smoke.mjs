#!/usr/bin/env node
// npm test: a fresh database in a temp folder, migrate, seed twice, then every command and every guard.
// TEST_DATABASE_URL runs the same checks against a real Postgres in a throwaway schema.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { questions, reads, resolve, run, exportAll, tables } from './lib/domain.mjs';
import { importKyriba } from './lib/import.mjs';
import { boardReport, certificate, weeklyReview } from './lib/drafts.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'treasury-test-'));
process.env.DATA_DIR = path.join(tmp, 'db');
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const schema = 'test_' + Date.now();
let db, checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const tx = async (fn) => { await db.exec('BEGIN'); try { const v = await fn(); await db.exec('COMMIT'); return v; } catch (e) { await db.exec('ROLLBACK'); throw e; } };
const reject = async (fn, re) => { await assert.rejects(() => tx(fn), re); checks++; };
const as = (cmd, term, f = {}) => tx(() => run(db, cmd, term, { actor: 'Test operator', ...f }));
const file = (name, v) => { const p = path.join(tmp, name); fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v)); return p; };
const add = (kind, d) => as('add', kind, { file: file(`${kind}-${checks}.json`, d) });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const issues = async (cmd) => (await run(db, cmd)).map((r) => `${r.issue} | ${r.record}`);
const has = (list, text, record) => list.some((x) => x.includes(text) && (!record || x.includes(`| ${record}`)));

try {
  db = await getDb();
  if (process.env.TEST_DATABASE_URL) { await db.exec(`create schema ${schema}; set search_path to ${schema}`); process.env.PGOPTIONS = `-c search_path=${schema}`; }

  // Schema and seed
  eq((await migrate(db)).ran.length, 1, 'migration applies');
  eq((await migrate(db)).ran.length, 0, 'migration is a no-op the second time');
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
  await tx(() => db.exec(seed));
  const flows = (await db.query('select count(*)::integer n from cash_flows'))[0].n;
  await tx(() => db.exec(seed));
  eq((await db.query('select count(*)::integer n from cash_flows'))[0].n, flows, 'seed is idempotent');
  for (const cmd of Object.keys(reads)) ok(Array.isArray(await run(db, cmd)), `read ${cmd}`);

  // The position and the forecast
  const position = await run(db, 'position');
  eq(position.reduce((s, r) => s + Number(r.base_cents), 0), 622500000, 'group cash in NZD at the latest rates');
  const weeks = await run(db, 'forecast');
  eq(weeks.length, 13, 'thirteen weeks');
  eq(Number(weeks[0].opening_cents), 622500000, 'week 0 opens on today\'s cash');
  ok(weeks.every((w, i) => i === 0 || Number(w.opening_cents) === Number(weeks[i - 1].closing_cents)), 'each week opens on the last close');
  ok(Number(weeks[0].in_cents) >= 30600000, 'the overdue USD receipt sits in week 0');
  ok(weeks.some((w) => Number(w.over_floor_cents) < 0), 'the forecast breaks the floor somewhere');

  // FX cover against policy
  const cover = Object.fromEntries((await run(db, 'fx-cover')).map((r) => [`${r.currency} ${r.months_from}`, r]));
  eq(cover['USD 0'].status, 'within policy', 'USD 0-6 months within band');
  eq(Number(cover['USD 0'].hedged_cents), 200000000, 'USD 0-6 months hedged 2m');
  eq(cover['USD 6'].status, 'under policy', 'USD 6-12 months under band');
  eq(cover['EUR 0'].status, 'under policy', 'EUR payment under band');

  // Attention and compliance on the demo data
  let att = await issues('attention'), comp = await issues('compliance');
  for (const [t, r] of [['Signatory has left', 'NZ-OPS'], ['Receipt overdue', 'CF-USD-LATE'], ['Balance not loaded', 'NZ-EUR'], ['certificate overdue', 'ICR-ANZ'], ['Deposits over bank limit', 'BNZ'], ['Hedge settles in', 'FWD-101'], ['Facility matures', 'TL-ANZ'], ['Covenant headroom', 'LVR-ANZ'], ['Forecast below liquidity floor']]) ok(has(att, t, r), `attention: ${t}`);
  for (const [t, r] of [['no hedge documentation', 'FWD-104'], ['documented after the trade date', 'FWD-103'], ['200% of the hedged item', 'FWD-101'], ['past its review date'], ['Former staff', 'NZ-CALL: Sarah Lee'], ['certificate not delivered', 'ICR-ANZ']]) ok(has(comp, t, r), `compliance: ${t}`);
  eq(comp.length, 10, 'ten compliance findings on the demo data');

  // Ten questions
  const insights = await run(db, 'insights');
  eq(Object.keys(insights).length, 10, 'ten questions');
  eq(questions.length, 10, 'ten questions listed');
  const answers = Object.values(insights);
  eq(answers[3][0].bank, 'BNZ', 'BNZ holds too much cash');
  eq(Number(answers[3][0].over_cents), 40000000, 'by 400k');
  eq(answers[4][0].code, 'LVR-ANZ', 'tight covenant');
  eq(answers[7].length, 2, 'one leaver on two mandates');
  eq(answers[9].length, 3, 'three hedges an auditor would question');
  ok(Number(answers[5][0].gain_against_spot_cents) < 0, 'USD forwards sold below today\'s rate');
  eq(answers[6][0].category, 'customer_receipts', 'receipts are the least accurate forecast line');

  // Finding records
  eq((await resolve(db, 'bank_accounts', 'nz-ops')).code, 'NZ-OPS', 'case-insensitive code');
  eq((await resolve(db, 'bank_accounts', 'call')).code, 'NZ-CALL', 'partial match');
  eq((await resolve(db, 'covenants', 'interest cover')).code, 'ICR-ANZ', 'name match');
  await reject(() => resolve(db, 'bank_accounts', 'nz'), /More than one match/);
  await reject(() => resolve(db, 'hedges', 'nothing-like-this'), /No match/);

  // Record reads
  const acct = await run(db, 'account', 'NZ-OPS');
  eq(acct.signatories.length, 4, 'four signatories on the operating account');
  eq((await run(db, 'facility', 'TL-ANZ')).covenants.length, 2, 'two covenants on the term loan');
  eq((await run(db, 'hedge', 'FWD-101')).hedge[0].exposure, 'EX-USD-01', 'hedge shows its hedged item');

  // Writes need an actor
  await reject(() => run(db, 'balance', 'NZ-EUR', { amount: '1' }), /--actor is required/);

  // Balances and rates
  await reject(() => as('balance', 'NZ-EUR', { amount: '150000', on: day(2) }), /future/);
  await reject(() => as('balance', 'NZ-EUR', { amount: '$150,000' }), /plain decimal/);
  await as('balance', 'NZ-EUR', { amount: '148,500.00' });
  ok(!has(await issues('attention'), 'Balance not loaded', 'NZ-EUR'), 'fresh balance clears the stale flag');
  await reject(() => as('rate', 'NZD', { rate: '1' }), /base currency/);
  await as('rate', 'USD', { rate: '1.6950' });
  eq(Number((await db.query("select base_per_unit from rates_latest where currency = 'USD'"))[0].base_per_unit), 1.695, 'new rate is the latest');

  // Cash flows
  await reject(() => as('settle', 'CF-USD-LATE', { actual: '-180000' }), /other way/);
  await as('settle', 'CF-USD-LATE', { actual: '176500.00' });
  ok(!has(await issues('attention'), 'Receipt overdue', 'CF-USD-LATE'), 'settled receipt leaves attention');
  await reject(() => as('settle', 'CF-USD-LATE', {}), /already settled/);
  await as('move', 'CF-DIV-01', { to: day(95) });
  eq((await db.query("select due_on from cash_flows where code = 'CF-DIV-01'"))[0].due_on, day(95), 'dividend moved out');
  await reject(() => as('cancel', 'CF-GST-01', {}), /--reason is required/);
  await as('cancel', 'CF-GST-01', { reason: 'Refund due instead' });
  await add('flow', { code: 'CF-NEW-1', entity: 'TON', account: 'NZ-OPS', due_on: day(10), amount: '-25000', category: 'suppliers' });
  await reject(() => add('flow', { code: 'CF-NEW-2', entity: 'TON', account: 'NZ-USD', currency: 'NZD', due_on: day(10), amount: '100', category: 'suppliers' }), /holds USD/);
  await reject(() => add('flow', { code: 'CF-NEW-3', entity: 'TON', due_on: day(10), amount: '0', category: 'suppliers' }), /cannot be zero/);
  await reject(() => add('flow', { code: 'CF-NEW-4', entity: 'TON', due_on: day(10), amount: '5', category: 'lunch' }), /category must be one of/);

  // Exposures and hedges
  await reject(() => add('exposure', { code: 'EX-NZD', entity: 'TON', currency: 'NZD', direction: 'receive', amount: '1000', expected_on: day(30) }), /own currency/);
  await add('exposure', { code: 'EX-USD-99', entity: 'TON', currency: 'USD', direction: 'receive', amount: '200000', expected_on: day(250) });
  await reject(() => add('hedge', { code: 'FWD-X', entity: 'TON', counterparty: 'ANZ', currency: 'USD', direction: 'buy', notional: '100000', contract_rate: '1.7', traded_on: day(0), settles_on: day(240), exposure: 'EX-USD-99' }), /hedged by selling/);
  await reject(() => add('hedge', { code: 'FWD-X', entity: 'TON', counterparty: 'ANZ', currency: 'USD', direction: 'sell', notional: '100000', contract_rate: '1.7', traded_on: day(3), settles_on: day(240) }), /future/);
  await add('hedge', { code: 'FWD-106', entity: 'TON', counterparty: 'ANZ', currency: 'USD', direction: 'sell', notional: '600000', contract_rate: '1.7010', traded_on: day(0), settles_on: day(250), designated: true, designation_ref: 'HD-2026-06', exposure: 'EX-USD-99' });
  ok(has(await issues('compliance'), '300% of the hedged item', 'FWD-106'), 'over-hedge caught at booking');
  eq((await run(db, 'fx-cover')).find((r) => r.currency === 'USD' && r.months_from === 6).status, 'within policy', 'new forward brings 6-12 months into band');
  await reject(() => as('designate', 'FWD-104', { ref: 'HD-2026-04', on: day(-30) }), /before the trade date/);
  await reject(() => as('designate', 'FWD-104', {}), /--ref is required/);
  await as('designate', 'FWD-104', { ref: 'HD-2026-04', on: day(-10) });
  ok(!has(await issues('compliance'), 'no hedge documentation', 'FWD-104'), 'documented hedge clears');
  await as('settle-hedge', 'FWD-101', {});
  await reject(() => as('settle-hedge', 'FWD-101', {}), /already settled/);

  // Facilities and covenants
  await reject(() => as('draw', 'RCF-BNZ', { amount: '2600000' }), /over its limit/);
  await as('draw', 'RCF-BNZ', { amount: '1000000' });
  eq(Number((await db.query("select drawn_cents from facilities where code = 'RCF-BNZ'"))[0].drawn_cents), 150000000, 'drawn 1.5m');
  await reject(() => as('repay', 'OD-WBC', { amount: '1' }), /Only 0.00 AUD/);
  await as('certificate-sent', 'ICR-ANZ', {});
  ok(!has(await issues('attention'), 'certificate overdue', 'ICR-ANZ'), 'sent certificate clears');
  await reject(() => as('certificate-sent', 'ICR-ANZ', {}), /already sent/);
  const next = (await db.query("select next_test_on from covenants where code = 'LEV-BNZ'"))[0].next_test_on;
  const t = await as('test-covenant', 'LEV-BNZ', { 'period-end': day(-1), value: '2.6', by: 'Mere Walker' });
  eq(t.passed, false, 'a test over the maximum fails');
  ok(has(await issues('attention'), 'Covenant breached', 'LEV-BNZ'), 'breach shows in attention');
  ok((await db.query("select next_test_on from covenants where code = 'LEV-BNZ'"))[0].next_test_on > next, 'next test date rolls forward');
  await reject(() => as('test-covenant', 'LEV-BNZ', { 'period-end': day(-1), value: '1.9' }), /duplicate|unique/i);
  await reject(() => as('test-covenant', 'ICR-ANZ', { 'period-end': day(1), value: '3.1' }), /before the period end|future/);

  // Bank mandates and people
  await reject(() => add('signatory', { account: 'NZ-USD', person: 'Sarah Lee', added_on: day(0) }), /has left/);
  await as('remove-signatory', 'NZ-OPS', { person: 'Sarah Lee' });
  await as('remove-signatory', 'NZ-CALL', { person: 'Sarah Lee' });
  ok(!has(await issues('compliance'), 'Former staff'), 'mandates cleaned');
  await reject(() => as('remove-signatory', 'NZ-CALL', { person: 'Sarah Lee' }), /not a current signatory/);
  const left = await as('left', 'Daniel Cho', {});
  eq(left.still_signing_on.length, 2, 'leaving lists the mandates to fix');
  ok(has(await issues('compliance'), 'Former staff', 'NZ-EUR: Daniel Cho'), 'new leaver flagged');

  // Policy, limits and notes
  await as('approve-policy', undefined, { by: 'Board', ref: 'Treasury policy v4' });
  ok(!has(await issues('compliance'), 'past its review date'), 'approved policy clears review');
  await add('limit', { bank: 'BNZ', limit: '3500000', rating: 'AA-' });
  ok(!has(await issues('attention'), 'Deposits over bank limit', 'BNZ'), 'raised limit clears');
  await add('band', { currency: 'AUD', direction: 'receive', months_from: 0, months_to: 6, min_pct: 0, max_pct: 50 });
  await as('log', 'FWD-103', { note: 'Designation memo signed late; auditor told.' });
  eq((await run(db, 'hedge', 'FWD-103')).notes.length, 1, 'note on the hedge');
  ok((await run(db, 'history')).some((h) => h.event === 'designate' && h.actor === 'Test operator'), 'audit trail records the writes');

  // Import from Kyriba
  const map = path.join(REPO_ROOT, 'examples', 'kyriba', 'mapping.json');
  const ex = (n) => path.join(REPO_ROOT, 'examples', 'kyriba', n);
  const imp = (kind, f) => tx(() => importKyriba(db, { kind, file: f, map, actor: 'Test operator' }));
  eq((await imp('balances', ex('balances.csv'))).imported, 2, 'balances imported');
  eq((await imp('balances', ex('balances.csv'))).unchanged, 2, 'balances import twice adds nothing');
  await reject(() => importKyriba(db, { kind: 'balances', file: file('clash.csv', fs.readFileSync(ex('balances.csv'), 'utf8').replace('1180000.00', '1190000.00')), map, actor: 'Test operator' }), /Check which is right/);
  eq((await imp('flows', ex('flows.csv'))).imported, 3, 'flows imported');
  eq((await db.query("select status from cash_flows where code = 'KY-7700'"))[0].status, 'settled', 'actual rows land settled');
  eq((await db.query("select counterparty from cash_flows where code = 'KY-7782'"))[0].counterparty, 'Harbour Foods, Inc.', 'quoted CSV field kept');
  eq((await imp('hedges', ex('hedges.csv'))).imported, 1, 'hedges imported');
  eq((await db.query("select designated from hedges where code = 'FX-2201'"))[0].designated, false, 'imported hedges arrive undesignated');
  const changed = file('changed.csv', fs.readFileSync(ex('flows.csv'), 'utf8').replace('-62000.00', '-64000.00'));
  await reject(() => importKyriba(db, { kind: 'flows', file: changed, map, actor: 'Test operator' }), /has changed it/);
  await reject(() => importKyriba(db, { kind: 'flows', file: file('bad.csv', 'Ref,Amount\nX,1\n'), map, actor: 'Test operator' }), /not in the file/);
  await reject(() => importKyriba(db, { kind: 'payments', file: ex('flows.csv'), map, actor: 'Test operator' }), /--kind must be/);

  // Drafts and export
  const review = await weeklyReview(db);
  eq(Object.keys(review).length, 5, 'weekly review has five parts');
  const report = await tx(() => boardReport(db));
  ok(fs.existsSync(path.join(tmp, 'drafts', path.basename(report.draft))), 'board report drafted');
  const cert = await tx(() => certificate(db, 'LVR-ANZ'));
  ok(fs.readFileSync(path.join(tmp, 'drafts', path.basename(cert.draft)), 'utf8').includes('Loan to value ratio'), 'certificate lists the covenants');
  eq(cert.all_met, true, 'term loan covenants met');
  const dump = await exportAll(db);
  eq(Object.keys(dump).length, tables.length, 'export covers every table');
} finally {
  if (db) await db.close();
}

// The CLI, end to end, in a separate process
const env = { ...process.env };
const cli = (...a) => spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'treasury.mjs'), ...a], { cwd: REPO_ROOT, env, encoding: 'utf8' });
let r = cli('forecast', '--json');
eq(r.status, 0, 'cli forecast runs');
eq(JSON.parse(r.stdout).length, 13, 'cli --json gives thirteen weeks');
r = cli('position');
ok(r.stdout.includes('NZD'), 'cli human table');
r = cli('account', 'nz');
eq(r.status, 1, 'ambiguous record exits 1');
ok(r.stderr.includes('NZ-OPS') && r.stderr.includes('NZ-CALL'), 'and lists the candidates');
r = cli('position', '--colour=red');
eq(r.status, 1, 'unknown flag exits 1');
r = cli('import', 'kyriba', '--kind=flows', `--file=${path.join(REPO_ROOT, 'examples', 'kyriba', 'flows.csv')}`, `--map=${path.join(REPO_ROOT, 'examples', 'kyriba', 'mapping.json')}`, '--actor=Test', '--dry-run');
eq(r.status, 0, 'dry-run import runs');
r = cli('weekly-review');
ok(r.stdout.includes('Needs a decision'), 'weekly review prints');
for (const script of ['view.mjs', 'docs.mjs']) {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  eq(p.status, 0, `${script} runs: ${p.stderr.split('\n').filter((l) => /error/i.test(l)).slice(-2).join(' ')}`);
}
for (const v of ['week', 'fx', 'debt']) ok(fs.existsSync(path.join(tmp, 'views', `${v}.html`)), `view ${v} rendered`);
for (const d of ['treasury-report', 'hedge-documentation', 'bank-mandate']) ok(fs.readdirSync(path.join(tmp, 'docs-out', d)).length > 0, `document ${d} rendered`);

if (process.env.TEST_DATABASE_URL) { const d = await getDb(); try { await d.exec(`drop schema ${schema} cascade`); } finally { await d.close(); } }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`PASS ${checks} checks`);
