# Why there is no front end

Kyriba is a database with a subscription. The records underneath it are ordinary: bank accounts, balances, expected cash flows, FX deals, facilities and covenants, and a handful of routines a treasurer runs every week. What you pay for is the layer on top that lets people who do not write SQL get at those records, plus bank connectivity and payments.

The screens used to be the product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, ask "which week do we dip below the floor, and what drives it?", and it runs the query and explains the answer.

## What you gain

- **Better answers.** A dashboard shows what the vendor charted. Here you ask your own question against your own records: forecast error by category, cover against each policy band, who can still sign after leaving.
- **No seats and no modules.** The finance team, the CFO and the board pack all read the same records. Nothing grows with headcount or bank accounts.
- **Your data in your Postgres.** Plain tables you back up and query from anything. Leaving is free.
- **Your policy, your rules.** Change a hedging band or a covenant definition in plain language with `/customise`.

## What a screen gives that this does not

- **Bank connectivity and payment execution.** This reads bank files; it does not connect to banks or move money.
- **A live drag-and-drop forecast grid.** You change flows by asking, not by dragging cells.
- **A phone app and offline access.** It runs where Claude Code runs.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for businesses that want someone to call.

Every one of those can be built into your own version, on top of the same database. That is what Enterprise DNA does: https://enterprisedna.co/omni/instead-of/kyriba
