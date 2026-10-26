-- Migration 0045: Attendance breaks
--
-- Employees can take any number of breaks between check-in and check-out. Each break is a row
-- with start_time and end_time (null while the break is running); at most one break per
-- attendance record can be running.
--
-- Writes go only through start_break() / end_break() (server clock, ownership and "session still
-- open" checks); there are no insert/update policies for app users. Checking out closes a
-- running break at the check-out time, whichever path sets check_out (app, attendance-punch,
-- server auto-close cron, or the client past-day fallback), so the frozen session modules need
-- no change. Breaks are not subject to Office Wi-Fi Check-in: people step out for lunch.

create table if not exists public.attendance_breaks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attendance_id   uuid not null references public.attendance(id) on delete cascade,
  employee_id     text not null,
  start_time      timestamptz not null default now(),
  end_time        timestamptz,
  created         timestamptz not null default now(),
  check (end_time is null or end_time >= start_time)
);

create unique index if not exists attendance_breaks_one_open_idx
  on public.attendance_breaks (attendance_id) where end_time is null;
create index if not exists attendance_breaks_attendance_idx
  on public.attendance_breaks (attendance_id);

alter table public.attendance_breaks enable row level security;

-- Same visibility as attendance: anyone in the organization (managers and admins list their
-- team's records through attendance too).
drop policy if exists "attendance_breaks_select" on public.attendance_breaks;
create policy "attendance_breaks_select" on public.attendance_breaks for select using (
  public.is_super_admin() or organization_id = public.auth_org_id()
);

drop policy if exists "attendance_breaks_delete" on public.attendance_breaks;
create policy "attendance_breaks_delete" on public.attendance_breaks for delete using (
  public.is_super_admin()
  or (organization_id = public.auth_org_id() and public.auth_role() in ('ADMIN', 'HR'))
);

-- ── Start / end ──────────────────────────────────────────────────────────────
create or replace function public.start_break(p_attendance_id uuid)
returns public.attendance_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att   public.attendance;
  v_break public.attendance_breaks;
begin
  select * into v_att from public.attendance where id = p_attendance_id;
  if v_att.id is null or v_att.employee_id <> auth.uid()::text then
    raise exception 'Attendance record not found' using errcode = '42501';
  end if;
  if v_att.check_out is not null then
    raise exception 'SESSION_CLOSED: You have already checked out.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.attendance_breaks where attendance_id = p_attendance_id and end_time is null) then
    raise exception 'BREAK_ALREADY_RUNNING: A break is already running.' using errcode = 'P0001';
  end if;

  insert into public.attendance_breaks (organization_id, attendance_id, employee_id)
  values (v_att.organization_id, v_att.id, v_att.employee_id)
  returning * into v_break;
  return v_break;
end;
$$;

create or replace function public.end_break(p_attendance_id uuid)
returns public.attendance_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_break public.attendance_breaks;
begin
  update public.attendance_breaks
     set end_time = now()
   where attendance_id = p_attendance_id
     and employee_id = auth.uid()::text
     and end_time is null
  returning * into v_break;
  if v_break.id is null then
    raise exception 'NO_RUNNING_BREAK: There is no break to end.' using errcode = 'P0001';
  end if;
  return v_break;
end;
$$;

revoke execute on function public.start_break(uuid) from public, anon;
revoke execute on function public.end_break(uuid) from public, anon;
grant execute on function public.start_break(uuid) to authenticated;
grant execute on function public.end_break(uuid) to authenticated;

-- ── Check-out closes a running break ─────────────────────────────────────────
create or replace function public.close_breaks_on_checkout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.attendance_breaks
     set end_time = greatest(start_time, new.check_out)
   where attendance_id = new.id
     and end_time is null;
  return new;
end;
$$;

drop trigger if exists trg_close_breaks_on_checkout on public.attendance;
create trigger trg_close_breaks_on_checkout
  after update of check_out on public.attendance
  for each row
  when (old.check_out is null and new.check_out is not null)
  execute function public.close_breaks_on_checkout();
