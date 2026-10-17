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


-- Internal Sandbox synchronization is atomic: account changes, removals, and
-- the Plaid cursor are committed in the SAME PostgreSQL transaction.
-- Locking finance_connections serializes updates against consent revocation,
-- while the expected cursor prevents racing sync jobs from overwriting changes.
-- Only the server's service_role can invoke these functions.
create or replace function public.finance_apply_sandbox_changes(
  p_connection_id uuid, p_owner_user_id uuid, p_household_id uuid,
  p_expected_cursor text, p_next_cursor text,
  p_upserts jsonb, p_removals jsonb
) returns jsonb
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_connection public.finance_connections%rowtype;
  v_cursor text;
  v_upsert_count integer := 0;
  v_remove_count integer := 0;
begin
  select * into v_connection from public.finance_connections
    where id = p_connection_id and owner_user_id = p_owner_user_id
      and household_id = p_household_id and provider = 'plaid'
      and country_code = 'CA'
    for update;
  if not found or v_connection.status <> 'linked'
    or v_connection.consent_revoked_at is not null
    or v_connection.consent_expires_at is null
    or v_connection.consent_expires_at <= now() then
    raise exception 'Sandbox consent unavailable' using errcode = 'P0001';
  end if;

  select transaction_cursor into v_cursor from public.finance_sandbox_tokens
    where connection_id = p_connection_id for update;
  if not found or v_cursor is distinct from p_expected_cursor
     or p_next_cursor is null then
    raise exception 'Sandbox sync cursor conflict' using errcode = 'P0001';
  end if;

  insert into public.finance_transactions(
    account_id, household_id, owner_user_id, provider_transaction_ref,
    amount_minor, currency, booked_at, description, merchant, category
  )
  select a.id, p_household_id, p_owner_user_id,
    x.provider_transaction_ref, x.amount_minor, 'CAD', x.booked_at,
    coalesce(x.description,''), x.merchant, x.category
  from jsonb_to_recordset(coalesce(p_upserts,'[]'::jsonb)) as x(
    account_id uuid, provider_transaction_ref text, amount_minor bigint,
    currency text, booked_at timestamptz, description text,
    merchant text, category text
  )
  join public.finance_accounts a on a.id = x.account_id
    and a.connection_id = p_connection_id and a.owner_user_id = p_owner_user_id
    and a.household_id = p_household_id
  where x.currency = 'CAD'
    and x.provider_transaction_ref is not null
    and length(x.provider_transaction_ref) > 0
  on conflict (account_id, provider_transaction_ref) do update set
    amount_minor = excluded.amount_minor,
    currency = excluded.currency,
    booked_at = excluded.booked_at,
    description = excluded.description,
    merchant = excluded.merchant,
    category = excluded.category;
  get diagnostics v_upsert_count = row_count;

  delete from public.finance_transactions t
  using jsonb_to_recordset(coalesce(p_removals,'[]'::jsonb)) as x(
    account_id uuid, provider_transaction_ref text
  ), public.finance_accounts a
  where t.account_id = x.account_id
    and t.provider_transaction_ref = x.provider_transaction_ref
    and a.id = t.account_id and a.connection_id = p_connection_id
    and a.owner_user_id = p_owner_user_id and a.household_id = p_household_id;
  get diagnostics v_remove_count = row_count;

  update public.finance_sandbox_tokens
    set transaction_cursor = p_next_cursor, updated_at = now()
    where connection_id = p_connection_id;
  update public.finance_connections set last_synced_at = now(),
    updated_at = now() where id = p_connection_id;
  return jsonb_build_object(
    'transaction_updates', v_upsert_count, 'removed_count', v_remove_count
  );
end;
$$;

-- Never delete an Item's ciphertext until remote /item/remove succeeds.
-- Completing local erasure is one transaction so partial failures are retryable.
create or replace function public.finance_finalize_sandbox_disconnect(
  p_connection_id uuid, p_owner_user_id uuid, p_household_id uuid
) returns boolean
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_connection public.finance_connections%rowtype;
begin
  select * into v_connection from public.finance_connections
    where id = p_connection_id and owner_user_id = p_owner_user_id
      and household_id = p_household_id and provider = 'plaid'
      and country_code = 'CA'
    for update;
  if not found then
    raise exception 'Sandbox connection not found' using errcode = 'P0001';
  end if;
  if v_connection.status = 'revoked' then
    return true;
  end if;
  if v_connection.consent_revoked_at is null
     or v_connection.status <> 'error' then
    raise exception 'Sandbox consent must be revoked first' using errcode = 'P0001';
  end if;

  delete from public.finance_accounts where connection_id = p_connection_id
    and owner_user_id = p_owner_user_id and household_id = p_household_id;
  delete from public.finance_sandbox_tokens where connection_id = p_connection_id;
  update public.finance_connections set status = 'revoked', updated_at = now()
    where id = p_connection_id;
  return true;
end;
$$;

revoke all on function public.finance_apply_sandbox_changes(
  uuid,uuid,uuid,text,text,jsonb,jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.finance_finalize_sandbox_disconnect(
  uuid,uuid,uuid) from PUBLIC, anon, authenticated;
grant execute on function public.finance_apply_sandbox_changes(
  uuid,uuid,uuid,text,text,jsonb,jsonb) to service_role;
grant execute on function public.finance_finalize_sandbox_disconnect(
  uuid,uuid,uuid) to service_role;
