// The treasury domain: every read the commands use, every write with its checks, one audit trail.
// Money in: plain decimals ("250000.00", "-35000"). Money stored and returned: whole cents.
import fs from 'node:fs';
import { table } from './format.mjs';

export const tables = ['treasury_policy', 'entities', 'people', 'bank_accounts', 'signatories', 'balances', 'fx_rates', 'cash_flows', 'exposures', 'hedges', 'hedge_policy', 'counterparty_limits', 'facilities', 'covenants', 'covenant_tests', 'notes', 'audit_events'];

// ------------------------------------------------------------------ reads



export const reads = {
  entities: 'select code, name, jurisdiction, functional_currency from entities order by code',
  accounts: 'select account, entity, bank, name, currency, purpose, as_of, balance_cents, base_cents, days_old from account_position order by entity, account',
  position: `select entity, currency, count(*)::integer accounts, sum(balance_cents)::bigint balance_cents, sum(base_cents)::bigint base_cents, max(days_old) oldest_days
    from account_position group by entity, currency order by entity, currency`,
  forecast: 'select week, week_start, opening_cents, in_cents, out_cents, closing_cents, (closing_cents - floor_cents)::bigint over_floor_cents from forecast_weeks order by week',
  flows: `select code, entity, currency, due_on, amount_cents, base_cents, category, certainty, counterparty from expected_flows
    where due_on < current_date + 91 order by due_on, code`,
  overdue: `select code, entity, currency, due_on, (current_date - due_on) days_late, amount_cents, category, counterparty from expected_flows
    where due_on < current_date order by due_on, code`,
  exposures: `select x.code, e.code entity, x.currency, x.direction, x.amount_cents, x.expected_on, x.basis,
    coalesce((select sum(h.notional_cents) from hedges h where h.exposure_id = x.id and h.status = 'open'), 0)::bigint linked_hedges_cents, x.description
    from exposures x join entities e on e.id = x.entity_id where x.expected_on >= current_date order by x.currency, x.expected_on`,
  'fx-cover': 'select currency, direction, months_from, months_to, exposure_cents, hedged_cents, cover_pct, min_pct, max_pct, status from fx_cover_status order by currency, direction, months_from',
  hedges: `select h.code, h.counterparty, h.instrument, h.currency, h.direction, h.notional_cents, h.contract_rate, r.base_per_unit spot_rate,
    h.traded_on, h.settles_on, h.designated, h.designation_ref from hedges h left join rates_latest r on r.currency = h.currency
    where h.status = 'open' order by h.settles_on, h.code`,
  maturities: `select 'Hedge settles' event, code record, counterparty party, settles_on due, (settles_on - current_date) days from hedges where status = 'open' and settles_on <= current_date + 30
    union all select 'Facility matures', code, lender, maturity_on, days_to_maturity from facility_status, treasury_policy p where days_to_maturity <= p.maturity_warning_days
    union all select 'Facility review', code, lender, review_on, days_to_review from facility_status where days_to_review <= 90
    union all select 'Covenant test', code, lender, next_test_on, (next_test_on - current_date) from covenant_status where next_test_on <= current_date + 45
    order by due, record`,
  facilities: 'select code, entity, lender, kind, currency, limit_cents, drawn_cents, headroom_cents, margin_bps, maturity_on, days_to_maturity, review_on from facility_status order by maturity_on',
  covenants: `select code, name, facility, test, threshold, period_end, value, passed, headroom_pct, certificate_due_on, certificate_sent_on, next_test_on
    from covenant_status order by facility, code`,
  counterparties: `select bank, rating, deposits_cents, limit_cents, (limit_cents - deposits_cents)::bigint spare_cents, open_hedges_cents
    from counterparty_exposure order by deposits_cents desc`,
  signatories: 'select account, bank, person, person_status, left_on, authority, added_on from mandate_review order by account, person',
  accuracy: 'select category, currency, flows, forecast_cents, actual_cents, variance_cents, error_pct, avg_days_late from forecast_accuracy order by error_pct desc nulls last',
  policy: `select base_currency, liquidity_floor_cents, stale_balance_days, covenant_headroom_pct, maturity_warning_days, approved_on, approved_by,
    (approved_on + make_interval(months => review_months))::date review_due_on, document_ref from treasury_policy`,
  bands: 'select currency, direction, months_from, months_to, min_pct, max_pct from hedge_policy order by currency, direction, months_from',
  attention: 'select issue, record, owner, due from attention_items order by due nulls first, record, issue',
  compliance: 'select issue, record, rule from compliance_checks order by rule, record',
  history: 'select created_at, actor, event, record_id, detail from audit_events order by created_at desc limit 50',
};

