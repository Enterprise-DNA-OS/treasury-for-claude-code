---
description: Record an FX deal the treasurer has already done with the bank, linked to the exposure it hedges.
---

1. Get the deal from the bank confirmation: counterparty, buy or sell, currency, amount, rate, trade date, settlement date.
2. Write the JSON and run `npm run treasury --silent -- add hedge --file=<file> --actor="<name>"`. Set `exposure` to the hedged item's code and `designated: true` with a `designation_ref` only if the hedge documentation exists today.
3. Rerun `npm run treasury --silent -- fx-cover` and `npm run treasury --silent -- compliance`. This records a deal; it never places one.
