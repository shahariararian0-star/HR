-- Migration 0049: Owner → HR → staff role hierarchy, per-HR access, role-escalation fix
--
-- Model
--   ADMIN  = the company Owner (the person who registered). Full access. Only an ADMIN can
--            create or change ADMIN and HR people.
--   HR     = access limited by profiles.permissions (text[] of module keys). NULL = all modules,
--            so every HR that existed before this migration keeps the access it had.
--   Others = TEAM_LEAD, MANAGER, MANAGEMENT, EMPLOYEE. HR with 'employees' can create and
--            change these.
--
-- Security fix
--   Until now profiles_update let any member of a company update any profile in it, including
--   `role`, so an employee could make themselves ADMIN or SUPER_ADMIN. profiles_update is
--   tightened and a trigger now checks every change to role, permissions, organization,
--   verified and status. Edge functions, cron and the SQL editor (service role) are not
--   restricted, the same rule as attendance_office_wifi_guard (migration 0043).

-- ── 1. Per-HR access list ────────────────────────────────────────────────────
alter table public.profiles add column if not exists permissions text[];

comment on column public.profiles.permissions is
  'HR only: module keys this person may use (employees, attendance, leave, announcements, notifications, performance, organization, reports, settings, billing). NULL = all.';

-- ── 2. has_permission(key) ───────────────────────────────────────────────────
create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.role in ('SUPER_ADMIN', 'ADMIN') then true
      when p.role = 'HR' then p.permissions is null or p_key = any(p.permissions)
      else false
    end
    from public.profiles p
    where p.id = auth.uid()
  ), false)
$$;

-- ── 3. Who may edit a profile row at all ─────────────────────────────────────
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (
  public.is_super_admin()
  or id = auth.uid()
  or (
    organization_id = public.auth_org_id()
    and (
      public.auth_role() = 'ADMIN'
      or (public.auth_role() = 'HR' and public.has_permission('employees'))
    )
  )
);

-- ── 4. What may change ───────────────────────────────────────────────────────
-- Has the signed-in user confirmed their email? Lets the app's verification flow mark the
-- user's own profile verified (src/services/verification.service.ts) without letting an
-- unconfirmed account verify itself.
create or replace function public.auth_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = auth.uid()), false)
$$;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role   text;
  v_staff  text[] := array['EMPLOYEE', 'TEAM_LEAD', 'MANAGER', 'MANAGEMENT'];
  v_old_role text;
begin
  -- Edge functions, cron and SQL editor are trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  v_role := public.auth_role();
  if v_role = 'SUPER_ADMIN' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Profiles are created by the register / create-employee functions (service role).
    raise exception 'ROLE_NOT_ALLOWED: Profiles are created through the app.' using errcode = '42501';
  end if;

  v_old_role := old.role;

  -- Nobody but Super Admin touches SUPER_ADMIN.
  if new.role = 'SUPER_ADMIN' or v_old_role = 'SUPER_ADMIN' then
    if new.role is distinct from v_old_role then
      raise exception 'ROLE_NOT_ALLOWED: Only the platform can change this role.' using errcode = '42501';
    end if;
  end if;

  -- Your own account: personal details only.
  if old.id = auth.uid() then
    if new.role is distinct from old.role
       or new.permissions is distinct from old.permissions
       or new.organization_id is distinct from old.organization_id
       or new.status is distinct from old.status then
      raise exception 'ROLE_NOT_ALLOWED: You cannot change your own role or access.' using errcode = '42501';
    end if;
    if new.verified is distinct from old.verified
       and not (new.verified = true and public.auth_email_confirmed()) then
      raise exception 'ROLE_NOT_ALLOWED: You cannot change your own verification.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- The Owner (ADMIN) may change anyone in the company except Super Admin (checked above).
  if v_role = 'ADMIN' then
    return new;
  end if;

  -- HR: staff only, never Owner / HR rows, never access lists.
  if v_role = 'HR' then
    if v_old_role in ('ADMIN', 'HR') then
      raise exception 'ROLE_NOT_ALLOWED: Only the Owner can change Owner or HR accounts.' using errcode = '42501';
    end if;
    if new.role is distinct from old.role and not (new.role = any(v_staff)) then
      raise exception 'ROLE_NOT_ALLOWED: Only the Owner can make someone HR or Owner.' using errcode = '42501';
    end if;
    if new.permissions is distinct from old.permissions then
      raise exception 'ROLE_NOT_ALLOWED: Only the Owner can change access.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Anyone else (should already be stopped by profiles_update).
  raise exception 'ROLE_NOT_ALLOWED: You cannot change this account.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- ── 5. Company settings: Owner, or HR with Organization or Settings access ───
drop policy if exists "settings_insert" on public.settings;
create policy "settings_insert" on public.settings for insert with check (
  public.is_super_admin()
  or (
    organization_id = public.auth_org_id()
    and (public.has_permission('organization') or public.has_permission('settings'))
    and public.auth_role() in ('ADMIN', 'HR')
  )
);

drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings for update using (
  public.is_super_admin()
  or (
    organization_id = public.auth_org_id()
    and (public.has_permission('organization') or public.has_permission('settings'))
    and public.auth_role() in ('ADMIN', 'HR')
  )
);

-- ── 6. Upgrade requests: Owner, or HR with Billing access ────────────────────
drop policy if exists "upgrade_requests_insert" on public.upgrade_requests;
create policy "upgrade_requests_insert" on public.upgrade_requests for insert with check (
  public.is_super_admin()
  or (public.auth_role() in ('ADMIN', 'HR') and public.has_permission('billing'))
);
