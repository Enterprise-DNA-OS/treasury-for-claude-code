---
description: Bring data across from Kyriba: bank balances, cash flows and FX deals from reports saved as CSV.
---

1. Read `docs/replace-kyriba.md`. Copy `examples/kyriba/mapping.json` and rename its right-hand column names to match the operator's Kyriba report headers.
2. Dry run first: `npm run treasury --silent -- import kyriba --kind=balances|flows|hedges --file=<report.csv> --map=<mapping.json> --actor="<name>" --dry-run`.
3. Show the counts, then run it again without `--dry-run`.
4. Imported hedges arrive undesignated. List them and offer `/designate` for each one the operator has documentation for.