// Ten questions a Kyriba dashboard does not answer on its own. Each is one query against your own records.
export const questions = [
  ['Which week in the next 13 does cash come closest to the liquidity floor, and by how much?',
    'select week, week_start, closing_cents, floor_cents, (closing_cents - floor_cents)::bigint over_floor_cents from forecast_weeks order by closing_cents - floor_cents limit 3'],
  ['How much of the next six months of USD receipts is hedged, against the policy band?',
    "select currency, months_from, months_to, exposure_cents, hedged_cents, cover_pct, min_pct, max_pct, status from fx_cover_status where currency = 'USD' and direction = 'receive' order by months_from"],
  ['Which customer receipts are late against the forecast, and how late?',
    "select code, counterparty, currency, amount_cents, due_on, (current_date - due_on) days_late from cash_flows where status = 'expected' and amount_cents > 0 and due_on < current_date order by due_on"],
  ['Which bank holds more of our cash than the policy allows?',
    'select bank, deposits_cents, limit_cents, (deposits_cents - limit_cents)::bigint over_cents from counterparty_exposure where deposits_cents > limit_cents order by deposits_cents - limit_cents desc'],
  ['Which covenants passed with less than the policy headroom?',
    'select code, name, lender, value, threshold, headroom_pct from covenant_status, treasury_policy p where passed and headroom_pct < p.covenant_headroom_pct order by headroom_pct'],
  ['What is the average rate on open USD forwards against today, and what is that worth?',
    `select h.currency, count(*)::integer forwards, sum(h.notional_cents)::bigint notional_cents,
      round(sum(h.notional_cents * h.contract_rate) / sum(h.notional_cents), 4) average_rate, max(r.base_per_unit) spot_rate,
      round(sum(h.notional_cents * (h.contract_rate - r.base_per_unit)))::bigint gain_against_spot_cents
     from hedges h join rates_latest r on r.currency = h.currency where h.status = 'open' and h.direction = 'sell' group by h.currency`],
  ['How far off was the forecast by category over the last eight weeks?',
    'select category, currency, flows, forecast_cents, actual_cents, variance_cents, error_pct, avg_days_late from forecast_accuracy order by error_pct desc nulls last'],
  ['Who can still sign on a bank account after leaving the business?',
    "select person, left_on, account, bank, authority from mandate_review where person_status = 'left' order by person, account"],
  ['How much undrawn facility does each lender give us, and when does it go?',
    'select lender, code, currency, headroom_cents, maturity_on, days_to_maturity from facility_status order by maturity_on'],
  ['Which designated hedges would an auditor question first?',
    `select code, case when trim(designation_ref) = '' then 'no documentation' when designated_on > traded_on then 'documented ' || (designated_on - traded_on) || ' days after trade' else 'hedge ratio over 100%' end problem
     from hedges h where designated and status = 'open' and (trim(designation_ref) = '' or designated_on > traded_on
       or notional_cents > (select amount_cents from exposures x where x.id = h.exposure_id)) order by code`],
];

// ------------------------------------------------------------------ input checks

export const today = () => new Date().toISOString().slice(0, 10);
export function text(v, label) { if (typeof v !== 'string' || !v.trim()) throw Error(`${label} is required`); return v.trim(); }
export function date(v, label) {
  text(v, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error(`${label} must be a real date as YYYY-MM-DD`);
  return v;
}
export function notFuture(v, label) { date(v, label); if (v > today()) throw Error(`${label} cannot be in the future`); return v; }
export function choice(v, allowed, label) { if (!allowed.includes(v)) throw Error(`${label} must be one of ${allowed.join(', ')}`); return v; }
export function currency(v, label = 'currency') { const s = text(String(v ?? ''), label).toUpperCase(); if (!/^[A-Z]{3}$/.test(s)) throw Error(`${label} must be a three-letter code such as NZD`); return s; }
export function rate(v, label = 'rate') { const s = String(v ?? '').trim(); if (!/^\d+(\.\d{1,8})?$/.test(s) || Number(s) <= 0) throw Error(`${label} must be a positive decimal`); return s; }
export function ratio(v, label) { const s = String(v ?? '').trim(); if (!/^-?\d+(\.\d{1,4})?$/.test(s)) throw Error(`${label} must be a decimal with at most four places`); return s; }
// "1,250,000.50", "-35000", "(4,200.00)" -> cents. No currency symbols.
export function cents(v, label = 'amount') {
  let s = String(v ?? '').trim().replace(/,/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  if (s.startsWith('-')) { if (neg) throw Error(`${label} has two signs`); neg = true; s = s.slice(1); }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error(`${label} must be a plain decimal such as 250000.00`);
  const [a, b = ''] = s.split('.');
  const n = Number(a) * 100 + Number(b.padEnd(2, '0'));
  if (!Number.isSafeInteger(n)) throw Error(`${label} is too large`);
  return neg ? -n : n;
}
function keys(obj, allowed, required) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('Expected a JSON object');
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) throw Error(`Unknown field ${k}. Fields: ${allowed.join(', ')}`);
  for (const k of required) if (obj[k] === undefined || obj[k] === '') throw Error(`${k} is required`);
}
const need = (bad, msg) => { if (bad) throw Error(msg); };

