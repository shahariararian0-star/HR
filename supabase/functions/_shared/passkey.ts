// Shared WebAuthn (passkey / fingerprint) helpers for the `passkey` and `attendance-punch`
// edge functions. Migration 0048 holds the tables.
//
// A passkey is bound to a website address (the "relying party ID"). The allowed addresses come
// from the PASSKEY_ORIGINS secret (comma-separated full origins, e.g.
// "https://hr.example.com,https://hr-drab-omega.vercel.app"), falling back to APP_URL. The
// relying party ID is the hostname of whichever allowed origin the request came from, so a key
// registered on one address only works there.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@13.2.2';
import { isoBase64URL } from 'npm:@simplewebauthn/server@13.2.2/helpers';

export const RP_NAME = 'StaffCove';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type ChallengePurpose = 'register' | 'login' | 'punch';

export interface PasskeyProof {
  challengeId: string;
  response: any; // AuthenticationResponseJSON from the browser
}

export class PasskeyError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function allowedOrigins(): string[] {
  const raw = Deno.env.get('PASSKEY_ORIGINS') || Deno.env.get('APP_URL') || '';
  return raw
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** The origin and relying party ID for this request, or an error if the address is not allowed. */
export function relyingParty(req: Request): { origin: string; rpID: string } {
  const origin = (req.headers.get('Origin') || '').replace(/\/+$/, '');
  const allowed = allowedOrigins();
  if (!origin || !allowed.includes(origin)) {
    throw new PasskeyError(
      'ORIGIN_NOT_ALLOWED',
      'Fingerprint sign-in is not set up for this website address yet. Ask your administrator.',
    );
  }
  return { origin, rpID: new URL(origin).hostname };
}

async function saveChallenge(admin: SupabaseClient, purpose: ChallengePurpose, challenge: string, userId: string | null): Promise<string> {
  // Housekeeping: drop expired challenges so the table stays small.
  await admin.from('passkey_challenges').delete().lt('expires_at', new Date().toISOString());
  const { data, error } = await admin
    .from('passkey_challenges')
    .insert({
      purpose,
      challenge,
      user_id: userId,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Could not save challenge');
  return data.id;
}

/** Read and delete a challenge. Each challenge can be used once. */
async function takeChallenge(admin: SupabaseClient, id: string, purpose: ChallengePurpose, userId: string | null): Promise<string> {
  if (typeof id !== 'string' || !id) throw new PasskeyError('CHALLENGE_INVALID', 'The fingerprint request expired. Please try again.');
  const { data } = await admin
    .from('passkey_challenges')
    .delete()
    .eq('id', id)
    .select('challenge, purpose, user_id, expires_at')
    .maybeSingle();
  if (
    !data ||
    data.purpose !== purpose ||
    (userId !== null && data.user_id !== userId) ||
    new Date(data.expires_at).getTime() < Date.now()
  ) {
    throw new PasskeyError('CHALLENGE_INVALID', 'The fingerprint request expired. Please try again.');
  }
  return data.challenge;
}

async function credentialsOf(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('passkey_credentials')
    .select('credential_id, transports')
    .eq('user_id', userId);
  return (data ?? []).map((c: any) => ({ id: c.credential_id as string, transports: (c.transports ?? []) as any[] }));
}

// ── Registration ────────────────────────────────────────────────────────────

export async function registrationOptions(
  admin: SupabaseClient,
  req: Request,
  user: { id: string; email: string; name: string },
) {
  const { rpID } = relyingParty(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email || user.id,
    userDisplayName: user.name || user.email || 'StaffCove user',
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: await credentialsOf(admin, user.id),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required',
    },
  });
  const challengeId = await saveChallenge(admin, 'register', options.challenge, user.id);
  return { challengeId, options };
}

export async function registrationVerify(
  admin: SupabaseClient,
  req: Request,
  user: { id: string; organizationId: string | null },
  body: { challengeId: string; response: any; deviceLabel?: string },
) {
  const { origin, rpID } = relyingParty(req);
  const expectedChallenge = await takeChallenge(admin, body.challengeId, 'register', user.id);
  const result = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) {
    throw new PasskeyError('NOT_VERIFIED', 'Your fingerprint could not be registered. Please try again.');
  }
  const { credential } = result.registrationInfo;
  const label = typeof body.deviceLabel === 'string' ? body.deviceLabel.slice(0, 80) : '';
  const { error } = await admin.from('passkey_credentials').insert({
    user_id: user.id,
    organization_id: user.organizationId,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    device_label: label,
  });
  if (error) {
    if (String(error.message).includes('duplicate')) {
      throw new PasskeyError('ALREADY_REGISTERED', 'This device is already registered.');
    }
    throw new Error(error.message);
  }
}

// ── Authentication (sign-in and punch) ──────────────────────────────────────

export async function authenticationOptions(
  admin: SupabaseClient,
  req: Request,
  purpose: 'login' | 'punch',
  userId: string | null,
) {
  const { rpID } = relyingParty(req);
  // Sign-in uses discoverable credentials: the phone offers the keys it holds for this site.
  // A punch is limited to the signed-in employee's own keys.
  const allowCredentials = userId ? await credentialsOf(admin, userId) : undefined;
  if (userId && (!allowCredentials || allowCredentials.length === 0)) {
    throw new PasskeyError('NO_CREDENTIAL', 'Register your fingerprint first, from the prompt or My Profile.');
  }
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
  });
  const challengeId = await saveChallenge(admin, purpose, options.challenge, userId);
  return { challengeId, options };
}

/**
 * Verify a fingerprint proof. For a punch, pass the signed-in user's id: the key must be theirs.
 * Returns the id of the user the key belongs to.
 */
export async function authenticationVerify(
  admin: SupabaseClient,
  req: Request,
  purpose: 'login' | 'punch',
  proof: PasskeyProof,
  userId: string | null,
): Promise<string> {
  const { origin, rpID } = relyingParty(req);
  const expectedChallenge = await takeChallenge(admin, proof?.challengeId, purpose, userId);
  const credentialId = proof?.response?.id;
  if (typeof credentialId !== 'string') throw new PasskeyError('NOT_VERIFIED', 'Fingerprint check failed.');

  const { data: cred } = await admin
    .from('passkey_credentials')
    .select('id, user_id, credential_id, public_key, counter, transports')
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (!cred || (userId && cred.user_id !== userId)) {
    throw new PasskeyError('UNKNOWN_CREDENTIAL', 'This fingerprint is not registered for your account on this device.');
  }

  const result = await verifyAuthenticationResponse({
    response: proof.response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: cred.credential_id,
      publicKey: isoBase64URL.toBuffer(cred.public_key),
      counter: Number(cred.counter) || 0,
      transports: cred.transports ?? [],
    },
    requireUserVerification: true,
  });
  if (!result.verified) throw new PasskeyError('NOT_VERIFIED', 'Fingerprint check failed.');

  await admin
    .from('passkey_credentials')
    .update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', cred.id);
  return cred.user_id;
}

/** Is Fingerprint check-in on for this organization? Mirrors public.biometric_checkin_enabled. */
export async function biometricCheckinEnabled(admin: SupabaseClient, orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  const { data } = await admin
    .from('settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', 'biometric_checkin')
    .maybeSingle();
  if (!data?.value) return false;
  try {
    const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return v?.enabled === true;
  } catch {
    return false;
  }
}
