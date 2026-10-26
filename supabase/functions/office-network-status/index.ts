// StaffCove — Office Network Status Edge Function (Office Wi-Fi Check-in)
// Requires a signed-in caller (JWT verified by the gateway). Read-only: saves nothing.
//
// POST { gps?: { lat, lng }, dutyType?: 'OFFICE' | 'FACTORY' }
//   → { enabled, allowed, reason }
// The attendance screen calls this to enable or disable the Clock In / Out button. GPS is
// optional but needed for the very first check-in, before any office IP has been learned.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateOfficeNetwork, parseGps } from '../_shared/officeWifi.ts';

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
    .select('role, organization_id')
    .eq('id', caller.id)
    .single();
  if (!profile?.organization_id) return json(403, { error: 'Profile or organization not found' });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine.
  }

  try {
    const { decision } = await evaluateOfficeNetwork(admin, req, {
      orgId: profile.organization_id,
      role: profile.role,
      dutyType: typeof body.dutyType === 'string' ? body.dutyType : null,
      gps: parseGps(body.gps),
    });
    return json(200, {
      enabled: decision.reason !== 'feature_off',
      allowed: decision.allowed,
      reason: decision.reason,
    });
  } catch (e: any) {
    console.error('[office-network-status]', e?.message || e);
    return json(500, { error: e?.message || 'Status check failed' });
  }
});
