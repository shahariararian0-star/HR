-- Migration 0041: Online payments (Stripe, PayPal)
--
-- 1. organizations.paid_until — when a paid plan ends. Null means no end date
--    (lifetime plan, manual approval, or never paid). cron-expire-trials moves
--    ACTIVE organizations past paid_until to AD_SUPPORTED, the same place an
--    unpaid trial goes.
-- 2. public.payments — one row per checkout attempt. Only edge functions
--    (service role) write it; Super Admin reads everything, org ADMIN/HR read
--    their own organization's rows.
-- 3. Gateway keys in Supabase Vault (encrypted at rest), one secret per
--    provider and mode, named payment_gateway:<provider>:<mode>.
--    - set_payment_gateway_secrets(): Super Admin writes keys. Blank values keep
--      the stored key, so the dashboard never has to read a key back.
--    - get_payment_gateway_status(): Super Admin sees which keys are set and
--      their last 4 characters, never the keys themselves.
--    - get_payment_gateway_secrets(): service role only, for edge functions.
--
-- Non-secret gateway options (enabled, test/live mode, currency code) live in
-- the existing payment_settings row read through get_payment_settings().

-- ── 1. Paid-until date ───────────────────────────────────────────────────────
alter table public.organizations add column if not exists paid_until timestamptz;

-- ── 2. Payments ──────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider        text not null check (provider in ('stripe', 'paypal')),
  mode            text not null check (mode in ('test', 'live')),
  tier            text not null check (tier in ('TIER_3MO', 'TIER_6MO', 'TIER_1YR', 'TIER_LIFETIME')),
  amount          numeric not null check (amount > 0),
  currency        text not null,
  status          text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
  provider_ref    text,                 -- Stripe checkout session id / PayPal order id
  return_origin   text not null,        -- app origin to send the payer back to
  created_by      uuid references auth.users(id) on delete set null,
  created         timestamptz not null default now(),
  paid_at         timestamptz,
  paid_until      timestamptz           -- organization's paid_until after this payment; null for lifetime
);

create unique index if not exists payments_provider_ref_idx
  on public.payments (provider, provider_ref) where provider_ref is not null;
create index if not exists payments_org_created_idx
  on public.payments (organization_id, created desc);

alter table public.payments enable row level security;

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments for select using (
  public.is_super_admin()
  or (organization_id = public.auth_org_id() and public.auth_role() in ('ADMIN', 'HR'))
);
-- No insert/update/delete policies: only the service role writes payments.

-- ── 3. Gateway keys in Vault ─────────────────────────────────────────────────
create or replace function public.payment_gateway_allowed_keys(p_provider text)
returns text[]
language sql
immutable
as $$
  select case p_provider
    when 'stripe' then array['secret_key', 'webhook_secret']
    when 'paypal' then array['client_id', 'client_secret']
    else array[]::text[]
  end
$$;

create or replace function public.set_payment_gateway_secrets(p_provider text, p_mode text, p_secrets jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := 'payment_gateway:' || p_provider || ':' || p_mode;
  v_id       uuid;
  v_existing jsonb;
  v_incoming jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN may change payment gateway keys' using errcode = '42501';
  end if;
  if p_provider not in ('stripe', 'paypal') or p_mode not in ('test', 'live') then
    raise exception 'Unknown payment gateway or mode' using errcode = '22023';
  end if;

  -- Keep only known keys with non-blank string values.
  select coalesce(jsonb_object_agg(key, to_jsonb(btrim(value))), '{}'::jsonb)
    into v_incoming
    from jsonb_each_text(coalesce(p_secrets, '{}'::jsonb))
   where key = any(public.payment_gateway_allowed_keys(p_provider))
     and btrim(coalesce(value, '')) <> '';

  select id, decrypted_secret::jsonb
    into v_id, v_existing
    from vault.decrypted_secrets
   where name = v_name;

  if v_id is null then
    perform vault.create_secret(v_incoming::text, v_name, 'OpenHRApp payment gateway keys');
  else
    perform vault.update_secret(v_id, (coalesce(v_existing, '{}'::jsonb) || v_incoming)::text);
  end if;
end;
$$;

create or replace function public.get_payment_gateway_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_row    record;
begin
  if not public.is_super_admin() then
    raise exception 'Only SUPER_ADMIN may view payment gateway status' using errcode = '42501';
  end if;

  for v_row in
    select substring(name from length('payment_gateway:') + 1) as gateway, decrypted_secret::jsonb as secrets
      from vault.decrypted_secrets
     where name like 'payment_gateway:%'
  loop
    v_result := v_result || jsonb_build_object(
      v_row.gateway,
      (select coalesce(jsonb_object_agg(key, '…' || right(value, 4)), '{}'::jsonb)
         from jsonb_each_text(v_row.secrets)
        where value <> '')
    );
  end loop;

  return v_result;
end;
$$;

create or replace function public.get_payment_gateway_secrets(p_provider text, p_mode text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret::jsonb
    from vault.decrypted_secrets
   where name = 'payment_gateway:' || p_provider || ':' || p_mode
$$;

revoke execute on function public.set_payment_gateway_secrets(text, text, jsonb) from public, anon;
grant  execute on function public.set_payment_gateway_secrets(text, text, jsonb) to authenticated;

revoke execute on function public.get_payment_gateway_status() from public, anon;
grant  execute on function public.get_payment_gateway_status() to authenticated;

revoke execute on function public.get_payment_gateway_secrets(text, text) from public, anon, authenticated;
grant  execute on function public.get_payment_gateway_secrets(text, text) to service_role;
