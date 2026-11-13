-- Migration 0050: allow the TEAM_LEAD and MANAGEMENT roles in profiles.role
--
-- The app has offered "Team Leader" and "Management" for a long time (src/types.ts Role), but
-- the check constraint from migration 0001 only allowed SUPER_ADMIN, ADMIN, HR, MANAGER and
-- EMPLOYEE, so creating or saving anyone with those two roles failed with
-- "violates check constraint profiles_role_check".

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGEMENT', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE'));
