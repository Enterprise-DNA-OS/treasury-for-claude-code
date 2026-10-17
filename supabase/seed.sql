-- Fictional demo group: an orchard exporter with a New Zealand parent and an Australian subsidiary.
-- Dates move with today, so there is always something stale, overdue or close to a limit.
-- Safe to run twice: every row has a fixed id or code.

insert into treasury_policy (id, base_currency, liquidity_floor_cents, stale_balance_days, covenant_headroom_pct, maturity_warning_days, approved_on, approved_by, review_months, document_ref)
values (1, 'NZD', 150000000, 2, 10, 180, current_date - 400, 'Board of Tasman Orchards Demo Ltd', 12, 'Treasury policy v3')
on conflict (id) do nothing;

insert into entities (id, code, name, jurisdiction, functional_currency) values
 ('10000000-0000-0000-0000-000000000001', 'TON', 'Tasman Orchards Demo Ltd', 'NZ', 'NZD'),
 ('10000000-0000-0000-0000-000000000002', 'TOA', 'Tasman Orchards Demo Pty Ltd', 'AU', 'AUD')
on conflict do nothing;

insert into people (id, name, role, status, left_on) values
 ('11000000-0000-0000-0000-000000000001', 'Mere Walker', 'Chief financial officer', 'active', null),
 ('11000000-0000-0000-0000-000000000002', 'Daniel Cho', 'Financial controller', 'active', null),
 ('11000000-0000-0000-0000-000000000003', 'Sarah Lee', 'Former financial controller', 'left', current_date - 90),
 ('11000000-0000-0000-0000-000000000004', 'Tom Harris', 'Managing director', 'active', null)
on conflict do nothing;

insert into bank_accounts (id, code, entity_id, bank, name, number_masked, currency, purpose, min_balance_cents, opened_on) values
 ('20000000-0000-0000-0000-000000000001', 'NZ-OPS', '10000000-0000-0000-0000-000000000001', 'ANZ', 'NZD operating', '01-0102-...-00', 'NZD', 'operating', 20000000, '2015-04-01'),
 ('20000000-0000-0000-0000-000000000002', 'NZ-USD', '10000000-0000-0000-0000-000000000001', 'ANZ', 'USD collection', '01-0102-...-51', 'USD', 'collection', 0, '2016-02-01'),
 ('20000000-0000-0000-0000-000000000003', 'NZ-CALL', '10000000-0000-0000-0000-000000000001', 'BNZ', 'NZD call account', '02-0500-...-02', 'NZD', 'savings', 0, '2019-07-01'),
 ('20000000-0000-0000-0000-000000000004', 'NZ-EUR', '10000000-0000-0000-0000-000000000001', 'ASB', 'EUR payments', '12-3011-...-60', 'EUR', 'payments', 0, '2021-03-01'),
 ('20000000-0000-0000-0000-000000000005', 'AU-OPS', '10000000-0000-0000-0000-000000000002', 'Westpac', 'AUD operating', '032-000 ...-118', 'AUD', 'operating', 10000000, '2020-09-01')
on conflict do nothing;

insert into signatories (id, account_id, person_id, authority, added_on) values
 ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'dual', '2021-01-10'),
 ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'dual', '2023-05-02'),
 ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'dual', '2019-03-01'),
 ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000004', 'sole', '2015-04-01'),
 ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'dual', '2021-01-10'),
 ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'dual', '2021-01-10'),
 ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', 'dual', '2019-07-01'),
 ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000002', 'dual', '2023-05-02'),
 ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000001', 'dual', '2021-01-10')
on conflict do nothing;

insert into fx_rates (currency, as_of, base_per_unit, source) values
 ('USD', current_date - 8, 1.72000000, 'demo'), ('USD', current_date - 1, 1.70000000, 'demo'),
 ('AUD', current_date - 1, 1.10000000, 'demo'), ('EUR', current_date - 1, 1.90000000, 'demo')
on conflict do nothing;

-- Yesterday's closing balances, except the EUR account, last loaded six days ago.
insert into balances (id, account_id, as_of, balance_cents, source) values
 ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date - 2, 115000000, 'demo'),
 ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', current_date - 1, 120000000, 'demo'),
 ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', current_date - 1, 40000000, 'demo'),
 ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', current_date - 1, 340000000, 'demo'),
 ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000004', current_date - 6, 15000000, 'demo'),
 ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000005', current_date - 1, 60000000, 'demo')
on conflict do nothing;

insert into counterparty_limits (bank, limit_cents, rating) values
 ('ANZ', 600000000, 'AA-'), ('BNZ', 300000000, 'AA-'), ('ASB', 200000000, 'AA-'), ('Westpac', 250000000, 'AA-')
on conflict do nothing;

