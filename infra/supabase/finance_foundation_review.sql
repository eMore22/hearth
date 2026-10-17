-- Hearth Finance data foundation, review-only migration.
-- Apply in staging after verification; DO NOT enable bank linking/payments.
-- These records are PERSONAL to user_id, even within a Family household.
-- Direct API writes are forbidden: backend service role must enforce auth and consent.

create table if not exists public.finance_connections (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check (provider in ('plaid','flinks','mono')),
 country_code text not null check (country_code in ('CA','NG')),
 status text not null default 'pending' check (status in ('pending','linked','revoked','error')),
 provider_connection_ref text,
 consent_scopes text[] not null default '{}',
 consent_granted_at timestamptz,
 consent_revoked_at timestamptz,
 consent_expires_at timestamptz,
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id, household_id, owner_user_id),
 unique(provider,provider_connection_ref),
 constraint finance_connection_country_provider check (
   (country_code='CA' and provider in ('plaid','flinks')) or
   (country_code='NG' and provider='mono'))
);
create index if not exists finance_connections_owner_idx
 on public.finance_connections(owner_user_id, household_id);

create table if not exists public.finance_accounts (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null,
 household_id uuid not null,
 owner_user_id uuid not null,
 provider_account_ref text not null,
 display_name text not null,
 masked_account text not null default '',
 currency text not null check (currency in ('CAD','NGN')),
 balance_minor bigint,
 balance_updated_at timestamptz,
 created_at timestamptz not null default now(),
 unique(id,household_id,owner_user_id),
 unique(connection_id,provider_account_ref),
 foreign key(connection_id,household_id,owner_user_id)
   references public.finance_connections(id,household_id,owner_user_id) on delete cascade
);
create index if not exists finance_accounts_owner_idx
 on public.finance_accounts(owner_user_id,household_id);

create table if not exists public.finance_transactions (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null,
 household_id uuid not null,
 owner_user_id uuid not null,
 provider_transaction_ref text not null,
 amount_minor bigint not null,
 currency text not null check (currency in ('CAD','NGN')),
 booked_at timestamptz not null,
 description text not null default '',
 merchant text,
 category text,
 created_at timestamptz not null default now(),
 unique(account_id,provider_transaction_ref),
 foreign key(account_id,household_id,owner_user_id)
   references public.finance_accounts(id,household_id,owner_user_id) on delete cascade
);
create index if not exists finance_transactions_owner_date_idx
 on public.finance_transactions(owner_user_id,booked_at desc);

-- Draft-only proposals: no captured/paid/settled state is representable until
-- an audited separate execution flow, provider reconciliation, strong auth
-- and tamper-resistant audit controls are introduced.
create table if not exists public.finance_payment_proposals (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 payer_user_id uuid not null references auth.users(id) on delete cascade,
 biller_id text not null,
 bill_reference text not null,
 amount_minor bigint not null check(amount_minor>0),
 currency text not null check(currency in ('CAD','NGN')),
 idempotency_key text not null,
 state text not null default 'draft' check(state in ('draft','cancelled','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz,
 unique(payer_user_id,idempotency_key),
 constraint finance_payment_proposals_length check (
   length(biller_id) between 1 and 128 and
   length(bill_reference) between 1 and 128 and
   length(idempotency_key) between 1 and 128 )
);
create index if not exists finance_proposals_owner_idx
 on public.finance_payment_proposals(payer_user_id,created_at desc);

-- Deny all direct reads/writes to both anonymous and authenticated API roles.
-- The backend is the ONLY gateway, and must check Supabase JWT identity and
-- the household membership relationship for each request.
-- Server-only encrypted SANDBOX access-token vault.
-- No bank plaintext/access secrets or raw account numbers are stored.
create table if not exists public.finance_sandbox_tokens (
 connection_id uuid primary key references public.finance_connections(id) on delete cascade,
 encrypted_access_token text not null,
 transaction_cursor text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.finance_consent_events (
 id uuid primary key default gen_random_uuid(),
 connection_id uuid not null references public.finance_connections(id) on delete cascade,
 household_id uuid not null,
 owner_user_id uuid not null,
 event_type text not null check(event_type in ('granted','revoked','expired','sync_requested')),
 scopes text[] not null default '{}',
 recorded_at timestamptz not null default now(),
 foreign key (connection_id,household_id,owner_user_id)
   references public.finance_connections(id,household_id,owner_user_id) on delete cascade
);
create index if not exists finance_consent_events_owner on public.finance_consent_events(owner_user_id,recorded_at desc);

alter table public.finance_connections enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_payment_proposals enable row level security;
alter table public.finance_sandbox_tokens enable row level security;
alter table public.finance_consent_events enable row level security;
revoke all on public.finance_connections from anon,authenticated;
revoke all on public.finance_accounts from anon,authenticated;
revoke all on public.finance_transactions from anon,authenticated;
revoke all on public.finance_payment_proposals from anon,authenticated;
revoke all on public.finance_sandbox_tokens from anon,authenticated;
revoke all on public.finance_consent_events from anon,authenticated;
-- No policies: service-role backend only, least privilege at application layer.
-- Never place real bank access tokens in these public tables.
