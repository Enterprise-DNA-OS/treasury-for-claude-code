-- Treasury for Claude Code: bank accounts, balances, the cash forecast, FX exposures and hedges,
-- debt facilities and covenants, bank mandates, and the board-approved treasury policy.
-- Money is stored in whole cents of the record's own currency. Rates are units of the group's
-- base currency per one unit of the foreign currency (NZD per USD when the base is NZD).
-- Runs on Postgres and on embedded PGlite: no extensions.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists treasury_policy (
  id integer primary key default 1 check (id = 1),
  base_currency text not null default 'NZD' check (base_currency ~ '^[A-Z]{3}$'),
  liquidity_floor_cents bigint not null check (liquidity_floor_cents >= 0),
  stale_balance_days integer not null default 2 check (stale_balance_days > 0),
  covenant_headroom_pct numeric(6,2) not null default 10 check (covenant_headroom_pct >= 0),
  maturity_warning_days integer not null default 180 check (maturity_warning_days > 0),
  approved_on date not null,
  approved_by text not null check (length(trim(approved_by)) > 0),
  review_months integer not null default 12 check (review_months > 0),
  document_ref text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null check (jurisdiction in ('NZ','AU')),
  functional_currency text not null check (functional_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null default '',
  status text not null default 'active' check (status in ('active','left')),
  left_on date,
  check ((status = 'left') = (left_on is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entity_id uuid not null references entities(id),
  bank text not null check (length(trim(bank)) > 0),
  name text not null,
  number_masked text not null default '',
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  purpose text not null default 'operating' check (purpose in ('operating','collection','payments','savings','term_deposit')),
  min_balance_cents bigint not null default 0 check (min_balance_cents >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  opened_on date,
  closed_on date,
  check ((status = 'closed') = (closed_on is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists signatories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references bank_accounts(id),
  person_id uuid not null references people(id),
  authority text not null default 'dual' check (authority in ('sole','dual')),
  added_on date not null,
  removed_on date,
  check (removed_on is null or removed_on >= added_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists signatories_one_current on signatories(account_id, person_id) where removed_on is null;

create table if not exists balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references bank_accounts(id),
  as_of date not null,
  balance_cents bigint not null,
  source text not null default 'manual',
  source_hash text unique,
  unique (account_id, as_of),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fx_rates (
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  as_of date not null,
  base_per_unit numeric(18,8) not null check (base_per_unit > 0),
  source text not null default 'manual',
  primary key (currency, as_of),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cash_flows (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entity_id uuid not null references entities(id),
  account_id uuid references bank_accounts(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  due_on date not null,
  amount_cents bigint not null check (amount_cents <> 0),
  category text not null check (category in ('customer_receipts','other_receipts','payroll','suppliers','tax','interest','debt','capex','dividends','intercompany','fx_settlement')),
  certainty text not null default 'forecast' check (certainty in ('committed','forecast')),
  counterparty text not null default '',
  status text not null default 'expected' check (status in ('expected','settled','cancelled')),
  settled_on date,
  actual_cents bigint,
  cancel_reason text not null default '',
  source_hash text unique,
  check ((status = 'settled') = (settled_on is not null and actual_cents is not null)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exposures (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entity_id uuid not null references entities(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('receive','pay')),
  amount_cents bigint not null check (amount_cents > 0),
  expected_on date not null,
  basis text not null default 'forecast' check (basis in ('committed','forecast')),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hedges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entity_id uuid not null references entities(id),
  counterparty text not null check (length(trim(counterparty)) > 0),
  instrument text not null default 'forward' check (instrument in ('forward','option','swap')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('sell','buy')),
  notional_cents bigint not null check (notional_cents > 0),
  contract_rate numeric(18,8) not null check (contract_rate > 0),
  traded_on date not null,
  settles_on date not null check (settles_on >= traded_on),
  status text not null default 'open' check (status in ('open','settled','closed')),
  settled_on date,
  designated boolean not null default false,
  designated_on date,
  designation_ref text not null default '',
  exposure_id uuid references exposures(id),
  source_hash text unique,
  check ((status = 'open') = (settled_on is null)),
  check (designated or designated_on is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hedge_policy (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('receive','pay')),
  months_from integer not null check (months_from >= 0),
  months_to integer not null,
  min_pct numeric(6,2) not null check (min_pct >= 0),
  max_pct numeric(6,2) not null,
  check (months_to > months_from and max_pct >= min_pct),
  unique (currency, direction, months_from),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists counterparty_limits (
  bank text primary key,
  limit_cents bigint not null check (limit_cents >= 0),
  rating text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entity_id uuid not null references entities(id),
  lender text not null check (length(trim(lender)) > 0),
  kind text not null check (kind in ('term_loan','revolving','overdraft','trade_finance','guarantee')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  limit_cents bigint not null check (limit_cents > 0),
  drawn_cents bigint not null default 0 check (drawn_cents >= 0),
  margin_bps integer not null default 0 check (margin_bps >= 0),
  maturity_on date not null,
  review_on date,
  agreement_ref text not null default '',
  check (drawn_cents <= limit_cents),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists covenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  facility_id uuid not null references facilities(id),
  name text not null,
  test text not null check (test in ('min','max')),
  threshold numeric(12,4) not null,
  frequency text not null check (frequency in ('quarterly','half_yearly','annual')),
  next_test_on date not null,
  certificate_days integer not null default 45 check (certificate_days > 0),
  clause text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists covenant_tests (
  id uuid primary key default gen_random_uuid(),
  covenant_id uuid not null references covenants(id),
  period_end date not null,
  value numeric(12,4) not null,
  tested_on date not null check (tested_on >= period_end),
  tested_by text not null check (length(trim(tested_by)) > 0),
  certificate_sent_on date check (certificate_sent_on is null or certificate_sent_on >= tested_on),
  unique (covenant_id, period_end),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_id uuid not null,
  actor text not null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  event text not null,
  record_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['treasury_policy','entities','people','bank_accounts','signatories','balances','fx_rates','cash_flows','exposures','hedges','hedge_policy','counterparty_limits','facilities','covenants','covenant_tests','notes','audit_events'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------ views

-- The latest rate for each currency; the base currency is always 1.
create or replace view rates_latest as
  select p.base_currency currency, current_date as_of, 1::numeric base_per_unit from treasury_policy p
  union all
  (select distinct on (r.currency) r.currency, r.as_of, r.base_per_unit
   from fx_rates r, treasury_policy p where r.currency <> p.base_currency
   order by r.currency, r.as_of desc);

-- Each open account's most recent balance, in its own currency and in base.
create or replace view account_position as
  select a.id account_id, a.code account, e.code entity, a.bank, a.name, a.currency, a.purpose,
    b.as_of, coalesce(b.balance_cents, 0) balance_cents,
    round(coalesce(b.balance_cents, 0) * coalesce(r.base_per_unit, 0))::bigint base_cents,
    a.min_balance_cents, (current_date - b.as_of) days_old, r.base_per_unit is null rate_missing
  from bank_accounts a
  join entities e on e.id = a.entity_id
  left join lateral (select as_of, balance_cents from balances where account_id = a.id order by as_of desc limit 1) b on true
  left join rates_latest r on r.currency = a.currency
  where a.status = 'open';

-- Expected flows in base. Anything overdue and still expected sits in the current week.
create or replace view expected_flows as
  select f.*, e.code entity, greatest(f.due_on, current_date) effective_on,
    round(f.amount_cents * coalesce(r.base_per_unit, 0))::bigint base_cents, r.base_per_unit is null rate_missing
  from cash_flows f join entities e on e.id = f.entity_id left join rates_latest r on r.currency = f.currency
  where f.status = 'expected';

-- The 13-week forecast for the group in base currency: opening, in, out, closing, against the floor.
create or replace view forecast_weeks as
  with weeks as (
    select n, (date_trunc('week', current_date)::date + n * 7) week_start from generate_series(0, 12) n
  ), flows as (
    select w.n, coalesce(sum(f.base_cents) filter (where f.base_cents > 0), 0)::bigint in_cents,
      coalesce(sum(f.base_cents) filter (where f.base_cents < 0), 0)::bigint out_cents
    from weeks w left join expected_flows f on f.effective_on >= w.week_start and f.effective_on < w.week_start + 7
    group by w.n
  ), opening as (select coalesce(sum(base_cents), 0)::bigint cents from account_position)
  select w.n week, w.week_start, (select base_currency from treasury_policy) currency,
    (o.cents + coalesce(sum(fl.in_cents + fl.out_cents) over (order by w.n rows between unbounded preceding and 1 preceding), 0))::bigint opening_cents,
    fl.in_cents, fl.out_cents,
    (o.cents + sum(fl.in_cents + fl.out_cents) over (order by w.n))::bigint closing_cents,
    (select liquidity_floor_cents from treasury_policy) floor_cents
  from weeks w join flows fl on fl.n = w.n cross join opening o;

-- Exposure against hedge cover for every policy band: receipts are covered by sold forwards, payments by bought.
create or replace view fx_cover as
  select p.currency, p.direction, p.months_from, p.months_to,
    coalesce((select sum(x.amount_cents) from exposures x
      where x.currency = p.currency and x.direction = p.direction
        and x.expected_on >= current_date + make_interval(months => p.months_from)
        and x.expected_on < current_date + make_interval(months => p.months_to)), 0)::bigint exposure_cents,
    coalesce((select sum(h.notional_cents) from hedges h
      where h.status = 'open' and h.currency = p.currency and h.direction = case p.direction when 'receive' then 'sell' else 'buy' end
        and h.settles_on >= current_date + make_interval(months => p.months_from)
        and h.settles_on < current_date + make_interval(months => p.months_to)), 0)::bigint hedged_cents,
    p.min_pct, p.max_pct
  from hedge_policy p;

create or replace view fx_cover_status as
  select c.*, case when c.exposure_cents = 0 then null else round(100.0 * c.hedged_cents / c.exposure_cents, 1) end cover_pct,
    case when c.exposure_cents = 0 and c.hedged_cents > 0 then 'hedged with no exposure'
         when c.exposure_cents = 0 then 'no exposure'
         when 100.0 * c.hedged_cents / c.exposure_cents < c.min_pct then 'under policy'
         when 100.0 * c.hedged_cents / c.exposure_cents > c.max_pct then 'over policy'
         else 'within policy' end status
  from fx_cover c;

create or replace view facility_status as
  select f.id, f.code, e.code entity, f.lender, f.kind, f.currency, f.limit_cents, f.drawn_cents,
    (f.limit_cents - f.drawn_cents) headroom_cents, round((f.limit_cents - f.drawn_cents) * coalesce(r.base_per_unit, 0))::bigint headroom_base_cents,
    f.margin_bps, f.maturity_on, (f.maturity_on - current_date) days_to_maturity, f.review_on, (f.review_on - current_date) days_to_review, f.agreement_ref
  from facilities f join entities e on e.id = f.entity_id left join rates_latest r on r.currency = f.currency;

-- Each covenant with its last test, headroom against the threshold and the certificate due date.
create or replace view covenant_status as
  select c.id, c.code, c.name, f.code facility, f.lender, c.test, c.threshold, c.frequency, c.next_test_on, c.clause,
    t.period_end, t.value, t.tested_on, t.certificate_sent_on,
    case when t.id is null then null when c.test = 'min' then t.value >= c.threshold else t.value <= c.threshold end passed,
    case when t.id is null or c.threshold = 0 then null
         when c.test = 'min' then round(100 * (t.value - c.threshold) / abs(c.threshold), 1)
         else round(100 * (c.threshold - t.value) / abs(c.threshold), 1) end headroom_pct,
    (t.period_end + c.certificate_days) certificate_due_on
  from covenants c join facilities f on f.id = c.facility_id
  left join lateral (select * from covenant_tests where covenant_id = c.id order by period_end desc limit 1) t on true;

-- Deposits held with each bank in base, against the policy limit.
create or replace view counterparty_exposure as
  select b.bank, coalesce(sum(greatest(p.base_cents, 0)), 0)::bigint deposits_cents,
    l.limit_cents, l.rating,
    coalesce((select sum(round(h.notional_cents * h.contract_rate))::bigint from hedges h where h.counterparty = b.bank and h.status = 'open'), 0)::bigint open_hedges_cents
  from (select distinct bank from bank_accounts where status = 'open' union select bank from counterparty_limits) b
  left join account_position p on p.bank = b.bank
  left join counterparty_limits l on l.bank = b.bank
  group by b.bank, l.limit_cents, l.rating;

create or replace view mandate_review as
  select a.code account, a.bank, pe.name person, pe.status person_status, pe.left_on, s.authority, s.added_on, a.status account_status
  from signatories s join bank_accounts a on a.id = s.account_id join people pe on pe.id = s.person_id
  where s.removed_on is null;

create or replace view forecast_accuracy as
  select f.category, f.currency, count(*)::integer flows, sum(f.amount_cents)::bigint forecast_cents, sum(f.actual_cents)::bigint actual_cents,
    sum(f.actual_cents - f.amount_cents)::bigint variance_cents,
    round(100.0 * sum(abs(f.actual_cents - f.amount_cents)) / nullif(sum(abs(f.amount_cents)), 0), 1) error_pct,
    round(avg(f.settled_on - f.due_on), 1) avg_days_late
  from cash_flows f where f.status = 'settled' and f.due_on >= current_date - 56
  group by f.category, f.currency;

-- Everything that needs a decision this week. The attention command and the week view read this.
create or replace view attention_items as
  select 'Balance not loaded for ' || days_old || ' days' issue, account record, bank owner, as_of due from account_position, treasury_policy p where as_of is null or days_old > p.stale_balance_days
  union all select 'Below account minimum', account, bank, as_of from account_position where min_balance_cents > 0 and balance_cents < min_balance_cents
  union all select 'Receipt overdue ' || (current_date - due_on) || ' days', code, counterparty, due_on from cash_flows where status = 'expected' and amount_cents > 0 and due_on < current_date
  union all select 'Payment past due date, not marked paid', code, counterparty, due_on from cash_flows where status = 'expected' and amount_cents < 0 and due_on < current_date
  union all select 'Forecast below liquidity floor', 'Week ' || week, currency, week_start from forecast_weeks where closing_cents < floor_cents
  union all select 'FX cover ' || status || ' (' || coalesce(cover_pct::text, '0') || '% against ' || min_pct || '-' || max_pct || '%)', currency || ' ' || direction || ' ' || months_from || '-' || months_to || 'm', 'Treasury policy', current_date from fx_cover_status where status in ('under policy', 'over policy', 'hedged with no exposure')
  union all select 'Hedge settles in ' || (settles_on - current_date) || ' days', code, counterparty, settles_on from hedges where status = 'open' and settles_on <= current_date + 7
  union all select 'Hedge past settlement date, still open', code, counterparty, settles_on from hedges where status = 'open' and settles_on < current_date
  union all select 'Facility matures in ' || days_to_maturity || ' days', code, lender, maturity_on from facility_status, treasury_policy p where days_to_maturity <= p.maturity_warning_days
  union all select 'Facility review in ' || days_to_review || ' days', code, lender, review_on from facility_status where days_to_review <= 60
  union all select 'Covenant certificate overdue', code, lender, certificate_due_on from covenant_status where certificate_sent_on is null and certificate_due_on < current_date
  union all select 'Covenant breached on last test', code, lender, period_end from covenant_status where passed = false
  union all select 'Covenant headroom ' || headroom_pct || '%', code, lender, next_test_on from covenant_status, treasury_policy p where passed and headroom_pct < p.covenant_headroom_pct
  union all select 'Deposits over bank limit', bank, 'Treasury policy', current_date from counterparty_exposure where limit_cents is not null and deposits_cents > limit_cents
  union all select 'Bank with no counterparty limit', bank, '', current_date from counterparty_exposure where limit_cents is null
  union all select 'Signatory has left the business', account, person, left_on from mandate_review where person_status = 'left'
  union all select 'No rate loaded for ' || currency, account, bank, current_date from account_position where rate_missing;

-- The rules this business lives under, each citing its source (docs/compliance.md).
create or replace view compliance_checks as
  select 'Designated hedge has no hedge documentation' issue, code record, 'NZ IFRS 9 / AASB 9 para 6.4.1(b)' rule from hedges where designated and status = 'open' and trim(designation_ref) = ''
  union all select 'Hedge documented after the trade date', code, 'NZ IFRS 9 / AASB 9 para 6.4.1(b): at inception' from hedges where designated and status = 'open' and designated_on > traded_on
  union all select 'Hedge notional is ' || round(100.0 * h.notional_cents / x.amount_cents) || '% of the hedged item', h.code, 'NZ IFRS 9 / AASB 9 para 6.4.1(c)(iii): hedge ratio' from hedges h join exposures x on x.id = h.exposure_id where h.designated and h.status = 'open' and h.notional_cents > x.amount_cents
  union all select 'FX cover ' || status, currency || ' ' || direction || ' ' || months_from || '-' || months_to || 'm', 'Treasury policy: hedging bands' from fx_cover_status where status in ('under policy', 'over policy')
  union all select 'Deposits over counterparty limit', bank, 'Treasury policy: counterparty limits' from counterparty_exposure where deposits_cents > limit_cents
  union all select 'Covenant certificate not delivered', code, 'Facility agreement ' || clause from covenant_status where certificate_sent_on is null and certificate_due_on < current_date
  union all select 'Covenant breached', code, 'Facility agreement ' || clause from covenant_status where passed = false
  union all select 'Former staff still on bank mandate', account || ': ' || person, 'Bank mandate: authorised signatories' from mandate_review where person_status = 'left'
  union all select 'Treasury policy past its review date', document_ref, 'Treasury policy: board review every ' || review_months || ' months' from treasury_policy where approved_on + make_interval(months => review_months) < current_date;
