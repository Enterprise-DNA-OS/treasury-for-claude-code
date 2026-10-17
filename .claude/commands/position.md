---
description: Today's cash by entity and currency, in each currency and in the base currency, with how old each balance is.
---

1. Run `npm run treasury --silent -- position`. For the account-by-account picture run `npm run treasury --silent -- accounts`.
2. Lead with the group total in base currency, then the table.
3. Any balance older than the policy's stale days: say which account and tell the operator to load it (`/record-balance`) before trusting the total.
