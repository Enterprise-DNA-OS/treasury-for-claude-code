---
description: Record a drawdown or repayment on a facility.
---

1. Draw: `npm run treasury --silent -- draw <facility> --amount=<amount> --actor="<name>"`. Repay: `npm run treasury --silent -- repay <facility> --amount=<amount> --actor="<name>"`.
2. The CLI refuses anything over the limit or below zero. Also add the cash flow (`/add` a flow, category debt) so the forecast sees it.
