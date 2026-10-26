// StaffCove — Office Wi-Fi Check-in: pure decision logic
//
// No Deno or Supabase imports, so it runs unchanged in the edge functions and in vitest
// (src/test/officeNetwork.test.ts). DB access lives in officeWifi.ts.
//
// Decision, in order:
//   1. Feature off                                   → allow, 'not_checked'
//   2. Role or duty type exempt                      → allow, 'exempt'
//   3. No office location and no fresh office IP     → allow, 'not_checked' (nothing to check
//      against; the settings UI refuses to enable the feature in this state)
//   4. Request IP is a fresh (non-expired) office IP → allow, 'office_wifi', refresh last_seen
//   5. GPS inside an office geofence                 → allow, 'learned', remember this IP
//   6. Otherwise                                     → reject OFFICE_WIFI_REQUIRED

export type NetworkCheck = 'office_wifi' | 'learned' | 'exempt' | 'not_checked';

export type DecisionReason =
  | 'feature_off'
  | 'exempt'
  | 'not_configured'
  | 'office_wifi'
  | 'inside_geofence'
  | 'office_wifi_required';

export interface OfficeWifiSettings {
  enabled: boolean;
  ipExpiryHours: number;
  exemptDutyTypes: string[];
  exemptRoles: string[];
}

export interface OfficeLocationLike {
  lat: number;
  lng: number;
  radius: number; // metres
}

export interface KnownNetwork {
  ip: string;
  lastSeen: string; // ISO timestamp
}

export interface DecisionInput {
  settings: OfficeWifiSettings;
  role: string;
  dutyType: string | null | undefined;
  clientIp: string | null;
  knownNetworks: KnownNetwork[];
  gps: { lat: number; lng: number } | null;
  officeLocations: OfficeLocationLike[];
  now: Date;
}

export type Decision =
  | { allowed: true; networkCheck: NetworkCheck; reason: DecisionReason; networkKey: string | null; learn: boolean; touch: boolean }
  | { allowed: false; reason: 'office_wifi_required'; networkKey: string | null };

export const DEFAULT_IP_EXPIRY_HOURS = 24;
export const OFFICE_WIFI_REQUIRED_MESSAGE = 'Please connect to the office Wi-Fi to check in.';

export function parseOfficeWifiSettings(raw: unknown): OfficeWifiSettings {
  let value: any = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = {};
    }
  }
  const hours = Number(value?.ipExpiryHours);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    enabled: value?.enabled === true,
    ipExpiryHours: Number.isFinite(hours) && hours >= 1 ? Math.min(Math.floor(hours), 720) : DEFAULT_IP_EXPIRY_HOURS,
    exemptDutyTypes: list(value?.exemptDutyTypes),
    exemptRoles: list(value?.exemptRoles),
  };
}

/**
 * The caller's public IP as seen by the Supabase edge gateway. The first x-forwarded-for entry is
 * the original client; later entries are proxies. Never read from the request body.
 */
export function getClientIp(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return headers.get('cf-connecting-ip')?.trim() || headers.get('x-real-ip')?.trim() || null;
}

function expandIPv6(ip: string): string[] | null {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.length !== 8 || !groups.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.map(g => g.toLowerCase().replace(/^0+(?=.)/, ''));
}

/**
 * Key an IP is stored and matched under. IPv4: the address itself. IPv6: its /64 prefix, because
 * every phone on the same office network gets its own IPv6 address inside a shared /64.
 */
export function normalizeNetworkKey(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let value = ip.trim().replace(/^\[|\]$/g, '').split('%')[0];
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) value = mapped[1];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every(o => Number(o) <= 255) ? value : null;
  }
  const groups = expandIPv6(value);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : null;
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isInsideAnyOffice(gps: { lat: number; lng: number } | null, offices: OfficeLocationLike[]): boolean {
  if (!gps || !Number.isFinite(gps.lat) || !Number.isFinite(gps.lng)) return false;
  // 0,0 is what the app stores when no location was captured.
  if (gps.lat === 0 && gps.lng === 0) return false;
  return offices.some(o => Number(o.radius) > 0 && distanceMeters(gps, o) <= Number(o.radius));
}

export function isNetworkFresh(network: KnownNetwork, expiryHours: number, now: Date): boolean {
  const seen = new Date(network.lastSeen).getTime();
  return Number.isFinite(seen) && now.getTime() - seen <= expiryHours * 3600 * 1000;
}

export function decideOfficeNetwork(input: DecisionInput): Decision {
  const { settings, now } = input;
  const networkKey = normalizeNetworkKey(input.clientIp);

  if (!settings.enabled) {
    return { allowed: true, networkCheck: 'not_checked', reason: 'feature_off', networkKey, learn: false, touch: false };
  }

  if (settings.exemptRoles.includes(input.role) || (input.dutyType && settings.exemptDutyTypes.includes(input.dutyType))) {
    return { allowed: true, networkCheck: 'exempt', reason: 'exempt', networkKey, learn: false, touch: false };
  }

  const fresh = input.knownNetworks.filter(n => isNetworkFresh(n, settings.ipExpiryHours, now));
  const validOffices = input.officeLocations.filter(o => Number.isFinite(o.lat) && Number.isFinite(o.lng) && Number(o.radius) > 0);

  if (validOffices.length === 0 && fresh.length === 0) {
    return { allowed: true, networkCheck: 'not_checked', reason: 'not_configured', networkKey, learn: false, touch: false };
  }

  if (networkKey && fresh.some(n => n.ip === networkKey)) {
    return { allowed: true, networkCheck: 'office_wifi', reason: 'office_wifi', networkKey, learn: false, touch: true };
  }

  if (isInsideAnyOffice(input.gps, validOffices)) {
    return { allowed: true, networkCheck: 'learned', reason: 'inside_geofence', networkKey, learn: networkKey !== null, touch: false };
  }

  return { allowed: false, reason: 'office_wifi_required', networkKey };
}
