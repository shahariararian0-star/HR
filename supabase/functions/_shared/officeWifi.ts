// StaffCove — Office Wi-Fi Check-in: database side
//
// Loads what decideOfficeNetwork() needs for one organization and records learned / seen office
// IPs. Used by attendance-punch (records) and office-network-status (read-only).
// All queries use the service-role client passed in.

// deno-lint-ignore-file no-explicit-any
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  decideOfficeNetwork, getClientIp, parseOfficeWifiSettings, Decision, OfficeLocationLike,
} from './officeNetwork.ts';

async function readSetting(admin: SupabaseClient, orgId: string, key: string): Promise<unknown> {
  const { data } = await admin
    .from('settings')
    .select('value')
    .eq('organization_id', orgId)
    .eq('key', key)
    .maybeSingle();
  if (data?.value != null) return data.value;
  // Same cascade as the app's getSetting(): fall back to the platform-level row.
  const { data: platform } = await admin
    .from('settings')
    .select('value')
    .is('organization_id', null)
    .eq('key', key)
    .maybeSingle();
  return platform?.value ?? null;
}

async function loadOfficeLocations(admin: SupabaseClient, orgId: string): Promise<OfficeLocationLike[]> {
  let config: any = await readSetting(admin, orgId, 'app_config');
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = null;
    }
  }
  const locations = Array.isArray(config?.officeLocations) ? config.officeLocations : [];
  return locations.map((l: any) => ({ lat: Number(l.lat), lng: Number(l.lng), radius: Number(l.radius) }));
}

export interface OfficeWifiEvaluation {
  decision: Decision;
  clientIp: string | null;
}

export async function evaluateOfficeNetwork(
  admin: SupabaseClient,
  req: Request,
  ctx: { orgId: string; role: string; dutyType: string | null | undefined; gps: { lat: number; lng: number } | null },
): Promise<OfficeWifiEvaluation> {
  const clientIp = getClientIp(req.headers);
  const settings = parseOfficeWifiSettings(await readSetting(admin, ctx.orgId, 'office_wifi_checkin'));

  if (!settings.enabled) {
    return { decision: decideOfficeNetwork({ settings, role: ctx.role, dutyType: ctx.dutyType, clientIp, knownNetworks: [], gps: null, officeLocations: [], now: new Date() }), clientIp };
  }

  const [officeLocations, { data: networks }] = await Promise.all([
    loadOfficeLocations(admin, ctx.orgId),
    admin.from('office_networks').select('ip, last_seen').eq('organization_id', ctx.orgId),
  ]);

  const decision = decideOfficeNetwork({
    settings,
    role: ctx.role,
    dutyType: ctx.dutyType,
    clientIp,
    knownNetworks: (networks ?? []).map((n: any) => ({ ip: n.ip, lastSeen: n.last_seen })),
    gps: ctx.gps,
    officeLocations,
    now: new Date(),
  });
  return { decision, clientIp };
}

/** Remember a newly learned office IP, or refresh last_seen on a known one. */
export async function recordOfficeNetwork(admin: SupabaseClient, orgId: string, decision: Decision, employeeId: string): Promise<void> {
  if (!decision.allowed || !decision.networkKey) return;
  const now = new Date().toISOString();
  if (decision.learn) {
    const { error } = await admin
      .from('office_networks')
      .upsert(
        { organization_id: orgId, ip: decision.networkKey, last_seen: now, learned_from_employee_id: employeeId },
        { onConflict: 'organization_id,ip' },
      );
    if (error) console.error('[officeWifi] Could not save learned office IP:', error.message);
  } else if (decision.touch) {
    await admin
      .from('office_networks')
      .update({ last_seen: now })
      .eq('organization_id', orgId)
      .eq('ip', decision.networkKey);
  }
}

export function parseGps(value: any): { lat: number; lng: number } | null {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
