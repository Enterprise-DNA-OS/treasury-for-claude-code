<h1 align="center">Treasury for Claude Code</h1>

<p align="center">
  <strong>The open-source treasury system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Kyriba data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=kyriba">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/kyriba?utm_source=github&utm_medium=readme&utm_campaign=kyriba">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-kyriba">Instead of Kyriba</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Treasury for Claude Code does the weekly job you pay Kyriba for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask in plain language: "which week do we dip below the floor?", "how much of next year's US dollar receipts is hedged against policy?", "who can still sign on our accounts after leaving?". It runs the right query and answers from your own records.

Kyriba does not publish prices. It quotes each deployment by modules, bank accounts, entities and payment volume, and third-party estimates for mid-market contracts run to six figures a year (see [docs/research.md](docs/research.md)).

It is built for the finance team of a New Zealand or Australian group with a few entities, several banks and currencies, debt facilities with covenants, and FX exposure: exporters, importers, primary producers and manufacturers. It covers the daily cash position, a 13-week forecast, FX exposure and hedge cover against the board's policy bands, facilities and covenant certificates, bank counterparty limits, bank mandates, hedge accounting documentation and the monthly board report.

Want the same thing with a web front end, a bank feed, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=kyriba).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no modules, no per-bank-account pricing. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what a screen still gives you.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/treasury-for-claude-code.git
cd treasury-for-claude-code
npm install
npm run demo          # a throwaway demo database, three commands, every view and document
npm run migrate && npm run seed   # load the demo group into your working database
```

Then open the folder in Claude Code and type `/attention`. The demo is a fictional orchard exporter with a New Zealand parent and an Australian subsidiary, five bank accounts in four currencies, three facilities, six FX forwards and a forecast that dips below the liquidity floor in week 10.

For real records skip `npm run seed`: run `npm run migrate`, set up your structure with `/add`, then `/import` from Kyriba.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared records, no per-seat fee.

## The commands

| What it does | Command |
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

## Ten questions the dashboard never answered

`/insights` runs all ten against your records today:

1. Which week in the next 13 does cash come closest to the liquidity floor, and by how much?
2. How much of the next six months of USD receipts is hedged, against the policy band?
3. Which customer receipts are late against the forecast, and how late?
4. Which bank holds more of our cash than the policy allows?
5. Which covenants passed with less than the policy headroom?
6. What is the average rate on open USD forwards against today, and what is that worth?
7. How far off was the forecast by category over the last eight weeks?
8. Who can still sign on a bank account after leaving the business?
9. How much undrawn facility does each lender give us, and when does it go?
10. Which designated hedges would an auditor question first?

## Your first hour: ten things to ask for

1. What needs a decision this week?
2. Show the 13-week forecast and tell me what pushes week 10 under the floor.
3. Push the dividend out a month and show me the new lowest week.
4. How much more USD do we need to hedge to get 6 to 12 months back inside policy?
5. Pacific Fresh paid USD 176,500 today. Settle it.
6. Sarah Lee left in July. Draft the bank change form note and take her off once ANZ confirms.
7. Draft the interest cover certificate for ANZ.
8. Which hedges need their designation memo, and render them.
9. Put our name, logo and colours on the board report.
10. Our policy changed: EUR payments now need 60 to 100% cover. Update the band.

## Instead of Kyriba

Set up entities, accounts and facilities in an hour, then import balances, cash flows and FX deals from Kyriba reports saved as CSV, with a mapping file for your column names. A dry run shows the counts before anything is saved. Running a file twice adds nothing; a changed row stops for you to reconcile. Bank connectivity, payments and market data valuations do not carry over. Read the [switch guide](docs/replace-kyriba.md).

## Views, documents and controls

Set your business name, logo and colours in `brand.json`. `npm run view` renders three read-only pages: this week (decisions, cash, the 13 weeks), FX cover with open hedges, and debt (facilities, covenants, bank exposure). `npm run docs` renders a treasury report per entity, a hedge relationship memo per designated hedge and a mandate review page per bank account. `/draft-board-report` and `/draft-certificate` write editable drafts to `drafts/`. Nothing sends.

The [compliance checks](docs/compliance.md) cite their source: NZ IFRS 9 and AASB 9 paragraph 6.4.1 for hedge documentation and hedge ratio, your facility agreement for covenants and certificates, your bank mandate for signatories, and your board's treasury policy for bands, limits, the liquidity floor and the review date. They are prompts, not professional sign-off.

## Architecture

```
treasury-for-claude-code/
  CLAUDE.md                     routing table and house rules
  AGENTS.md                     the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/             the slash commands
  scripts/treasury.mjs          the one CLI (--json for machines)
  scripts/lib/domain.mjs        reads, writes, checks, audit trail
  scripts/lib/import.mjs        import kyriba
  supabase/migrations/          schema and views, plain SQL
  supabase/seed.sql             the fictional demo group
  views.json, documents.json    the HTML pages and paperwork
  examples/kyriba/              sample report CSVs and the column mapping
  docs/                         compliance rules, the switch guide, the thesis
```

## Verification

`npm test` builds a temporary database and exercises every read and write: the forecast roll, FX cover bands, attention and compliance on the demo data, all ten questions, record matching, every guard (future dates, wrong currency, over-limit draws, duplicate tests, leavers on mandates), the Kyriba import with repeat and changed rows, drafts, views, documents and the CLI. CI runs on Windows and Linux with Node 20 and 22, plus PostgreSQL 17. `TEST_DATABASE_URL` must point to a disposable database; the suite uses its own schema.

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Treasury for Claude Code for your business, brings your Kyriba data across, connects your bank files and accounting system, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=kyriba)
- Read more: [enterprisedna.co/omni/instead-of/kyriba](https://enterprisedna.co/omni/instead-of/kyriba?utm_source=github&utm_medium=readme&utm_campaign=kyriba)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Kyriba is a trademark of Kyriba Corp. This independent project is not affiliated with or endorsed by Kyriba.