insert into hedge_policy (id, currency, direction, months_from, months_to, min_pct, max_pct) values
 ('40000000-0000-0000-0000-000000000001', 'USD', 'receive', 0, 6, 50, 100),
 ('40000000-0000-0000-0000-000000000002', 'USD', 'receive', 6, 12, 25, 75),
 ('40000000-0000-0000-0000-000000000003', 'EUR', 'pay', 0, 12, 75, 100)
on conflict do nothing;

-- The 13-week forecast: payroll, suppliers, US customer receipts, Australian trade, tax, a machine in euros.
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty)
select 'CF-PAY-' || lpad(n::text, 2, '0'), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date + 3 + 14 * n, -18000000, 'payroll', 'committed', 'Staff'
from generate_series(0, 6) n on conflict (code) do nothing;
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty)
select 'CF-SUP-' || lpad(n::text, 2, '0'), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date + 2 + 7 * n, -35000000, 'suppliers', 'forecast', 'Growers and packaging'
from generate_series(0, 12) n on conflict (code) do nothing;
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty)
select 'CF-USD-' || lpad(n::text, 2, '0'), '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'USD', current_date + 6 + 14 * n, 25000000, 'customer_receipts', 'forecast', 'US retail customers'
from generate_series(0, 6) n on conflict (code) do nothing;
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty)
select 'CF-AUR-' || lpad(n::text, 2, '0'), '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', 'AUD', current_date + 4 + 7 * n, 12000000, 'customer_receipts', 'forecast', 'Australian wholesalers'
from generate_series(0, 12) n on conflict (code) do nothing;
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty)
select 'CF-AUS-' || lpad(n::text, 2, '0'), '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', 'AUD', current_date + 1 + 7 * n, -9000000, 'suppliers', 'forecast', 'Freight and cool stores'
from generate_series(0, 12) n on conflict (code) do nothing;
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty) values
 ('CF-TAX-01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date + 40, -110000000, 'tax', 'committed', 'Inland Revenue: provisional tax'),
 ('CF-GST-01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date + 26, -21000000, 'tax', 'committed', 'Inland Revenue: GST'),
 ('CF-CAP-01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'EUR', current_date + 48, -70000000, 'capex', 'committed', 'Packline machine, final instalment'),
 ('CF-INT-01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date + 20, -9500000, 'interest', 'committed', 'ANZ term loan interest'),
 ('CF-DIV-01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date + 60, -40000000, 'dividends', 'forecast', 'Shareholders'),
 ('CF-USD-LATE', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'USD', current_date - 9, 18000000, 'customer_receipts', 'committed', 'Pacific Fresh Inc')
on conflict (code) do nothing;

-- Settled flows from the last eight weeks, so forecast accuracy has something to measure.
insert into cash_flows (code, entity_id, account_id, currency, due_on, amount_cents, category, certainty, counterparty, status, settled_on, actual_cents) values
 ('CF-H-USD-1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'USD', current_date - 40, 25000000, 'customer_receipts', 'forecast', 'US retail customers', 'settled', current_date - 36, 23500000),
 ('CF-H-USD-2', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'USD', current_date - 26, 25000000, 'customer_receipts', 'forecast', 'US retail customers', 'settled', current_date - 26, 25000000),
 ('CF-H-SUP-1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date - 35, -35000000, 'suppliers', 'forecast', 'Growers and packaging', 'settled', current_date - 35, -41200000),
 ('CF-H-SUP-2', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date - 21, -35000000, 'suppliers', 'forecast', 'Growers and packaging', 'settled', current_date - 21, -38900000),
 ('CF-H-PAY-1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'NZD', current_date - 25, -18000000, 'payroll', 'committed', 'Staff', 'settled', current_date - 25, -18000000),
 ('CF-H-AUR-1', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', 'AUD', current_date - 20, 12000000, 'customer_receipts', 'forecast', 'Australian wholesalers', 'settled', current_date - 14, 9600000)
on conflict (code) do nothing;

-- USD receipts expected each month for a year; two euro payments for the new packline.
insert into exposures (code, entity_id, currency, direction, amount_cents, expected_on, basis, description)
select 'EX-USD-' || lpad((n + 1)::text, 2, '0'), '10000000-0000-0000-0000-000000000001', 'USD', 'receive', 50000000, current_date + 15 + 30 * n, case when n < 3 then 'committed' else 'forecast' end, 'US retail receipts, month ' || (n + 1)
from generate_series(0, 11) n on conflict (code) do nothing;
insert into exposures (code, entity_id, currency, direction, amount_cents, expected_on, basis, description) values
 ('EX-EUR-01', '10000000-0000-0000-0000-000000000001', 'EUR', 'pay', 70000000, current_date + 48, 'committed', 'Packline machine, final instalment'),
 ('EX-EUR-02', '10000000-0000-0000-0000-000000000001', 'EUR', 'pay', 8000000, current_date + 100, 'forecast', 'Packline spare parts')
on conflict (code) do nothing;

insert into hedges (code, entity_id, counterparty, instrument, currency, direction, notional_cents, contract_rate, traded_on, settles_on, status, settled_on, designated, designated_on, designation_ref, exposure_id) values
 ('FWD-099', '10000000-0000-0000-0000-000000000001', 'ANZ', 'forward', 'USD', 'sell', 25000000, 1.66000000, current_date - 150, current_date - 26, 'settled', current_date - 26, true, current_date - 150, 'HD-2025-09', null),
 ('FWD-101', '10000000-0000-0000-0000-000000000001', 'ANZ', 'forward', 'USD', 'sell', 100000000, 1.68000000, current_date - 120, current_date + 5, 'open', null, true, current_date - 120, 'HD-2026-01', (select id from exposures where code = 'EX-USD-01')),
 ('FWD-102', '10000000-0000-0000-0000-000000000001', 'ANZ', 'forward', 'USD', 'sell', 50000000, 1.69000000, current_date - 90, current_date + 45, 'open', null, true, current_date - 90, 'HD-2026-02', (select id from exposures where code = 'EX-USD-02')),
 ('FWD-103', '10000000-0000-0000-0000-000000000001', 'BNZ', 'forward', 'USD', 'sell', 50000000, 1.71500000, current_date - 30, current_date + 75, 'open', null, true, current_date - 20, 'HD-2026-03', (select id from exposures where code = 'EX-USD-03')),
 ('FWD-104', '10000000-0000-0000-0000-000000000001', 'BNZ', 'forward', 'USD', 'sell', 40000000, 1.73000000, current_date - 10, current_date + 200, 'open', null, true, current_date - 10, '', (select id from exposures where code = 'EX-USD-07')),
 ('FWD-105', '10000000-0000-0000-0000-000000000001', 'ASB', 'forward', 'EUR', 'buy', 35000000, 1.92000000, current_date - 60, current_date + 48, 'open', null, true, current_date - 60, 'HD-2026-05', (select id from exposures where code = 'EX-EUR-01'))
on conflict (code) do nothing;

insert into facilities (id, code, entity_id, lender, kind, currency, limit_cents, drawn_cents, margin_bps, maturity_on, review_on, agreement_ref) values
 ('50000000-0000-0000-0000-000000000001', 'TL-ANZ', '10000000-0000-0000-0000-000000000001', 'ANZ', 'term_loan', 'NZD', 800000000, 600000000, 210, current_date + 150, current_date + 40, 'ANZ facility agreement 2023'),
 ('50000000-0000-0000-0000-000000000002', 'RCF-BNZ', '10000000-0000-0000-0000-000000000001', 'BNZ', 'revolving', 'NZD', 300000000, 50000000, 185, current_date + 700, current_date + 300, 'BNZ revolving facility 2025'),
 ('50000000-0000-0000-0000-000000000003', 'OD-WBC', '10000000-0000-0000-0000-000000000002', 'Westpac', 'overdraft', 'AUD', 50000000, 0, 300, current_date + 365, current_date + 20, 'Westpac business overdraft')
on conflict do nothing;

insert into covenants (id, code, facility_id, name, test, threshold, frequency, next_test_on, certificate_days, clause) values
 ('51000000-0000-0000-0000-000000000001', 'ICR-ANZ', '50000000-0000-0000-0000-000000000001', 'Interest cover (EBIT to interest)', 'min', 3.0, 'quarterly', current_date + 40, 45, 'Clause 19.2(a)'),
 ('51000000-0000-0000-0000-000000000002', 'LVR-ANZ', '50000000-0000-0000-0000-000000000001', 'Loan to value ratio', 'max', 0.5, 'half_yearly', current_date + 130, 45, 'Clause 19.2(b)'),
 ('51000000-0000-0000-0000-000000000003', 'LEV-BNZ', '50000000-0000-0000-0000-000000000002', 'Net debt to EBITDA', 'max', 2.5, 'quarterly', current_date + 40, 60, 'Clause 21.1')
on conflict do nothing;

insert into covenant_tests (id, covenant_id, period_end, value, tested_on, tested_by, certificate_sent_on) values
 ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', current_date - 142, 3.9, current_date - 120, 'Mere Walker', current_date - 110),
 ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', current_date - 50, 3.4, current_date - 20, 'Mere Walker', null),
 ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000002', current_date - 50, 0.465, current_date - 18, 'Mere Walker', current_date - 15),
 ('52000000-0000-0000-0000-000000000004', '51000000-0000-0000-0000-000000000003', current_date - 50, 1.8, current_date - 19, 'Daniel Cho', current_date - 16)
on conflict do nothing;

insert into notes (id, record_type, record_id, actor, body) values
 ('60000000-0000-0000-0000-000000000001', 'cash_flows', (select id from cash_flows where code = 'CF-USD-LATE'), 'Daniel Cho', 'Pacific Fresh says payment run is next Friday. Chase again if not in by then.')
on conflict do nothing;
