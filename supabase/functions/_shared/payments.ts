// StaffCove — shared online payment logic (Stripe, PayPal, SSLCommerz)
//
// Used by payment-checkout (start / verify), payment-return (payer comes back from the
// gateway) and stripe-webhook. Every path ends in verifyAndActivate(), which asks the
// gateway itself whether the payment went through — nothing the browser sends is trusted.
//
// Config:  settings row 'payment_settings' (organization_id null) → currencyCode, tiers,
//          gateways.{stripe,paypal}.{enabled,mode}
// Keys:    Vault via get_payment_gateway_secrets(provider, mode) (migration 0041)

// deno-lint-ignore-file no-explicit-any
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type Provider = 'stripe' | 'paypal' | 'sslcommerz';
export type Mode = 'test' | 'live';
export type Tier = 'TIER_3MO' | 'TIER_6MO' | 'TIER_1YR' | 'TIER_LIFETIME';

export const PROVIDERS: Provider[] = ['stripe', 'paypal', 'sslcommerz'];

/** Months a tier buys; null = lifetime (no end date). */
export const TIER_MONTHS: Record<Tier, number | null> = {
  TIER_3MO: 3,
  TIER_6MO: 6,
  TIER_1YR: 12,
  TIER_LIFETIME: null,
};

export interface PaymentRow {
  id: string;
  organization_id: string;
  provider: Provider;
  mode: Mode;
  tier: Tier;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  provider_ref: string | null;
  return_origin: string;
}

export interface PaymentConfig {
  currencyCode: string;
  tiers: { id: Tier; amount: number; duration: string; enabled: boolean }[];
  gateways: Record<Provider, { enabled: boolean; mode: Mode }>;
}

export async function loadPaymentConfig(admin: SupabaseClient): Promise<PaymentConfig> {
  const { data } = await admin
    .from('settings')
    .select('value')
    .eq('key', 'payment_settings')
    .is('organization_id', null)
    .maybeSingle();
  let raw: any = {};
  try {
    raw = typeof data?.value === 'string' ? JSON.parse(data.value) : (data?.value ?? {});
  } catch {
    raw = {};
  }
  const gateway = (p: Provider) => ({
    enabled: raw?.gateways?.[p]?.enabled === true,
    mode: (raw?.gateways?.[p]?.mode === 'live' ? 'live' : 'test') as Mode,
  });
  return {
    currencyCode: typeof raw.currencyCode === 'string' && /^[A-Za-z]{3}$/.test(raw.currencyCode)
      ? raw.currencyCode.toUpperCase()
      : 'USD',
    tiers: Array.isArray(raw.tiers) ? raw.tiers : [],
    gateways: { stripe: gateway('stripe'), paypal: gateway('paypal'), sslcommerz: gateway('sslcommerz') },
  };
}

export async function loadSecrets(admin: SupabaseClient, provider: Provider, mode: Mode): Promise<Record<string, string>> {
  const { data, error } = await admin.rpc('get_payment_gateway_secrets', { p_provider: provider, p_mode: mode });
  if (error) throw new Error(`Could not read ${provider} keys: ${error.message}`);
  return (data ?? {}) as Record<string, string>;
}

// ── Money formatting ─────────────────────────────────────────────────────────

const STRIPE_ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const PAYPAL_ZERO_DECIMAL = new Set(['HUF', 'JPY', 'TWD']);

export function stripeMinorUnits(amount: number, currency: string): number {
  return STRIPE_ZERO_DECIMAL.has(currency) ? Math.round(amount) : Math.round(amount * 100);
}

export function paypalAmount(amount: number, currency: string): string {
  return PAYPAL_ZERO_DECIMAL.has(currency) ? String(Math.round(amount)) : amount.toFixed(2);
}

// ── Gateway clients ──────────────────────────────────────────────────────────

export async function stripeApi(secretKey: string, method: 'GET' | 'POST', path: string, form?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${body?.error?.message || res.statusText}`);
  return body;
}

export function paypalBase(mode: Mode): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export async function paypalToken(secrets: Record<string, string>, mode: Mode): Promise<string> {
  const res = await fetch(`${paypalBase(mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${secrets.client_id}:${secrets.client_secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`PayPal: ${body?.error_description || res.statusText}`);
  return body.access_token;
}

export async function paypalApi(token: string, mode: Mode, method: 'GET' | 'POST', path: string, json?: unknown, requestId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const res = await fetch(`${paypalBase(mode)}${path}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : undefined,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`PayPal: ${body?.details?.[0]?.description || body?.message || res.statusText}`);
  return body;
}

export function sslcommerzBase(mode: Mode): string {
  return mode === 'live' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';
}

/** SSLCommerz caps tran_id at 30 characters, so a payment's uuid is shortened. */
export function sslcommerzTranId(paymentId: string): string {
  return `OHR${paymentId.replace(/-/g, '').slice(0, 24)}`;
}

export async function sslcommerzInit(secrets: Record<string, string>, mode: Mode, fields: Record<string, string>) {
  const res = await fetch(`${sslcommerzBase(mode)}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ store_id: secrets.store_id, store_passwd: secrets.store_password, ...fields }).toString(),
  });
  const body = await res.json();
  if (body?.status !== 'SUCCESS' || !body?.GatewayPageURL) {
    throw new Error(`SSLCommerz: ${body?.failedreason || 'could not start payment'}`);
  }
  return body;
}

