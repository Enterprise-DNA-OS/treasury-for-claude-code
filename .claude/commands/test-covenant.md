---
description: Record a covenant test result for a period and see whether it passed and when the certificate is due.
---

1. The operator gives the period end and the calculated value (from the management accounts).
2. Run `npm run treasury --silent -- test-covenant <covenant> --period-end=YYYY-MM-DD --value=<ratio> --by="<name>" --actor="<name>"`.
3. Say pass or fail, the headroom and the certificate due date. On a fail, stop and recommend talking to the lender before anything else.
