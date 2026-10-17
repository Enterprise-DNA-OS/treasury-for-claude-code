// Drafts written from the data into drafts/. Nothing here sends anything: a person reads, edits and sends.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './db.mjs';
import { human, reads, resolve, today } from './domain.mjs';

const draftsDir = () => path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
function save(name, body) {
  fs.mkdirSync(draftsDir(), { recursive: true });
  const file = path.join(draftsDir(), name);
  fs.writeFileSync(file, body);
  return file;
}
const dollars = (c) => Math.round(Number(c) / 100).toLocaleString('en-NZ');

// Monday: the position, the weeks that dip, and everything that needs a decision.
export async function weeklyReview(db) {
  const weeks = await db.query(reads.forecast);
  const low = weeks.reduce((a, w) => (Number(w.over_floor_cents) < Number(a.over_floor_cents) ? w : a), weeks[0]);
  return {
    'Cash position': await db.query(reads.position),
    'Lowest week ahead': [{ week: low.week, week_start: low.week_start, closing_cents: low.closing_cents, over_floor_cents: low.over_floor_cents }],
    'FX cover against policy': await db.query(reads['fx-cover']),
    'Coming up in 30 days': await db.query(reads.maturities),
    'Needs a decision': await db.query(reads.attention),
  };
}

export async function boardReport(db) {
  const p = (await db.query('select * from treasury_policy'))[0];
  const sections = {
    'Cash by entity and currency': await db.query(reads.position),
    '13-week forecast': await db.query(reads.forecast),
    'Facilities': await db.query(reads.facilities),
    'Covenants': await db.query(reads.covenants),
    'FX cover against policy': await db.query(reads['fx-cover']),
    'Bank counterparty exposure': await db.query(reads.counterparties),
    'Policy exceptions': await db.query(reads.compliance),
  };
  const weeks = sections['13-week forecast'];
  const below = weeks.filter((w) => Number(w.over_floor_cents) < 0);
  const lines = [
    `# Treasury report, ${today()}`,
    '',
    `Draft for the board. Amounts in ${p.base_currency} unless a currency is shown. Check every figure before it goes out.`,
    '',
    '## Summary',
    '',
    `- Group cash today: ${dollars(weeks[0]?.opening_cents ?? 0)} ${p.base_currency} against a floor of ${dollars(p.liquidity_floor_cents)}.`,
    below.length ? `- The forecast goes below the floor in ${below.length} of the next 13 weeks, first in week ${below[0].week} (from ${below[0].week_start}).` : '- The forecast stays above the floor for all 13 weeks.',
    `- Policy exceptions open: ${sections['Policy exceptions'].length}.`,
    '',
  ];
  for (const [title, rows] of Object.entries(sections)) lines.push(`## ${title}`, '', '```', human(rows), '```', '');
  const file = save(`treasury-report-${today()}.md`, lines.join('\n'));
  return { draft: path.relative(REPO_ROOT, file), weeks_below_floor: below.length, exceptions: sections['Policy exceptions'].length };
}

export async function certificate(db, term) {
  const c = await resolve(db, 'covenants', term);
  const s = (await db.query('select * from covenant_status where id = $1', [c.id]))[0];
  if (!s.period_end) throw Error(`${c.code} has no test recorded. Run test-covenant first.`);
  const fac = (await db.query('select f.*, e.name entity_name from facilities f join entities e on e.id = f.entity_id where f.id = $1', [c.facility_id]))[0];
  const all = await db.query('select c.name, c.test, c.threshold, s.value, s.passed from covenant_status s join covenants c on c.id = s.id where s.facility = $1 and s.period_end = $2 order by c.code', [fac.code, s.period_end]);
  const body = [
    `# Compliance certificate: ${fac.agreement_ref || fac.code}`,
    '',
    `To: ${fac.lender}`,
    `From: ${fac.entity_name}`,
    `Test date: ${s.period_end}`,
    `Due to the lender by: ${s.certificate_due_on}`,
    '',
    `We refer to ${fac.agreement_ref || 'the facility agreement'}. For the period ending ${s.period_end} we confirm:`,
    '',
    '| Covenant | Requirement | Result | Met |',
    '|---|---|---|---|',
    ...all.map((r) => `| ${r.name} | ${r.test === 'min' ? 'at least' : 'no more than'} ${Number(r.threshold)} | ${Number(r.value)} | ${r.passed ? 'Yes' : 'No'} |`),
    '',
    all.every((r) => r.passed) ? 'No event of default is continuing.' : 'One or more covenants was not met. Talk to the lender before this certificate is signed.',
    '',
    'Signed: ______________________ (director)      Signed: ______________________ (chief financial officer)',
    '',
    'Draft only. Attach the calculation workings the agreement requires. Check figures against the signed accounts before signing.',
    '',
  ].join('\n');
  const file = save(`certificate-${c.code.toLowerCase()}-${s.period_end}.md`, body);
  return { draft: path.relative(REPO_ROOT, file), covenant: c.code, period_end: s.period_end, due_on: s.certificate_due_on, all_met: all.every((r) => r.passed) };
}