// ------------------------------------------------------------------ output

const isMoney = (k) => k.endsWith('_cents');
export function human(v) {
  if (Array.isArray(v)) {
    if (!v.length) return '  (none)';
    return table(v, Object.keys(v[0]).map((key) => ({
      key, label: key.replace(/_cents$/, '').replaceAll('_', ' '), align: isMoney(key) || typeof v[0][key] === 'number' ? 'right' : 'left',
      format: (x) => x == null ? '' : isMoney(key) ? Math.round(Number(x) / 100).toLocaleString('en-NZ') : typeof x === 'boolean' ? (x ? 'yes' : 'no') : typeof x === 'object' ? JSON.stringify(x) : x,
    })));
  }
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}\n${'='.repeat(k.length)}\n${typeof x === 'object' ? human(x) : x}`).join('\n\n');
  return String(v);
}

// ------------------------------------------------------------------ finding records

const finders = {
  entities: 'select id, code, name from entities',
  people: 'select id, name code, role name from people',
  bank_accounts: 'select id, code, name || \' (\' || bank || \')\' name from bank_accounts',
  cash_flows: 'select id, code, counterparty name from cash_flows',
  exposures: 'select id, code, description name from exposures',
  hedges: 'select id, code, counterparty || \' \' || direction || \' \' || currency name from hedges',
  facilities: 'select id, code, lender || \' \' || kind name from facilities',
  covenants: 'select id, code, name from covenants',
};
// Exact id, code or name first; then a unique partial match; otherwise list the candidates and stop.
export async function resolve(db, kind, term) {
  text(term, 'record');
  const all = await db.query(finders[kind] + ' order by code');
  const q = term.toLowerCase();
  let found = all.filter((r) => r.id === q || r.code.toLowerCase() === q || r.name?.toLowerCase() === q);
  if (!found.length) found = all.filter((r) => r.id.startsWith(q) || r.code.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q));
  if (found.length !== 1) {
    const list = (found.length ? found : all).map((r) => ({ id: r.id.slice(0, 8), code: r.code, name: r.name }));
    throw Error(`${found.length ? 'More than one match' : 'No match'} for "${term}". Choose one:\n${human(list)}`);
  }
  return (await db.query(`select * from ${kind} where id = $1`, [found[0].id]))[0];
}

async function insert(db, kind, obj) {
  const cols = Object.keys(obj);
  return (await db.query(`insert into ${kind} (${cols.join(', ')}) values (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, Object.values(obj)))[0];
}
async function update(db, kind, id, obj) {
  const cols = Object.keys(obj);
  return (await db.query(`update ${kind} set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1 returning *`, [id, ...Object.values(obj)]))[0];
}
export async function audit(db, actor, event, id, detail = {}) {
  await insert(db, 'audit_events', { actor: text(actor, '--actor'), event, record_id: id || null, detail: JSON.stringify(detail) });
}
async function base(db) { return (await db.query('select * from treasury_policy'))[0]; }

// ------------------------------------------------------------------ add

