-- Migration 0040: Payment Settings Reader
--
-- Purpose: Let signed-in organization admins read the platform payment
-- settings (donation tiers, payment methods, instructions) that a Super Admin
-- edits in the Payments tab. Those settings live in public.settings under
-- key 'payment_settings' with organization_id = null, and the settings RLS
-- policy only lets Super Admins read platform-level rows.
--
-- Security: Returns only the value of the 'payment_settings' row. No other
-- settings are exposed. Writes still go through the normal settings RLS
-- policies, which allow only Super Admins to touch platform-level rows.
--
-- Default behavior: Returns null when nothing has been saved yet; the client
-- then falls back to its built-in defaults.

create or replace function public.get_payment_settings()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value
  from public.settings
  where key = 'payment_settings'
    and organization_id is null
  limit 1
$$;

revoke execute on function public.get_payment_settings() from public, anon;
grant execute on function public.get_payment_settings() to authenticated;

comment on function public.get_payment_settings() is
'Returns the platform payment settings JSON (key payment_settings, organization_id null) for the Upgrade page. Null when unset. Callable by signed-in users only.';