// ── Verify with the gateway, then activate ───────────────────────────────────

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Marks the payment PAID once (idempotent) and extends the organization's plan. */
async function activate(admin: SupabaseClient, payment: PaymentRow): Promise<void> {
  const now = new Date();
  // The status guard makes this the single winner when return page, webhook and
  // re-check race each other — only one caller extends the plan.
  const { data: claimed } = await admin
    .from('payments')
    .update({ status: 'PAID', paid_at: now.toISOString() })
    .eq('id', payment.id)
    .neq('status', 'PAID')
    .select('id');
  if (!claimed || claimed.length === 0) return;

  const months = TIER_MONTHS[payment.tier];
  let paidUntil: string | null = null;
  if (months !== null) {
    const { data: org } = await admin
      .from('organizations')
      .select('subscription_status, paid_until')
      .eq('id', payment.organization_id)
      .single();
    const current = org?.paid_until ? new Date(org.paid_until) : null;
    // Renewing before the plan ends adds on top of the remaining time.
    const start = org?.subscription_status === 'ACTIVE' && current && current > now ? current : now;
    paidUntil = addMonths(start, months).toISOString();
  }

  await admin
    .from('organizations')
    .update({ subscription_status: 'ACTIVE', trial_end_date: null, paid_until: paidUntil })
    .eq('id', payment.organization_id);
  await admin.from('payments').update({ paid_until: paidUntil }).eq('id', payment.id);
  console.log(`[payments] ${payment.provider} payment ${payment.id} PAID — org ${payment.organization_id} active until ${paidUntil ?? 'forever'}`);
}

async function markStatus(admin: SupabaseClient, payment: PaymentRow, status: 'FAILED' | 'CANCELLED') {
  await admin.from('payments').update({ status }).eq('id', payment.id).eq('status', 'PENDING');
}

/**
 * Asks the gateway whether this payment is complete (capturing an approved PayPal order),
 * checks it matches what we charged, and activates the organization. Returns the final status.
 */
export async function verifyAndActivate(admin: SupabaseClient, payment: PaymentRow): Promise<PaymentRow['status']> {
  if (payment.status === 'PAID') return 'PAID';
  if (!payment.provider_ref) return payment.status;

  const secrets = await loadSecrets(admin, payment.provider, payment.mode);

  if (payment.provider === 'stripe') {
    const session = await stripeApi(secrets.secret_key, 'GET', `/checkout/sessions/${encodeURIComponent(payment.provider_ref)}`);
    const matches = session.client_reference_id === payment.id
      && session.amount_total === stripeMinorUnits(Number(payment.amount), payment.currency)
      && String(session.currency).toUpperCase() === payment.currency;
    if (session.payment_status === 'paid' && matches) {
      await activate(admin, payment);
      return 'PAID';
    }
    if (session.status === 'expired') {
      await markStatus(admin, payment, 'CANCELLED');
      return 'CANCELLED';
    }
    return 'PENDING';
  }

  if (payment.provider === 'sslcommerz') {
    // Query by our transaction id rather than trusting the val_id posted to the return URL.
    const query = new URLSearchParams({
      tran_id: payment.provider_ref,
      store_id: secrets.store_id,
      store_passwd: secrets.store_password,
      format: 'json',
    });
    const res = await fetch(`${sslcommerzBase(payment.mode)}/validator/api/merchantTransIDvalidationAPI.php?${query}`);
    const body = await res.json();
    const elements: any[] = Array.isArray(body?.element) ? body.element : [];
    // When charged in a foreign currency, SSLCommerz reports the original in currency_type/currency_amount.
    const paid = elements.find(el => {
      const currency = String(el.currency_type || el.currency || '').toUpperCase();
      const amount = Number(el.currency_amount ?? el.amount);
      return (el.status === 'VALID' || el.status === 'VALIDATED')
        && el.tran_id === payment.provider_ref
        && currency === payment.currency
        && Math.abs(amount - Number(payment.amount)) < 0.01;
    });
    if (paid) {
      await activate(admin, payment);
      return 'PAID';
    }
    if (elements.length > 0 && elements.every(el => el.status === 'FAILED' || el.status === 'CANCELLED')) {
      const status = elements.some(el => el.status === 'CANCELLED') ? 'CANCELLED' : 'FAILED';
      await markStatus(admin, payment, status);
      return status;
    }
    return 'PENDING';
  }

  // PayPal
  const token = await paypalToken(secrets, payment.mode);
  let order = await paypalApi(token, payment.mode, 'GET', `/v2/checkout/orders/${encodeURIComponent(payment.provider_ref)}`);
  if (order.status === 'APPROVED') {
    // Request id makes a repeated capture return the first result instead of charging twice.
    await paypalApi(token, payment.mode, 'POST', `/v2/checkout/orders/${encodeURIComponent(payment.provider_ref)}/capture`, {}, `capture-${payment.id}`);
    // The capture response can be a minimal representation; re-read the full order.
    order = await paypalApi(token, payment.mode, 'GET', `/v2/checkout/orders/${encodeURIComponent(payment.provider_ref)}`);
  }
  if (order.status === 'COMPLETED') {
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const matches = (unit?.custom_id ?? capture?.custom_id) === payment.id
      && capture?.status === 'COMPLETED'
      && capture?.amount?.currency_code === payment.currency
      && capture?.amount?.value === paypalAmount(Number(payment.amount), payment.currency);
    if (matches) {
      await activate(admin, payment);
      return 'PAID';
    }
    console.error(`[payments] PayPal order ${payment.provider_ref} completed but does not match payment ${payment.id}`);
    await markStatus(admin, payment, 'FAILED');
    return 'FAILED';
  }
  if (order.status === 'VOIDED') {
    await markStatus(admin, payment, 'CANCELLED');
    return 'CANCELLED';
  }
  return 'PENDING';
}
