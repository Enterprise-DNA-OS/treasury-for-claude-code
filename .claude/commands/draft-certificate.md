---
description: Draft the covenant compliance certificate for a facility from the latest test.
---

1. Run `npm run treasury --silent -- draft-certificate <covenant>`. It writes `drafts/certificate-<covenant>-<period>.md` with every covenant on that facility for the period.
2. If any covenant was not met the draft says so: stop and recommend a conversation with the lender first.
3. Once signed and sent, record it with `/certificate-sent`.
