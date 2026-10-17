---
description: Check the records against the rules this treasury runs under (hedge accounting documentation, facility agreements, the treasury policy, bank mandates), each with its source.
---

1. Read `docs/compliance.md`. Each rule has its source and the check that finds it.
2. Run `npm run treasury --silent -- compliance`.
3. Report as a table: issue, record, rule. Breaches of external rules (the accounting standard, the facility agreement) first, then internal policy.
4. For anything breached, draft the fix the operator can approve: the designation memo (`npm run docs -- hedge-documentation`), the certificate (`/draft-certificate`), the mandate change, or the policy paper for the board. Draft to `drafts/`, never send.
5. If a rule in `docs/compliance.md` is out of date, say so and stop. The operator confirms the rule, then update the doc and the check together.

Nothing here is legal or accounting advice. Your auditor and lenders have the final word.
