---
description: Add a record from a short description: an entity, person, bank account, cash flow, exposure, hedge, facility, covenant, signatory, bank limit or hedging band.
---

1. Turn the operator's words into a JSON file in a temp location with the fields `npm run treasury --silent -- add <kind>` needs (the error message lists them). Amounts are plain decimals.
2. Show the JSON, then run `npm run treasury --silent -- add <kind> --file=<file> --actor="<name>"`.
3. Kinds: entity, person, account, flow, exposure, hedge, facility, covenant, signatory, limit, band.
