---
description: The bank mandate review: who can sign on which account, flagging anyone who has left the business.
---

1. Run `npm run treasury --silent -- signatories`.
2. Leavers first. For each, the fix is the bank's change form (draft the covering note to `drafts/`) and then `npm run treasury --silent -- remove-signatory <account> --person="Name" --actor="..."` once the bank confirms.
3. `npm run docs -- bank-mandate` renders one review page per account for sign-off.
