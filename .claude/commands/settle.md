---
description: Mark an expected receipt or payment as settled with the actual amount, or move or cancel it.
---

1. Settle: `npm run treasury --silent -- settle <flow code> --actual=<amount> --on=YYYY-MM-DD --actor="<name>"`.
2. Moved date: `npm run treasury --silent -- move <flow code> --to=YYYY-MM-DD --actor="<name>"`.
3. Will not happen: `npm run treasury --silent -- cancel <flow code> --reason="..." --actor="<name>"`.
4. Then rerun `npm run treasury --silent -- forecast` and say what changed in the lowest week.
