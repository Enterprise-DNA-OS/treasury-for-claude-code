# The CLI

```
npm run treasury --silent -- <command> [record] [--key=value] [--json]
node scripts/treasury.mjs <command> [record] [--key=value] [--json]
```

Human tables by default; `--json` for machines. Records match by exact code, id or name first, then by a unique partial match. More than one match lists the candidates and exits 1. Reads run read-only; every write runs in one transaction, needs `--actor`, and lands in the audit trail.

## Reads

| Command | What it returns |
|---|---|
| `entities` | Group entities with jurisdiction and functional currency |
| `accounts` | Every open bank account with its latest balance, base value and age |
| `position` | Cash by entity and currency, in currency and in base |
| `forecast` | 13 weeks from this Monday: opening, in, out, closing, gap to the floor |
| `flows` | Expected receipts and payments in the next 13 weeks |
| `overdue` | Expected flows past their due date |
| `accuracy` | Forecast against actual by category over eight weeks |
| `exposures` | Future FX exposures with the hedges linked to each |
| `fx-cover` | Exposure against cover for each policy band, with status |
| `hedges` | Open hedges with contract rate against the latest rate |
| `maturities` | Hedge settlements, facility maturities and reviews, covenant tests coming up |
| `facilities` | Limit, drawn, headroom, margin, maturity, review |
| `covenants` | Last test, pass, headroom, certificate due and sent |
| `counterparties` | Deposits per bank against the limit, plus open hedges |
| `signatories` | Current mandates, flagging leavers |
| `policy`, `bands` | The treasury policy settings and hedging bands |
| `attention` | Everything that needs a decision |
| `compliance` | Rule breaches with their source |
| `history` | The last 50 audit events |
| `insights` | The ten questions |
| `account <code>`, `facility <code>`, `hedge <code>` | One record in full |
| `weekly-review` | Position, lowest week, FX cover, next 30 days, decisions |

## Writes (all need `--actor="Name"`)

| Command | Flags |
|---|---|
| `add <kind>` | `--file=record.json`. Kinds: entity, person, account, flow, exposure, hedge, facility, covenant, signatory, limit, band |
| `balance <account>` | `--amount=` `--on=` |
| `rate <CCY>` | `--rate=` (base per unit) `--on=` |
| `settle <flow>` | `--actual=` `--on=` |
| `move <flow>` | `--to=` |
| `cancel <flow>` | `--reason=` |
| `designate <hedge>` | `--ref=` `--exposure=` `--on=` |
| `settle-hedge <hedge>` | `--on=` |
| `test-covenant <covenant>` | `--period-end=` `--value=` `--by=` `--on=` |
| `certificate-sent <covenant>` | `--on=` |
| `draw <facility>`, `repay <facility>` | `--amount=` |
| `remove-signatory <account>` | `--person=` `--on=` |
| `left <person>` | `--on=` |
| `approve-policy` | `--by=` `--ref=` `--on=` |
| `log <code>` | `--note=` |
| `draft-board-report` | writes `drafts/treasury-report-<date>.md` |
| `draft-certificate <covenant>` | writes `drafts/certificate-<covenant>-<period>.md` |

## Data in and out

| Command | Flags |
|---|---|
| `import kyriba` | `--kind=balances\|flows\|hedges` `--file=` `--map=` `[--dry-run]` |
| `export` | `[--out=file.json]` |

Dates are `YYYY-MM-DD` and default to today where a date is optional. Amounts are plain decimals (`250000`, `-35,000.00`, `(4200)`), never with a currency symbol.
