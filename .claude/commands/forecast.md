---
description: The 13-week cash forecast for the group in base currency: opening, in, out, closing and the gap to the liquidity floor.
---

1. Run `npm run treasury --silent -- forecast`.
2. Say the lowest week and its gap to the floor first. If any week closes below the floor, name the first one and what drives it: run `npm run treasury --silent -- flows --json` and list the biggest outflows that week.
3. Offer the options in treasury terms: move a payment (`move`), draw on a facility with headroom (`npm run treasury --silent -- facilities`), or bring a receipt forward with the customer. Never change a flow without a yes.
