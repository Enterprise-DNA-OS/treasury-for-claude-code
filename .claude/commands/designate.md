---
description: Record the hedge accounting designation for a hedge: the documentation reference and the hedged item.
---

1. Run `npm run treasury --silent -- designate <hedge> --ref="<memo reference>" --exposure=<exposure code> --on=YYYY-MM-DD --actor="<name>"`.
2. If the CLI warns that the designation is after the trade date, tell the operator plainly: under NZ IFRS 9 and AASB 9 paragraph 6.4.1(b) the documentation is meant to exist at inception, so talk to the auditor.
3. `npm run docs -- hedge-documentation` renders the memo page.