const CATEGORIES = ['customer_receipts', 'other_receipts', 'payroll', 'suppliers', 'tax', 'interest', 'debt', 'capex', 'dividends', 'intercompany', 'fx_settlement'];
export async function add(db, kind, d, actor) {
  text(actor, '--actor');
  let row;
  if (kind === 'entity') {
    keys(d, ['code', 'name', 'jurisdiction', 'functional_currency'], ['code', 'name', 'jurisdiction']);
    const j = choice(d.jurisdiction, ['NZ', 'AU'], 'jurisdiction');
    row = await insert(db, 'entities', { code: text(d.code, 'code').toUpperCase(), name: text(d.name, 'name'), jurisdiction: j, functional_currency: currency(d.functional_currency || (j === 'NZ' ? 'NZD' : 'AUD')) });
  } else if (kind === 'person') {
    keys(d, ['name', 'role'], ['name']);
    row = await insert(db, 'people', { name: text(d.name, 'name'), role: d.role ? text(d.role, 'role') : '' });
  } else if (kind === 'account') {
    keys(d, ['code', 'entity', 'bank', 'name', 'number_masked', 'currency', 'purpose', 'min_balance', 'opened_on'], ['code', 'entity', 'bank', 'name', 'currency']);
    const e = await resolve(db, 'entities', d.entity);
    row = await insert(db, 'bank_accounts', {
      code: text(d.code, 'code').toUpperCase(), entity_id: e.id, bank: text(d.bank, 'bank'), name: text(d.name, 'name'), number_masked: d.number_masked || '',
      currency: currency(d.currency), purpose: choice(d.purpose || 'operating', ['operating', 'collection', 'payments', 'savings', 'term_deposit'], 'purpose'),
      min_balance_cents: d.min_balance ? cents(d.min_balance, 'min_balance') : 0, opened_on: d.opened_on ? date(d.opened_on, 'opened_on') : null,
    });
  } else if (kind === 'flow') {
    keys(d, ['code', 'entity', 'account', 'currency', 'due_on', 'amount', 'category', 'certainty', 'counterparty'], ['code', 'entity', 'due_on', 'amount', 'category']);
    const e = await resolve(db, 'entities', d.entity);
    const a = d.account ? await resolve(db, 'bank_accounts', d.account) : null;
    const cur = currency(d.currency || a?.currency || e.functional_currency);
    need(a && a.currency !== cur, `Account ${a?.code} holds ${a?.currency}, not ${cur}`);
    need(a && a.entity_id !== e.id, `Account ${a?.code} belongs to another entity`);
    const amount = cents(d.amount);
    need(amount === 0, 'amount cannot be zero: receipts are positive, payments negative');
    row = await insert(db, 'cash_flows', {
      code: text(d.code, 'code').toUpperCase(), entity_id: e.id, account_id: a?.id || null, currency: cur, due_on: date(d.due_on, 'due_on'), amount_cents: amount,
      category: choice(d.category, CATEGORIES, 'category'), certainty: choice(d.certainty || 'forecast', ['committed', 'forecast'], 'certainty'), counterparty: d.counterparty || '',
    });
  } else if (kind === 'exposure') {
    keys(d, ['code', 'entity', 'currency', 'direction', 'amount', 'expected_on', 'basis', 'description'], ['code', 'entity', 'currency', 'direction', 'amount', 'expected_on']);
    const e = await resolve(db, 'entities', d.entity);
    const cur = currency(d.currency);
    need(cur === e.functional_currency, `${cur} is ${e.code}'s own currency, so it is not a foreign currency exposure`);
    const amount = cents(d.amount);
    need(amount <= 0, 'amount must be positive; direction says which way it goes');
    row = await insert(db, 'exposures', {
      code: text(d.code, 'code').toUpperCase(), entity_id: e.id, currency: cur, direction: choice(d.direction, ['receive', 'pay'], 'direction'), amount_cents: amount,
      expected_on: date(d.expected_on, 'expected_on'), basis: choice(d.basis || 'forecast', ['committed', 'forecast'], 'basis'), description: d.description || '',
    });
  } else if (kind === 'hedge') {
    keys(d, ['code', 'entity', 'counterparty', 'instrument', 'currency', 'direction', 'notional', 'contract_rate', 'traded_on', 'settles_on', 'designated', 'designation_ref', 'exposure'], ['code', 'entity', 'counterparty', 'currency', 'direction', 'notional', 'contract_rate', 'traded_on', 'settles_on']);
    const e = await resolve(db, 'entities', d.entity);
    const x = d.exposure ? await resolve(db, 'exposures', d.exposure) : null;
    const cur = currency(d.currency), dir = choice(d.direction, ['sell', 'buy'], 'direction');
    if (x) {
      need(x.currency !== cur, `Exposure ${x.code} is in ${x.currency}, the hedge is in ${cur}`);
      need((x.direction === 'receive') !== (dir === 'sell'), `A ${x.direction} exposure is hedged by ${x.direction === 'receive' ? 'selling' : 'buying'} ${cur}`);
    }
    const traded = notFuture(d.traded_on, 'traded_on'), settles = date(d.settles_on, 'settles_on');
    need(settles < traded, 'settles_on is before traded_on');
    const notional = cents(d.notional, 'notional');
    need(notional <= 0, 'notional must be positive');
    if (d.designated !== undefined && typeof d.designated !== 'boolean') throw Error('designated must be true or false');
    row = await insert(db, 'hedges', {
      code: text(d.code, 'code').toUpperCase(), entity_id: e.id, counterparty: text(d.counterparty, 'counterparty'), instrument: choice(d.instrument || 'forward', ['forward', 'option', 'swap'], 'instrument'),
      currency: cur, direction: dir, notional_cents: notional, contract_rate: rate(d.contract_rate, 'contract_rate'), traded_on: traded, settles_on: settles,
      designated: d.designated === true, designated_on: d.designated === true ? traded : null, designation_ref: d.designated === true && d.designation_ref ? text(d.designation_ref, 'designation_ref') : '', exposure_id: x?.id || null,
    });
  } else if (kind === 'facility') {
    keys(d, ['code', 'entity', 'lender', 'kind', 'currency', 'limit', 'drawn', 'margin_bps', 'maturity_on', 'review_on', 'agreement_ref'], ['code', 'entity', 'lender', 'kind', 'limit', 'maturity_on']);
    const e = await resolve(db, 'entities', d.entity);
    const limit = cents(d.limit, 'limit'), drawn = d.drawn ? cents(d.drawn, 'drawn') : 0;
    need(limit <= 0, 'limit must be positive');
    need(drawn < 0 || drawn > limit, 'drawn must be between zero and the limit');
    row = await insert(db, 'facilities', {
      code: text(d.code, 'code').toUpperCase(), entity_id: e.id, lender: text(d.lender, 'lender'), kind: choice(d.kind, ['term_loan', 'revolving', 'overdraft', 'trade_finance', 'guarantee'], 'kind'),
      currency: currency(d.currency || e.functional_currency), limit_cents: limit, drawn_cents: drawn, margin_bps: Number.isInteger(d.margin_bps) ? d.margin_bps : 0,
      maturity_on: date(d.maturity_on, 'maturity_on'), review_on: d.review_on ? date(d.review_on, 'review_on') : null, agreement_ref: d.agreement_ref || '',
    });
  } else if (kind === 'covenant') {
    keys(d, ['code', 'facility', 'name', 'test', 'threshold', 'frequency', 'next_test_on', 'certificate_days', 'clause'], ['code', 'facility', 'name', 'test', 'threshold', 'frequency', 'next_test_on']);
    const f = await resolve(db, 'facilities', d.facility);
    row = await insert(db, 'covenants', {
      code: text(d.code, 'code').toUpperCase(), facility_id: f.id, name: text(d.name, 'name'), test: choice(d.test, ['min', 'max'], 'test'), threshold: ratio(d.threshold, 'threshold'),
      frequency: choice(d.frequency, ['quarterly', 'half_yearly', 'annual'], 'frequency'), next_test_on: date(d.next_test_on, 'next_test_on'),
      certificate_days: Number.isInteger(d.certificate_days) && d.certificate_days > 0 ? d.certificate_days : 45, clause: d.clause || '',
    });
  } else if (kind === 'signatory') {
    keys(d, ['account', 'person', 'authority', 'added_on'], ['account', 'person', 'added_on']);
    const a = await resolve(db, 'bank_accounts', d.account), p = await resolve(db, 'people', d.person);
    need(p.status === 'left', `${p.name} has left the business and cannot be added to a mandate`);
    row = await insert(db, 'signatories', { account_id: a.id, person_id: p.id, authority: choice(d.authority || 'dual', ['sole', 'dual'], 'authority'), added_on: notFuture(d.added_on, 'added_on') });
  } else if (kind === 'limit') {
    keys(d, ['bank', 'limit', 'rating'], ['bank', 'limit']);
    const limit = cents(d.limit, 'limit');
    need(limit < 0, 'limit cannot be negative');
    row = (await db.query('insert into counterparty_limits (bank, limit_cents, rating) values ($1, $2, $3) on conflict (bank) do update set limit_cents = excluded.limit_cents, rating = excluded.rating returning *', [text(d.bank, 'bank'), limit, d.rating || '']))[0];
  } else if (kind === 'band') {
    keys(d, ['currency', 'direction', 'months_from', 'months_to', 'min_pct', 'max_pct'], ['currency', 'direction', 'months_from', 'months_to', 'min_pct', 'max_pct']);
    for (const k of ['months_from', 'months_to']) need(!Number.isInteger(d[k]) || d[k] < 0, `${k} must be a whole number of months`);
    for (const k of ['min_pct', 'max_pct']) need(typeof d[k] !== 'number' || d[k] < 0, `${k} must be a percentage`);
    need(d.months_to <= d.months_from || d.max_pct < d.min_pct, 'months_to must follow months_from and max_pct must be at least min_pct');
    row = (await db.query(`insert into hedge_policy (currency, direction, months_from, months_to, min_pct, max_pct) values ($1, $2, $3, $4, $5, $6)
      on conflict (currency, direction, months_from) do update set months_to = excluded.months_to, min_pct = excluded.min_pct, max_pct = excluded.max_pct returning *`,
    [currency(d.currency), choice(d.direction, ['receive', 'pay'], 'direction'), d.months_from, d.months_to, d.min_pct, d.max_pct]))[0];
  } else throw Error('add needs one of: entity, person, account, flow, exposure, hedge, facility, covenant, signatory, limit, band');
  await audit(db, actor, `add ${kind}`, row.id || null, d);
  return row;
}

