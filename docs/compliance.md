# Compliance: the rules this treasury runs under

`/compliance` runs every check below (`npm run treasury -- compliance`, defined once as the `compliance_checks` view in `supabase/migrations/0001_treasury.sql`). Each rule names its source. Nothing here is legal or accounting advice: your auditor, your lenders and your board have the final word, and you confirm any change to a rule before the check changes.

## External rules

| Rule | Source | What a breach looks like in the data |
|---|---|---|
| A hedge used for hedge accounting is formally designated and documented when it starts: the instrument, the hedged item, the risk, and how effectiveness and the hedge ratio are assessed. | NZ IFRS 9 *Financial Instruments* (External Reporting Board, xrb.govt.nz) and AASB 9 (standards.aasb.gov.au/node/2336), paragraph 6.4.1(b). Both carry the IFRS 9 wording. | A designated open hedge with no `designation_ref`, or with `designated_on` later than `traded_on`. |
| The hedge ratio matches the quantity of the hedged item actually hedged. | NZ IFRS 9 and AASB 9 paragraph 6.4.1(c)(iii); application guidance B6.4.9 to B6.4.11. | A designated hedge whose notional is larger than the exposure it is linked to. The excess hedges nothing. |
| Covenant compliance certificates reach the lender by the date in the facility agreement. | Your facility agreement. The clause is stored on each covenant (`clause`) and the days allowed in `certificate_days`. | The latest test has no `certificate_sent_on` and the period end plus `certificate_days` has passed. |
| Financial covenants are met at each test date. | Your facility agreement, same clause. | The latest test value is below a minimum or above a maximum. |
| Only current, authorised people can sign on a bank account. | The bank's account authority (mandate) and your delegated authority policy. | A current signatory whose person record is `left`. |

## Internal rules: your board-approved treasury policy

| Rule | Where it lives | Breach |
|---|---|---|
| Hedge cover stays inside the band for each currency and time horizon. | `hedge_policy` (one row per currency, direction and band). | Cover under `min_pct` or over `max_pct`. |
| Cash with any one bank stays under its limit. | `counterparty_limits`. | Latest deposits in base currency over the limit. |
| Group cash stays above the liquidity floor. | `treasury_policy.liquidity_floor_cents`. | Any forecast week closing under the floor (shown in `/attention`). |
| The board reviews the policy on schedule. | `treasury_policy.approved_on` and `review_months`. | Approval date plus review months has passed. |

Change a band, a limit or the floor with `/add` (kinds `band` and `limit`) or `/customise`, and record the board's approval with `/approve-policy`.
