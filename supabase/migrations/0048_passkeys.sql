-- Migration 0048: Fingerprint (passkey / WebAuthn) sign-in and check-in
--
-- Employees can register their phone's fingerprint (a WebAuthn platform credential) and use it
-- to sign in without a password and, when their organization turns on "Fingerprint check-in",
-- to prove it is them when they clock in and out. The phone keeps the private key; only the
-- public key is stored here. All writes go through the `passkey` and `attendance-punch` edge
-- functions (service role); the app can only read and remove credentials.
--
-- The org setting lives in the existing settings table, key 'biometric_checkin':
--   { "enabled": bool }
-- Its RLS already limits writes to the org's ADMIN / HR.
--
-- The attendance guard from migration 0043 is widened: the "punches go through
-- attendance-punch" rule now applies when Office Wi-Fi Check-in OR Fingerprint check-in is on.
-- With both off, nothing changes. Wi-Fi-only behaviour is unchanged.

-- ── 1. Registered credentials ────────────────────────────────────────────────
create table if not exists public.passkey_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  credential_id   text not null unique,      -- base64url
  public_key      text not null,             -- base64url COSE key
  counter         bigint not null default 0,
  transports      text[] not null default '{}',
  device_label    text not null default '',
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists passkey_credentials_user_idx on public.passkey_credentials (user_id);
create index if not exists passkey_credentials_org_idx on public.passkey_credentials (organization_id);

alter table public.passkey_credentials enable row level security;

drop policy if exists "passkey_credentials_select" on public.passkey_credentials;
create policy "passkey_credentials_select" on public.passkey_credentials for select using (
  public.is_super_admin()
  or user_id = auth.uid()
  or (organization_id = public.auth_org_id() and public.auth_role() in ('ADMIN', 'HR'))
);

-- Removing a credential: the owner (lost phone), the org's ADMIN / HR ("Reset fingerprint"),
-- or Super Admin. No insert / update policy: only the edge functions write.
drop policy if exists "passkey_credentials_delete" on public.passkey_credentials;
create policy "passkey_credentials_delete" on public.passkey_credentials for delete using (
  public.is_super_admin()
  or user_id = auth.uid()
  or (organization_id = public.auth_org_id() and public.auth_role() in ('ADMIN', 'HR'))
);

-- ── 2. One-time challenges (service role only) ───────────────────────────────
create table if not exists public.passkey_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,  -- null for sign-in
  purpose    text not null check (purpose in ('register', 'login', 'punch')),
  challenge  text not null,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists passkey_challenges_expires_idx on public.passkey_challenges (expires_at);

alter table public.passkey_challenges enable row level security;
-- No policies: app users can neither read nor write challenges.

-- ── 3. Is Fingerprint check-in on for an organization? ───────────────────────
create or replace function public.biometric_checkin_enabled(p_org uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value text;
begin
  select value into v_value
    from public.settings
   where organization_id = p_org and key = 'biometric_checkin'
   limit 1;
  if v_value is null then
    return false;
  end if;
  return coalesce((v_value::jsonb ->> 'enabled')::boolean, false);
exception when others then
  -- Unreadable setting: behave as OFF so attendance keeps working.
  return false;
end;
$$;

-- ── 4. Widen the attendance guard ────────────────────────────────────────────
-- Same function body as migration 0043, except the early exit now checks both features and
-- the error names whichever check is on.
create or replace function public.attendance_office_wifi_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_org   uuid;
  v_wifi  boolean;
  v_bio   boolean;
  v_error text;
begin
  -- Edge functions, cron and SQL editor are trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- App users can never write the network verdict or the recorded IP.
  if tg_op = 'INSERT' then
    new.network_check := 'not_checked';
    new.client_ip := null;
  else
    new.network_check := old.network_check;
    new.client_ip := old.client_ip;
  end if;

  v_org  := coalesce(new.organization_id, old.organization_id);
  v_wifi := public.office_wifi_enabled(v_org);
  v_bio  := public.biometric_checkin_enabled(v_org);

  if not (v_wifi or v_bio) then
    return new;
  end if;

  if v_wifi then
    v_error := 'OFFICE_WIFI_REQUIRED: Please connect to the office Wi-Fi to check in.';
  else
    v_error := 'FINGERPRINT_REQUIRED: Please confirm with your fingerprint to check in.';
  end if;

  -- ADMIN / HR can already edit any attendance row; their own punches still go through
  -- attendance-punch in the app.
  if public.auth_role() in ('ADMIN', 'HR', 'SUPER_ADMIN') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception '%', v_error using errcode = '42501';
  end if;

  -- Own row: punch fields may only change through attendance-punch.
  if old.employee_id = auth.uid()::text then
    if new.check_in        is distinct from old.check_in
       or new.date            is distinct from old.date
       or new.status          is distinct from old.status
       or new.duty_type       is distinct from old.duty_type
       or new.latitude        is distinct from old.latitude
       or new.longitude       is distinct from old.longitude
       or new.location        is distinct from old.location
       or new.employee_id     is distinct from old.employee_id
       or new.organization_id is distinct from old.organization_id then
      raise exception '%', v_error using errcode = '42501';
    end if;
    -- Closing a forgotten past-day session stays allowed (workdaySessionManager fallback).
    if new.check_out is distinct from old.check_out
       and not (old.check_out is null and old.date < current_date) then
      raise exception '%', v_error using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
