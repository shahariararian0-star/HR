// StaffCove — Passkey (fingerprint) Edge Function. Migration 0048.
// Deployed with --no-verify-jwt: sign-in actions run before the user has a session. Every other
// action checks the caller's token itself.
//
// POST { action: 'status' }                                   (signed in)
//   → { registered: number, checkinRequired: boolean }
// POST { action: 'register-options' }                         (signed in)
//   → { challengeId, options }
// POST { action: 'register-verify', challengeId, response, deviceLabel? }   (signed in)
//   → { ok: true }
// POST { action: 'punch-options' }                            (signed in)
//   → { challengeId, options }   — proof is then sent to attendance-punch
// POST { action: 'login-options' }                            (no session)
//   → { challengeId, options }
// POST { action: 'login-verify', challengeId, response }      (no session)
//   → { access_token, refresh_token, expires_in }
//
// Errors: { error: <CODE>, message } with 4xx.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  PasskeyError,
  registrationOptions,
  registrationVerify,
  authenticationOptions,
  authenticationVerify,
  biometricCheckinEnabled,
} from '../_shared/passkey.ts';

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

const LOGIN_FAILED = 'Fingerprint sign-in failed. Please sign in with your password.';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  const action = body?.action;

  try {
    // ── Sign-in (no session yet) ────────────────────────────────────────────
    if (action === 'login-options') {
      return json(200, await authenticationOptions(admin, req, 'login', null));
    }

    if (action === 'login-verify') {
      let userId: string;
      try {
        userId = await authenticationVerify(admin, req, 'login', body, null);
      } catch (e) {
        if (e instanceof PasskeyError) return json(401, { error: e.code, message: e.message });
        throw e;
      }

      // Same account checks as the password sign-in (src/services/auth.service.ts).
      const { data: profile } = await admin
        .from('profiles')
        .select('email, verified, status')
        .eq('id', userId)
        .maybeSingle();
      if (!profile) return json(401, { error: 'NO_PROFILE', message: 'Account profile not found. Contact support.' });
      if (!profile.verified) return json(403, { error: 'NOT_VERIFIED_ACCOUNT', message: 'Account not verified. Please check your email.' });
      if (profile.status === 'INACTIVE') {
        return json(403, { error: 'INACTIVE', message: 'Your account has been deactivated. Please contact your administrator.' });
      }

      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const email = authUser?.user?.email || profile.email;
      if (!email) return json(401, { error: 'NO_EMAIL', message: LOGIN_FAILED });

      // Mint a normal Supabase session: a one-time magic-link token, exchanged here on the
      // server. Nothing is emailed.
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      const tokenHash = link?.properties?.hashed_token;
      if (linkErr || !tokenHash) throw new Error(linkErr?.message || 'Could not create session');

      const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { data: otp, error: otpErr } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (otpErr || !otp?.session) throw new Error(otpErr?.message || 'Could not create session');

      return json(200, {
        access_token: otp.session.access_token,
        refresh_token: otp.session.refresh_token,
        expires_in: otp.session.expires_in,
      });
    }

    // ── Signed-in actions ───────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing Authorization header' });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !caller) return json(401, { error: 'Invalid token' });

    const { data: profile } = await admin
      .from('profiles')
      .select('name, email, organization_id')
      .eq('id', caller.id)
      .maybeSingle();
    if (!profile) return json(403, { error: 'Profile not found' });

    if (action === 'status') {
      const { count } = await admin
        .from('passkey_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', caller.id);
      return json(200, {
        registered: count ?? 0,
        checkinRequired: await biometricCheckinEnabled(admin, profile.organization_id),
      });
    }

    if (action === 'register-options') {
      return json(200, await registrationOptions(admin, req, {
        id: caller.id,
        email: caller.email || profile.email || '',
        name: profile.name || '',
      }));
    }

    if (action === 'register-verify') {
      await registrationVerify(admin, req, { id: caller.id, organizationId: profile.organization_id }, body);
      return json(200, { ok: true });
    }

    if (action === 'punch-options') {
      return json(200, await authenticationOptions(admin, req, 'punch', caller.id));
    }

    return json(400, { error: 'Unknown action' });
  } catch (e: any) {
    if (e instanceof PasskeyError) return json(400, { error: e.code, message: e.message });
    console.error('[passkey]', action, e?.message || e);
    return json(500, { error: 'PASSKEY_FAILED', message: action?.startsWith('login') ? LOGIN_FAILED : 'Fingerprint request failed. Please try again.' });
  }
});
