# Treasury for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Today's cash by entity and currency, in each currency and in the base currency, with how old each balance is. | `/position` |
| The 13-week cash forecast for the group in base currency: opening, in, out, closing and the gap to the liquidity floor. | `/forecast` |
| Every expected receipt and payment in the next 13 weeks, with category, certainty and base-currency value. | `/flows` |
| Receipts that have not arrived and payments not marked paid, past their due date. | `/overdue` |
| How far the forecast was off by category over the last eight weeks, and how late receipts arrived. | `/accuracy` |
| Exposure against hedge cover for every currency and time band, against the board-approved policy bands. | `/fx-cover` |
| Open FX hedges with contract rate against today's rate, settlement dates and hedge accounting status. | `/hedges` |
| What falls due in the next 30 to 180 days: hedge settlements, facility maturities and reviews, covenant tests. | `/maturities` |
| Debt facilities: limit, drawn, headroom, margin, maturity and review dates. | `/facilities` |
| Every covenant with its last test, headroom, certificate due date and whether the certificate went to the lender. | `/covenants` |
| Cash held with each bank against the counterparty limit in the treasury policy, plus open hedges with that bank. | `/counterparties` |
| The bank mandate review: who can sign on which account, flagging anyone who has left the business. | `/signatories` |
| Everything that needs a decision now: stale balances, late receipts, weeks below the floor, policy breaches, covenants, maturities and leavers on mandates. | `/attention` |
| Check the records against the rules this treasury runs under (hedge accounting documentation, facility agreements, the treasury policy, bank mandates), each with its source. | `/compliance` |
| The Monday treasury review: position, the lowest week ahead, FX cover, what falls due in 30 days and what needs a decision. | `/weekly-review` |
| Ten questions the treasury dashboard never answered, run against your own records. | `/insights` |
| One bank account: latest balance, balance history, signatories and upcoming flows. | `/account` |
| Load a bank balance for a date (end-of-day closing balance), by hand. | `/record-balance` |
| Record an FX rate (units of base currency per one unit of foreign currency) for a date. | `/rate` |
| Mark an expected receipt or payment as settled with the actual amount, or move or cancel it. | `/settle` |
| Add a record from a short description: an entity, person, bank account, cash flow, exposure, hedge, facility, covenant, signatory, bank limit or hedging band. | `/add` |
| Record an FX deal the treasurer has already done with the bank, linked to the exposure it hedges. | `/book-hedge` |
| Record the hedge accounting designation for a hedge: the documentation reference and the hedged item. | `/designate` |
| Record a covenant test result for a period and see whether it passed and when the certificate is due. | `/test-covenant` |
| Record that the compliance certificate for the latest covenant test went to the lender. | `/certificate-sent` |
| Record a drawdown or repayment on a facility. | `/draw-repay` |
| Keep bank mandates current: record someone leaving and take them off every account. | `/mandate` |
| Record that the board approved or re-approved the treasury policy. | `/approve-policy` |
| Add a note to a cash flow, hedge, facility, covenant, account or exposure. | `/log` |
| Draft the monthly treasury report for the board from the records: cash, the 13 weeks, facilities, covenants, FX cover, counterparties and policy exceptions. | `/draft-board-report` |
| Draft the covenant compliance certificate for a facility from the latest test. | `/draft-certificate` |
| Bring data across from Kyriba: bank balances, cash flows and FX deals from reports saved as CSV. | `/import` |
| Export every record to one JSON file. | `/export` |
| The audit trail: who changed what, newest first. | `/history` |
| Render the read-only HTML pages (this week, FX cover, debt) in the business's brand. | `/view` |
| Render the paperwork: treasury report per entity, hedge documentation per designated hedge, bank mandate review per account. | `/documents` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run treasury --silent -- --help`) and then propose a new command for it.

## Treasury rules

- Every write needs `--actor="<operator name>"`. Use the operator named above.
- Amounts go in as plain decimals in the record's own currency. Receipts positive, payments negative.
- Rates are units of the base currency per one unit of foreign currency (NZD per USD when the base is NZD).
- This records deals and payments; it never places a trade or moves money. Say so if asked to.
- Covenant results and hedge designations are the operator's numbers. Never calculate a covenant value from a guess.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` compliance rules with sources (`compliance.md`), the switch guide (`replace-kyriba.md`), the CLI reference (`cli.md`) and the thesis.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/kyriba
