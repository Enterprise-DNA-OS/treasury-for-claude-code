---
description: Keep bank mandates current: record someone leaving and take them off every account.
---

1. Someone leaves: `npm run treasury --silent -- left "<name>" --on=YYYY-MM-DD --actor="<name>"`. The output lists every account they can still sign on.
2. Draft the bank change request to `drafts/`. Never send.
3. When the bank confirms: `npm run treasury --silent -- remove-signatory <account> --person="<name>" --on=YYYY-MM-DD --actor="<name>"` for each account.
