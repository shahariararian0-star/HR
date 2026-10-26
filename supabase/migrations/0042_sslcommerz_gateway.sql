-- Migration 0042: SSLCommerz payment gateway
--
-- Adds 'sslcommerz' next to Stripe and PayPal (migration 0041):
--   - payments.provider accepts 'sslcommerz'
--   - Vault keys for SSLCommerz: store_id, store_password
-- Function bodies are otherwise unchanged from 0041.

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check check (provider in ('stripe', 'paypal', 'sslcommerz'));

create or replace function public.payment_gateway_allowed_keys(p_provider text)
returns text[]
language sql
immutable
as $$
  select case p_provider
    when 'stripe'     then array['secret_key', 'webhook_secret']
    when 'paypal'     then array['client_id', 'client_secret']
    when 'sslcommerz' then array['store_id', 'store_password']
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
  if cardinality(public.payment_gateway_allowed_keys(p_provider)) = 0 or p_mode not in ('test', 'live') then
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

revoke execute on function public.set_payment_gateway_secrets(text, text, jsonb) from public, anon;
grant  execute on function public.set_payment_gateway_secrets(text, text, jsonb) to authenticated;
