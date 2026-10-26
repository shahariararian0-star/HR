-- Migration 0043: Office Wi-Fi Check-in
--
-- Lets an organization require employees to be on the office Wi-Fi to clock in / out.
-- The office's public IP is learned automatically: when an employee punches with GPS inside
-- one of the org's office geofences (app_config.officeLocations), the attendance-punch edge
-- function records the request's source IP in office_networks. Later punches from a recorded,
-- non-expired IP are allowed without GPS.
--
-- Settings live in the existing settings table (key 'office_wifi_checkin', org-scoped), whose
-- RLS already limits writes to the org's ADMIN / HR:
--   { "enabled": bool, "ipExpiryHours": number, "exemptDutyTypes": [..], "exemptRoles": [..] }
--
-- Enforcement is a trigger rather than rewritten RLS policies, because it needs to know which
-- columns change: while the feature is ON, an employee's own direct writes may still attach a
-- selfie or close a forgotten PAST-day session (workdaySessionManager's client fallback), but
-- may not create a check-in or change punch times / GPS. When the feature is OFF, nothing
-- changes. The service role (edge functions, cron) is never restricted.

-- ── 1. Attendance columns ────────────────────────────────────────────────────
alter table public.attendance
  add column if not exists network_check text
    check (network_check in ('office_wifi', 'learned', 'exempt', 'not_checked')),
  add column if not exists client_ip text;

-- ── 2. Learned office networks ───────────────────────────────────────────────
create table if not exists public.office_networks (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations(id) on delete cascade,
  ip                       text not null,   -- IPv4 address, or IPv6 /64 prefix
  first_seen               timestamptz not null default now(),
  last_seen                timestamptz not null default now(),
  learned_from_employee_id uuid references public.profiles(id) on delete set null,
  unique (organization_id, ip)
);

alter table public.office_networks enable row level security;

drop policy if exists "office_networks_select" on public.office_networks;
create policy "office_networks_select" on public.office_networks for select using (
  public.is_super_admin()
  or (organization_id = public.auth_org_id() and public.auth_role() in ('ADMIN', 'HR'))
);

drop policy if exists "office_networks_delete" on public.office_networks;
create policy "office_networks_delete" on public.office_networks for delete using (
  public.is_super_admin()
  or (organization_id = public.auth_org_id() and public.auth_role() in ('ADMIN', 'HR'))
);
-- No insert/update policies: only the service role (attendance-punch) records networks.

-- ── 3. Is the feature on for an organization? ────────────────────────────────
create or replace function public.office_wifi_enabled(p_org uuid)
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
   where organization_id = p_org and key = 'office_wifi_checkin'
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

-- ── 4. Guard trigger on attendance ───────────────────────────────────────────
-- SECURITY INVOKER on purpose: current_user is the caller's database role
-- ('authenticated' for app users, 'service_role' for edge functions / cron).
create or replace function public.attendance_office_wifi_guard()
returns trigger
language plpgsql
set search_path = public
as $$
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

  if not public.office_wifi_enabled(coalesce(new.organization_id, old.organization_id)) then
    return new;
  end if;

  -- ADMIN / HR can already edit any attendance row; their own punches still go through
  -- attendance-punch in the app.
  if public.auth_role() in ('ADMIN', 'HR', 'SUPER_ADMIN') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'OFFICE_WIFI_REQUIRED: Please connect to the office Wi-Fi to check in.'
      using errcode = '42501';
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
      raise exception 'OFFICE_WIFI_REQUIRED: Please connect to the office Wi-Fi to check in.'
        using errcode = '42501';
    end if;
    -- Closing a forgotten past-day session stays allowed (workdaySessionManager fallback).
    if new.check_out is distinct from old.check_out
       and not (old.check_out is null and old.date < current_date) then
      raise exception 'OFFICE_WIFI_REQUIRED: Please connect to the office Wi-Fi to check in.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_office_wifi_guard on public.attendance;
create trigger trg_attendance_office_wifi_guard
  before insert or update on public.attendance
  for each row execute function public.attendance_office_wifi_guard();
