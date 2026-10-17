---
description: Load a bank balance for a date (end-of-day closing balance), by hand.
---

1. Confirm the account, the date and the closing balance with the operator.
2. Run `npm run treasury --silent -- balance <account> --amount=<balance> --on=YYYY-MM-DD --actor="<name>"`. Amounts are plain decimals in the account's currency.
3. For a whole bank file, use `/import` instead.
