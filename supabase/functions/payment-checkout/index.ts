// StaffCove — Payment Checkout Edge Function
// Requires a signed-in caller (JWT verified by the gateway).
//
// POST { action: 'create', provider: 'stripe' | 'paypal' | 'sslcommerz', tier }
//   ADMIN / HR only. Creates a PENDING payment row and a Stripe Checkout Session, PayPal
//   order or SSLCommerz session for the tier's price from payment_settings (the browser
//   never sends the amount).
//   Returns { url } — the gateway page to send the payer to.
//
// POST { action: 'verify', paymentId }
//   SUPER_ADMIN, or ADMIN / HR of the payment's organization. Asks the gateway again and
//   activates the organization if the payment went through. Returns { status }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadPaymentConfig, loadSecrets, verifyAndActivate, stripeApi, stripeMinorUnits,
  paypalToken, paypalApi, paypalAmount, sslcommerzInit, sslcommerzTranId,
  PROVIDERS, TIER_MONTHS, Provider, Tier, PaymentRow,
} from '../_shared/payments.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing Authorization header' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !caller) return json(401, { error: 'Invalid token' });

  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id, name, mobile')
    .eq('id', caller.id)
    .single();
  if (!profile) return json(403, { error: 'Profile not found' });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  try {
    // ── Verify an existing payment ───────────────────────────────────────────
    if (body.action === 'verify') {
      const { data: payment } = await admin.from('payments').select('*').eq('id', body.paymentId).maybeSingle();
      if (!payment) return json(404, { error: 'Payment not found' });
      const allowed = profile.role === 'SUPER_ADMIN'
        || (payment.organization_id === profile.organization_id && ['ADMIN', 'HR'].includes(profile.role));
      if (!allowed) return json(403, { error: 'Not allowed' });
      const status = await verifyAndActivate(admin, payment as PaymentRow);
      return json(200, { status });
    }

    if (body.action !== 'create') return json(400, { error: 'Unknown action' });

    // ── Start a new payment ──────────────────────────────────────────────────
    if (!['ADMIN', 'HR'].includes(profile.role) || !profile.organization_id) {
      return json(403, { error: 'Only organization admins can pay for a plan' });
    }

    const provider = body.provider as Provider;
    const tierId = body.tier as Tier;
    if (!PROVIDERS.includes(provider)) return json(400, { error: 'Unknown payment provider' });
    if (!(tierId in TIER_MONTHS)) return json(400, { error: 'Unknown plan' });

    const config = await loadPaymentConfig(admin);
    const gateway = config.gateways[provider];
    if (!gateway.enabled) return json(400, { error: `${provider} payments are not enabled` });

    const tier = config.tiers.find(t => t.id === tierId);
    // Missing tiers fall back to the dashboard defaults, which are not chargeable until saved.
    if (!tier || tier.enabled === false || !(Number(tier.amount) > 0)) {
      return json(400, { error: 'This plan is not available for online payment' });
    }

    const secrets = await loadSecrets(admin, provider, gateway.mode);
    const keysReady = provider === 'stripe'
      ? !!secrets.secret_key
      : provider === 'paypal'
        ? !!(secrets.client_id && secrets.client_secret)
        : !!(secrets.store_id && secrets.store_password);
    if (!keysReady) return json(400, { error: `${provider} ${gateway.mode} keys are not configured` });

    const origin = safeOrigin(req.headers.get('Origin')) ?? safeOrigin(body.origin ?? null);
    if (!origin) return json(400, { error: 'Missing or invalid Origin' });

    const amount = Number(tier.amount);
    const currency = config.currencyCode;

    const { data: payment, error: insertErr } = await admin
      .from('payments')
      .insert({
        organization_id: profile.organization_id,
        provider,
        mode: gateway.mode,
        tier: tierId,
        amount,
        currency,
        return_origin: origin,
        created_by: caller.id,
      })
      .select('*')
      .single();
    if (insertErr || !payment) throw new Error(insertErr?.message || 'Could not create payment');

    const returnBase = `${supabaseUrl}/functions/v1/payment-return?pid=${payment.id}`;
    const description = `StaffCove plan — ${tier.duration || tierId}`;
    let providerRef: string;
    let url: string;

    if (provider === 'stripe') {
      const session = await stripeApi(secrets.secret_key, 'POST', '/checkout/sessions', {
        mode: 'payment',
        client_reference_id: payment.id,
        success_url: `${returnBase}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnBase}&cancelled=1`,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(stripeMinorUnits(amount, currency)),
        'line_items[0][price_data][product_data][name]': description,
        'metadata[payment_id]': payment.id,
        'metadata[organization_id]': profile.organization_id,
        ...(caller.email ? { customer_email: caller.email } : {}),
      });
      providerRef = session.id;
      url = session.url;
    } else if (provider === 'sslcommerz') {
      providerRef = sslcommerzTranId(payment.id);
      // SSLCommerz posts the payer back to these URLs; IPN is its server-to-server backup.
      const session = await sslcommerzInit(secrets, gateway.mode, {
        total_amount: amount.toFixed(2),
        currency,
        tran_id: providerRef,
        success_url: returnBase,
        fail_url: `${returnBase}&failed=1`,
        cancel_url: `${returnBase}&cancelled=1`,
        ipn_url: `${returnBase}&ipn=1`,
        product_name: description,
        product_category: 'Software',
        product_profile: 'non-physical-goods',
        shipping_method: 'NO',
        num_of_item: '1',
        cus_name: profile.name || caller.email || 'Customer',
        cus_email: caller.email || 'customer@example.com',
        cus_phone: profile.mobile || 'N/A',
        cus_add1: 'N/A',
        cus_city: 'N/A',
        cus_country: 'Bangladesh',
        value_a: payment.id,
      });
      url = session.GatewayPageURL;
    } else {
      const token = await paypalToken(secrets, gateway.mode);
      const order = await paypalApi(token, gateway.mode, 'POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: payment.id,
          description,
          amount: { currency_code: currency, value: paypalAmount(amount, currency) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'StaffCove',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
              return_url: returnBase,
              cancel_url: `${returnBase}&cancelled=1`,
            },
          },
        },
      }, `order-${payment.id}`);
      providerRef = order.id;
      url = order.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
    }

    if (!url) throw new Error('Gateway did not return a payment page');
    await admin.from('payments').update({ provider_ref: providerRef }).eq('id', payment.id);

    return json(200, { url, paymentId: payment.id });
  } catch (e: any) {
    console.error('[payment-checkout]', e?.message || e);
    return json(500, { error: e?.message || 'Payment failed to start' });
  }
});
