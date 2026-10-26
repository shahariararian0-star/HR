-- Migration 0047: Public Plan List
--
-- Purpose: Let the public landing page show the plans a Super Admin sets in the
-- Payments tab, so prices on the home page always match the Upgrade page.
--
-- Security: get_payment_settings() (migration 0040) returns the whole settings
-- value, including payment methods and account details, and is limited to
-- signed-in users. This function returns only the currency symbol and the plan
-- tiers (id, amount, duration, enabled), so it is safe for anonymous visitors.
--
-- Default behavior: Returns null when nothing has been saved yet or the saved
-- value is not valid JSON; the client then falls back to its built-in defaults.

create or replace function public.get_public_plans()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw text;
  doc jsonb;
begin
  select value into raw
  from public.settings
  where key = 'payment_settings'
    and organization_id is null
  limit 1;

  if raw is null then
    return null;
  end if;

  begin
    doc := raw::jsonb;
    -- Some writers store the JSON as a JSON string; unwrap one level.
    if jsonb_typeof(doc) = 'string' then
      doc := (doc #>> '{}')::jsonb;
    end if;
  exception when others then
    return null;
  end;

  if jsonb_typeof(doc) <> 'object' then
    return null;
  end if;

  return jsonb_build_object(
    'currencySymbol', doc -> 'currencySymbol',
    'tiers', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t -> 'id',
          'amount', t -> 'amount',
          'duration', t -> 'duration',
          'enabled', t -> 'enabled'
        ))
        from jsonb_array_elements(
          case when jsonb_typeof(doc -> 'tiers') = 'array' then doc -> 'tiers' else '[]'::jsonb end
        ) as t
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.get_public_plans() from public;
grant execute on function public.get_public_plans() to anon, authenticated;

comment on function public.get_public_plans() is
'Returns the currency symbol and plan tiers from the platform payment settings for the public landing page. Null when unset. Callable by anyone.';
