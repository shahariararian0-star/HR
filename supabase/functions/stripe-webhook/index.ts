// StaffCove — Stripe Webhook Edge Function
// Public (deploy with --no-verify-jwt); authenticated by the Stripe-Signature header instead.
//
// Backup path for when the payer pays but never comes back through payment-return (closed
// tab, lost connection). Listens for checkout.session.completed and
// checkout.session.async_payment_succeeded, then runs the same verifyAndActivate() check,
// which re-reads the session from Stripe rather than trusting the event body.
//
// Signature is checked against the webhook_secret of both test and live keys, whichever exist.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadSecrets, verifyAndActivate, PaymentRow } from '../_shared/payments.ts';

const TOLERANCE_SECONDS = 300;
const HANDLED_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signatureValid(header: string, rawBody: string, secrets: string[]): Promise<boolean> {
  const parts = header.split(',').map(p => p.split('=') as [string, string]);
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  for (const secret of secrets) {
    const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
    if (signatures.some(s => timingSafeEqual(s, expected))) return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const rawBody = await req.text();
  const header = req.headers.get('Stripe-Signature') ?? '';

  const webhookSecrets: string[] = [];
  for (const mode of ['test', 'live'] as const) {
    try {
      const secrets = await loadSecrets(admin, 'stripe', mode);
      if (secrets.webhook_secret) webhookSecrets.push(secrets.webhook_secret);
    } catch {
      // No keys for this mode.
    }
  }
  if (webhookSecrets.length === 0 || !(await signatureValid(header, rawBody, webhookSecrets))) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!HANDLED_EVENTS.has(event.type)) return new Response('ignored', { status: 200 });

  const paymentId = event.data?.object?.client_reference_id;
  if (!paymentId) return new Response('no payment reference', { status: 200 });

  const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment) return new Response('unknown payment', { status: 200 });

  try {
    const status = await verifyAndActivate(admin, payment as PaymentRow);
    return new Response(status, { status: 200 });
  } catch (e: any) {
    console.error('[stripe-webhook]', e?.message || e);
    // Non-2xx makes Stripe retry later.
    return new Response('verification failed', { status: 500 });
  }
});