// ------------------------------------------------------------------ writes

export const mutations = ['add', 'balance', 'rate', 'settle', 'cancel', 'move', 'designate', 'settle-hedge', 'test-covenant', 'certificate-sent', 'draw', 'repay', 'remove-signatory', 'left', 'approve-policy', 'log'];

export async function run(db, cmd, term, f = {}) {
  if (reads[cmd]) { need(term, `${cmd} takes no record`); return db.query(reads[cmd]); }
  if (cmd === 'insights') { const out = {}; for (const [q, sql] of questions) out[q] = await db.query(sql); return out; }
  if (cmd === 'account') {
    const a = await resolve(db, 'bank_accounts', term);
    return {
      account: await db.query('select account, entity, bank, name, currency, purpose, as_of, balance_cents, base_cents, min_balance_cents from account_position where account_id = $1', [a.id]),
      balances: await db.query('select as_of, balance_cents, source from balances where account_id = $1 order by as_of desc limit 10', [a.id]),
      signatories: await db.query('select person, person_status, authority, added_on from mandate_review where account = $1 order by person', [a.code]),
      upcoming: await db.query("select code, due_on, amount_cents, category, counterparty from cash_flows where account_id = $1 and status = 'expected' order by due_on limit 15", [a.id]),
    };
  }
  if (cmd === 'facility') {
    const fac = await resolve(db, 'facilities', term);
    return {
      facility: await db.query('select code, entity, lender, kind, currency, limit_cents, drawn_cents, headroom_cents, margin_bps, maturity_on, review_on, agreement_ref from facility_status where id = $1', [fac.id]),
      covenants: await db.query('select code, name, test, threshold, period_end, value, passed, headroom_pct, certificate_due_on, certificate_sent_on, next_test_on from covenant_status where facility = $1', [fac.code]),
      tests: await db.query('select c.code, t.period_end, t.value, t.tested_on, t.tested_by, t.certificate_sent_on from covenant_tests t join covenants c on c.id = t.covenant_id where c.facility_id = $1 order by t.period_end desc, c.code', [fac.id]),
    };
  }
  if (cmd === 'hedge') {
    const h = await resolve(db, 'hedges', term);
    return {
      hedge: await db.query(`select h.code, e.code entity, h.counterparty, h.instrument, h.currency, h.direction, h.notional_cents, h.contract_rate, h.traded_on, h.settles_on, h.status,
        h.designated, h.designated_on, h.designation_ref, x.code exposure, x.amount_cents exposure_cents, x.expected_on from hedges h join entities e on e.id = h.entity_id left join exposures x on x.id = h.exposure_id where h.id = $1`, [h.id]),
      notes: await db.query('select actor, body, created_at from notes where record_id = $1 order by created_at', [h.id]),
    };
  }

  const actor = text(f.actor, '--actor');
  if (cmd === 'add') {
    need(!f.file, 'add needs --file=<record.json>');
    return add(db, term, JSON.parse(fs.readFileSync(f.file, 'utf8')), actor);
  }
  if (cmd === 'balance') {
    const a = await resolve(db, 'bank_accounts', term);
    need(a.status !== 'open', `${a.code} is closed`);
    const on = notFuture(f.on || today(), '--on'), amount = cents(f.amount, '--amount');
    const row = (await db.query(`insert into balances (account_id, as_of, balance_cents, source) values ($1, $2, $3, 'manual')
      on conflict (account_id, as_of) do update set balance_cents = excluded.balance_cents, source = 'manual' returning *`, [a.id, on, amount]))[0];
    await audit(db, actor, 'balance', a.id, { on, amount_cents: amount });
    return row;
  }
  if (cmd === 'rate') {
    const cur = currency(term), p = await base(db);
    need(cur === p.base_currency, `${cur} is the base currency; its rate is always 1`);
    const on = notFuture(f.on || today(), '--on');
    const row = (await db.query(`insert into fx_rates (currency, as_of, base_per_unit, source) values ($1, $2, $3, 'manual')
      on conflict (currency, as_of) do update set base_per_unit = excluded.base_per_unit returning *`, [cur, on, rate(f.rate, '--rate')]))[0];
    await audit(db, actor, 'rate', null, { currency: cur, on, rate: f.rate });
    return row;
  }
  if (['settle', 'cancel', 'move'].includes(cmd)) {
    const flow = await resolve(db, 'cash_flows', term);
    need(flow.status !== 'expected', `${flow.code} is already ${flow.status}`);
    let row;
    if (cmd === 'settle') {
      const on = notFuture(f.on || today(), '--on'), actual = f.actual === undefined ? Number(flow.amount_cents) : cents(f.actual, '--actual');
      need(Math.sign(actual) !== Math.sign(Number(flow.amount_cents)), 'The actual amount goes the other way to the forecast: cancel this flow and add the right one');
      row = await update(db, 'cash_flows', flow.id, { status: 'settled', settled_on: on, actual_cents: actual });
    } else if (cmd === 'cancel') row = await update(db, 'cash_flows', flow.id, { status: 'cancelled', cancel_reason: text(f.reason, '--reason') });
    else row = await update(db, 'cash_flows', flow.id, { due_on: date(f.to, '--to') });
    await audit(db, actor, cmd, flow.id, f);
    return row;
  }
  if (cmd === 'designate') {
    const h = await resolve(db, 'hedges', term);
    need(h.status !== 'open', `${h.code} is ${h.status}`);
    const on = notFuture(f.on || today(), '--on');
    need(on < h.traded_on, 'Designation cannot be before the trade date');
    const x = f.exposure ? await resolve(db, 'exposures', f.exposure) : null;
    if (x) need(x.currency !== h.currency || (x.direction === 'receive') !== (h.direction === 'sell'), `Exposure ${x.code} does not match a ${h.direction} ${h.currency} hedge`);
    const row = await update(db, 'hedges', h.id, { designated: true, designated_on: h.designated_on && h.designated_on <= on ? h.designated_on : on, designation_ref: text(f.ref, '--ref'), ...(x ? { exposure_id: x.id } : {}) });
    await audit(db, actor, 'designate', h.id, f);
    return { ...row, warning: row.designated_on > h.traded_on ? `Documented ${Math.round((Date.parse(row.designated_on) - Date.parse(h.traded_on)) / 86400000)} days after the trade: hedge accounting needs documentation at inception` : undefined };
  }
  if (cmd === 'settle-hedge') {
    const h = await resolve(db, 'hedges', term);
    need(h.status !== 'open', `${h.code} is already ${h.status}`);
    const on = notFuture(f.on || today(), '--on');
    need(on < h.traded_on, '--on is before the trade date');
    const row = await update(db, 'hedges', h.id, { status: 'settled', settled_on: on });
    await audit(db, actor, 'settle-hedge', h.id, f);
    return row;
  }
  if (cmd === 'test-covenant') {
    const c = await resolve(db, 'covenants', term);
    const period = date(f['period-end'], '--period-end'), on = notFuture(f.on || today(), '--on');
    need(on < period, '--on is before the period end');
    const value = ratio(f.value, '--value');
    const row = await insert(db, 'covenant_tests', { covenant_id: c.id, period_end: period, value, tested_on: on, tested_by: text(f.by || actor, '--by') });
    const next = { quarterly: 3, half_yearly: 6, annual: 12 }[c.frequency];
    await db.query("update covenants set next_test_on = ($2::date + make_interval(months => $3))::date where id = $1 and next_test_on <= ($2::date + make_interval(months => $3))::date", [c.id, period, next]);
    await audit(db, actor, 'test-covenant', c.id, f);
    const passed = c.test === 'min' ? Number(value) >= Number(c.threshold) : Number(value) <= Number(c.threshold);
    return { ...row, passed, threshold: c.threshold, certificate_due_on: new Date(Date.parse(period) + c.certificate_days * 86400000).toISOString().slice(0, 10) };
  }
  if (cmd === 'certificate-sent') {
    const c = await resolve(db, 'covenants', term);
    const t = (await db.query('select * from covenant_tests where covenant_id = $1 order by period_end desc limit 1', [c.id]))[0];
    need(!t, `${c.code} has no test recorded yet`);
    need(t.certificate_sent_on, `The ${t.period_end} certificate was already sent on ${t.certificate_sent_on}`);
    const on = notFuture(f.on || today(), '--on');
    need(on < t.tested_on, '--on is before the test date');
    const row = await update(db, 'covenant_tests', t.id, { certificate_sent_on: on });
    await audit(db, actor, 'certificate-sent', c.id, f);
    return row;
  }
  if (cmd === 'draw' || cmd === 'repay') {
    const fac = await resolve(db, 'facilities', term);
    const amount = cents(f.amount, '--amount');
    need(amount <= 0, '--amount must be positive');
    const drawn = Number(fac.drawn_cents) + (cmd === 'draw' ? amount : -amount);
    need(drawn > Number(fac.limit_cents), `That takes ${fac.code} over its limit by ${((drawn - fac.limit_cents) / 100).toFixed(2)} ${fac.currency}`);
    need(drawn < 0, `Only ${(fac.drawn_cents / 100).toFixed(2)} ${fac.currency} is drawn on ${fac.code}`);
    const row = await update(db, 'facilities', fac.id, { drawn_cents: drawn });
    await audit(db, actor, cmd, fac.id, f);
    return row;
  }
  if (cmd === 'remove-signatory') {
    const a = await resolve(db, 'bank_accounts', term), p = await resolve(db, 'people', text(f.person, '--person'));
    const on = notFuture(f.on || today(), '--on');
    const rows = await db.query('update signatories set removed_on = $3 where account_id = $1 and person_id = $2 and removed_on is null returning *', [a.id, p.id, on]);
    need(!rows.length, `${p.name} is not a current signatory on ${a.code}`);
    await audit(db, actor, 'remove-signatory', a.id, f);
    return rows[0];
  }
  if (cmd === 'left') {
    const p = await resolve(db, 'people', term);
    need(p.status === 'left', `${p.name} is already recorded as left`);
    const row = await update(db, 'people', p.id, { status: 'left', left_on: notFuture(f.on || today(), '--on') });
    await audit(db, actor, 'left', p.id, f);
    return { ...row, still_signing_on: (await db.query('select account from mandate_review where person = $1', [p.name])).map((r) => r.account) };
  }
  if (cmd === 'approve-policy') {
    need(term, 'approve-policy takes no record');
    const row = (await db.query('update treasury_policy set approved_on = $1, approved_by = $2, document_ref = coalesce($3, document_ref) returning *', [notFuture(f.on || today(), '--on'), text(f.by, '--by'), f.ref || null]))[0];
    await audit(db, actor, 'approve-policy', null, f);
    return row;
  }
  if (cmd === 'log') {
    let rec = null;
    for (const kind of ['cash_flows', 'hedges', 'facilities', 'covenants', 'bank_accounts', 'exposures']) {
      const hit = (await db.query(`select id, code from ${kind} where lower(code) = lower($1)`, [text(term, 'record')]))[0];
      if (hit) { rec = { kind, ...hit }; break; }
    }
    need(!rec, `No record with code ${term}`);
    const row = await insert(db, 'notes', { record_type: rec.kind, record_id: rec.id, actor, body: text(f.note, '--note') });
    await audit(db, actor, 'log', rec.id, { note: f.note });
    return row;
  }
  throw Error(`Unknown command ${cmd}`);
}

// ------------------------------------------------------------------ export

export async function exportAll(db) {
  const out = {};
  for (const t of tables) out[t] = await db.query(`select * from ${t}`);
  return out;
}
