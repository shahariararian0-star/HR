// StaffCove — Payment Return Edge Function
// Public (deploy with --no-verify-jwt): Stripe, PayPal and SSLCommerz send the payer's browser here.
//
// GET or POST ?pid=<payment id>[&cancelled=1 | &failed=1 | &ipn=1]
//   Confirms the payment with the gateway itself (capturing an approved PayPal order), activates
//   the organization, then redirects to the app's Upgrade page with ?payment=<result>.
//   SSLCommerz POSTs the payer back (form body ignored), and calls ipn=1 server-to-server,
//   which gets a plain 200 instead of a redirect.
//   Nothing in the query string is trusted beyond the payment id; a stranger calling this can
//   at most trigger a check of a payment the gateway already says is complete.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndActivate, PaymentRow } from '../_shared/payments.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function redirect(origin: string, result: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/?payment=${result}#/upgrade` },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pid = url.searchParams.get('pid') ?? '';
  if (!UUID_RE.test(pid)) return new Response('Invalid payment link', { status: 400 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: payment } = await admin.from('payments').select('*').eq('id', pid).maybeSingle();
  if (!payment) return new Response('Payment not found', { status: 404 });

  const origin = (payment as PaymentRow).return_origin;

  if (url.searchParams.get('ipn') === '1') {
    try {
      const status = await verifyAndActivate(admin, payment as PaymentRow);
      return new Response(status, { status: 200 });
    } catch (e: any) {
      console.error('[payment-return] IPN', e?.message || e);
      return new Response('verification failed', { status: 500 });
    }
  }

  if (url.searchParams.get('cancelled') === '1') {
    await admin.from('payments').update({ status: 'CANCELLED' }).eq('id', pid).eq('status', 'PENDING');
    return redirect(origin, 'cancelled');
  }

  try {
    const status = await verifyAndActivate(admin, payment as PaymentRow);
    if (url.searchParams.get('failed') === '1' && status === 'PENDING') {
      await admin.from('payments').update({ status: 'FAILED' }).eq('id', pid).eq('status', 'PENDING');
      return redirect(origin, 'failed');
    }
    const result = status === 'PAID' ? 'success' : status === 'PENDING' ? 'pending' : 'failed';
    return redirect(origin, result);
  } catch (e: any) {
    console.error('[payment-return]', e?.message || e);
    return redirect(origin, 'pending');
  }
});
