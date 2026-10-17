// import kyriba: bank balances, cash flows and FX deals from CSV reports saved out of Kyriba.
// Kyriba report columns are whatever the report template says, so a mapping file names them
// (examples/kyriba/mapping.json). Every row is hashed: running the same file twice adds nothing,
// and a row that changed since the last import stops the run instead of overwriting history.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCsv } from './csv.mjs';
import { add, audit, cents, currency, date, rate, resolve, text } from './domain.mjs';

const FIELDS = {
  balances: { required: ['account', 'as_of', 'balance'], optional: ['currency'] },
  flows: { required: ['code', 'entity', 'due_on', 'amount', 'category'], optional: ['account', 'currency', 'counterparty', 'status'] },
  hedges: { required: ['code', 'entity', 'counterparty', 'currency', 'direction', 'notional', 'rate', 'traded_on', 'settles_on'], optional: ['instrument'] },
};

function toIso(v, fmt, label) {
  const s = text(v, label);
  if (fmt === 'DD/MM/YYYY') {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) throw Error(`${label} "${s}" is not DD/MM/YYYY`);
    return date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, label);
  }
  return date(s, label);
}

export async function importKyriba(db, { kind, file, map, actor, dryRun = false }) {
  text(actor, '--actor');
  const spec = FIELDS[kind];
  if (!spec) throw Error('--kind must be balances, flows or hedges');
  const mapping = JSON.parse(fs.readFileSync(text(map, '--map'), 'utf8'));
  const cols = mapping[kind];
  if (!cols) throw Error(`The mapping file has no "${kind}" section`);
  for (const k of spec.required) text(cols[k], `mapping.${kind}.${k}`);
  for (const k of Object.keys(cols)) if (![...spec.required, ...spec.optional].includes(k)) throw Error(`mapping.${kind}.${k} is not a field this import knows`);
  const fmt = mapping.date_format || 'YYYY-MM-DD';
  const rows = parseCsv(fs.readFileSync(text(file, '--file'), 'utf8'));
  if (!rows.length) throw Error('The CSV has no data rows');
  for (const c of Object.values(cols)) if (!(c in rows[0])) throw Error(`Column "${c}" is not in the file. Columns: ${Object.keys(rows[0]).join(', ')}`);

  let imported = 0, unchanged = 0;
  for (const [i, raw] of rows.entries()) {
    const at = `row ${i + 2}`;
    const d = Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, String(raw[c] ?? '').trim()]));
    const hash = createHash('sha256').update(kind + JSON.stringify(d)).digest('hex');

    if (kind === 'balances') {
      const a = await resolve(db, 'bank_accounts', d.account);
      if (d.currency && currency(d.currency) !== a.currency) throw Error(`${at}: ${a.code} holds ${a.currency}, the file says ${d.currency}`);
      const asOf = toIso(d.as_of, fmt, `${at} as_of`), amount = cents(d.balance, `${at} balance`);
      const old = (await db.query('select * from balances where account_id = $1 and as_of = $2', [a.id, asOf]))[0];
      if (old) { if (Number(old.balance_cents) !== amount) throw Error(`${at}: ${a.code} on ${asOf} is already ${(old.balance_cents / 100).toFixed(2)}; the file says ${(amount / 100).toFixed(2)}. Check which is right before importing.`); unchanged++; continue; }
      const row = (await db.query("insert into balances (account_id, as_of, balance_cents, source, source_hash) values ($1, $2, $3, 'kyriba', $4) returning id", [a.id, asOf, amount, hash]))[0];
      await audit(db, actor, 'import kyriba balance', row.id, { row: i + 2 });
      imported++;
      continue;
    }

    const table = kind === 'flows' ? 'cash_flows' : 'hedges';
    const old = (await db.query(`select id, source_hash from ${table} where lower(code) = lower($1)`, [text(d.code, `${at} code`)]))[0];
    if (old) { if (old.source_hash !== hash) throw Error(`${at}: ${d.code} is already here and the file has changed it. Reconcile it by hand, then import again.`); unchanged++; continue; }

    let row;
    if (kind === 'flows') {
      const category = (mapping.categories || {})[d.category] || d.category;
      const status = d.status ? (mapping.statuses || {})[d.status] : 'forecast';
      if (!['forecast', 'committed', 'settled'].includes(status)) throw Error(`${at}: status "${d.status}" has no entry in mapping.statuses (forecast, committed or settled)`);
      row = await add(db, 'flow', { code: d.code, entity: d.entity, account: d.account || undefined, currency: d.currency || undefined, due_on: toIso(d.due_on, fmt, `${at} due_on`), amount: d.amount, category, certainty: status === 'settled' ? 'committed' : status, counterparty: d.counterparty }, actor);
      if (status === 'settled') await db.query("update cash_flows set status = 'settled', settled_on = due_on, actual_cents = amount_cents where id = $1", [row.id]);
    } else {
      const direction = (mapping.directions || {})[d.direction] || d.direction.toLowerCase();
      row = await add(db, 'hedge', { code: d.code, entity: d.entity, counterparty: d.counterparty, instrument: d.instrument ? d.instrument.toLowerCase() : 'forward', currency: d.currency, direction, notional: d.notional, contract_rate: rate(d.rate, `${at} rate`), traded_on: toIso(d.traded_on, fmt, `${at} traded_on`), settles_on: toIso(d.settles_on, fmt, `${at} settles_on`) }, actor);
    }
    await db.query(`update ${table} set source_hash = $2 where id = $1`, [row.id, hash]);
    imported++;
  }
  return {
    kind, imported, unchanged, dry_run: dryRun || undefined,
    note: kind === 'hedges' ? 'Hedges arrive undesignated. Record each hedge relationship with designate before you rely on hedge accounting.' : undefined,
  };
}
