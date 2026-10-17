# Moving off Kyriba

You can run both side by side for a month, then stop paying for the one you no longer open.

## 1. Set up the structure (an hour)

Add your entities, bank accounts, facilities, covenants, signatories, bank limits and hedging bands with `/add`. Paste the list from your current setup or your treasury policy and Claude Code writes the records. Set the base currency and liquidity floor in `treasury_policy` (`/customise`).

## 2. Export from Kyriba

Build or open three reports in Kyriba and save each as CSV (if a report only exports to Excel, open it and save as CSV):

- **Bank balances:** account, value date, closing balance, currency.
- **Cash flows:** reference, company, account, value date, amount, currency, budget or flow code, third party, status (forecast, confirmed, actual).
- **FX deals:** deal number, company, counterparty, product, currency, buy or sell, amount, rate, trade date, value date.

Column names depend on your report template, which is why the import reads a mapping file.

## 3. Map and import

```bash
cp examples/kyriba/mapping.json my-mapping.json   # rename the right-hand side to your column headers
npm run treasury -- import kyriba --kind=balances --file=balances.csv --map=my-mapping.json --actor="Your Name" --dry-run
npm run treasury -- import kyriba --kind=balances --file=balances.csv --map=my-mapping.json --actor="Your Name"
```

Repeat for `--kind=flows` and `--kind=hedges`. Map your Kyriba flow codes to the categories here in `categories`, your statuses in `statuses` (Actual rows land as settled), and your buy and sell labels in `directions`. Set `date_format` to `DD/MM/YYYY` or `YYYY-MM-DD`.

Running the same file twice adds nothing. A row that changed since the last import stops the run so you reconcile it by hand instead of overwriting history.

## What maps

| Kyriba | Here |
|---|---|
| Bank account balances | `balances`, one per account per day |
| Cash flows, forecasts and actuals | `cash_flows` (forecast, committed, settled) |
| FX forwards, swaps and options | `hedges` (arrive undesignated: record each designation with `/designate`) |
| Entities, accounts | `entities`, `bank_accounts` (set up in step 1) |

## What does not carry over

- **Bank connectivity and payments.** This does not connect to banks or send payments. Balances come in by file or by hand. Payments stay in your banking portal or your accounting system. A direct bank feed is something Enterprise DNA builds into a custom version.
- **Approval workflows and audit history from Kyriba.** The audit trail here starts on the day you import. Keep your Kyriba exports for your records.
- **Valuations from market data.** Hedges are held at contract rate against the latest rate you load. Mark-to-market from a market data feed, and hedge effectiveness testing, stay with your bank or auditor unless you add them.
- **eBAM and bank fee analysis.** Mandates are recorded and reviewed here; the bank's change forms are still the bank's.
