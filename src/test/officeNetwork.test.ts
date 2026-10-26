import { describe, it, expect } from 'vitest';
import {
  decideOfficeNetwork,
  normalizeNetworkKey,
  getClientIp,
  parseOfficeWifiSettings,
  DecisionInput,
} from '../../supabase/functions/_shared/officeNetwork';

/**
 * Office Wi-Fi Check-in — decision logic shared by the attendance-punch and
 * office-network-status edge functions.
 */

const NOW = new Date('2026-10-24T09:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();

// Office in Dhaka with a 200 m geofence.
const OFFICE = { lat: 23.8103, lng: 90.4125, radius: 200 };
const INSIDE = { lat: 23.8106, lng: 90.4127 };   // ~40 m away
const OUTSIDE = { lat: 23.83, lng: 90.43 };      // ~2.8 km away

const base = (overrides: Partial<DecisionInput> = {}): DecisionInput => ({
  settings: { enabled: true, ipExpiryHours: 24, exemptDutyTypes: [], exemptRoles: [] },
  role: 'EMPLOYEE',
  dutyType: 'OFFICE',
  clientIp: '103.10.20.30',
  knownNetworks: [],
  gps: null,
  officeLocations: [OFFICE],
  now: NOW,
  ...overrides,
});

describe('decideOfficeNetwork', () => {
  it('feature off → allowed, not checked, nothing learned', () => {
    const d = decideOfficeNetwork(base({ settings: { enabled: false, ipExpiryHours: 24, exemptDutyTypes: [], exemptRoles: [] }, gps: OUTSIDE }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'not_checked', reason: 'feature_off', learn: false });
  });

  it('known, fresh office IP → allowed as office Wi-Fi and refreshes last_seen', () => {
    const d = decideOfficeNetwork(base({ knownNetworks: [{ ip: '103.10.20.30', lastSeen: hoursAgo(2) }] }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'office_wifi', touch: true, learn: false });
  });

  it('expired office IP with GPS outside → rejected', () => {
    const d = decideOfficeNetwork(base({ knownNetworks: [{ ip: '103.10.20.30', lastSeen: hoursAgo(25) }], gps: OUTSIDE }));
    expect(d).toMatchObject({ allowed: false, reason: 'office_wifi_required' });
  });

  it('expired office IP with GPS inside → re-learned', () => {
    const d = decideOfficeNetwork(base({ knownNetworks: [{ ip: '103.10.20.30', lastSeen: hoursAgo(25) }], gps: INSIDE }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'learned', learn: true, networkKey: '103.10.20.30' });
  });

  it('respects a custom expiry', () => {
    const settings = { enabled: true, ipExpiryHours: 48, exemptDutyTypes: [], exemptRoles: [] };
    const d = decideOfficeNetwork(base({ settings, knownNetworks: [{ ip: '103.10.20.30', lastSeen: hoursAgo(30) }] }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'office_wifi' });
  });

  it('unknown IP + GPS inside the geofence → allowed and learns the IP', () => {
    const d = decideOfficeNetwork(base({ gps: INSIDE }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'learned', reason: 'inside_geofence', learn: true, networkKey: '103.10.20.30' });
  });

  it('unknown IP + GPS outside the geofence → rejected', () => {
    const d = decideOfficeNetwork(base({ gps: OUTSIDE, knownNetworks: [{ ip: '1.2.3.4', lastSeen: hoursAgo(1) }] }));
    expect(d).toMatchObject({ allowed: false, reason: 'office_wifi_required' });
  });

  it('unknown IP + GPS missing → rejected', () => {
    expect(decideOfficeNetwork(base({ gps: null }))).toMatchObject({ allowed: false });
  });

  it('GPS of 0,0 (no location captured) is not treated as inside', () => {
    const d = decideOfficeNetwork(base({ gps: { lat: 0, lng: 0 }, officeLocations: [{ lat: 0, lng: 0, radius: 500 }] }));
    expect(d).toMatchObject({ allowed: false });
  });

  it('exempt duty type → allowed as exempt even far from the office', () => {
    const settings = { enabled: true, ipExpiryHours: 24, exemptDutyTypes: ['FACTORY'], exemptRoles: [] };
    const d = decideOfficeNetwork(base({ settings, dutyType: 'FACTORY', gps: OUTSIDE }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'exempt', learn: false });
  });

  it('exempt role → allowed as exempt', () => {
    const settings = { enabled: true, ipExpiryHours: 24, exemptDutyTypes: [], exemptRoles: ['MANAGER'] };
    const d = decideOfficeNetwork(base({ settings, role: 'MANAGER', gps: null }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'exempt' });
  });

  it('non-exempt duty type is still checked', () => {
    const settings = { enabled: true, ipExpiryHours: 24, exemptDutyTypes: ['FACTORY'], exemptRoles: [] };
    expect(decideOfficeNetwork(base({ settings, dutyType: 'OFFICE', gps: OUTSIDE }))).toMatchObject({ allowed: false });
  });

  it('no office location and no learned IP → allowed, not checked (cannot lock everyone out)', () => {
    const d = decideOfficeNetwork(base({ officeLocations: [], gps: OUTSIDE }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'not_checked', reason: 'not_configured' });
  });

  it('missing client IP + GPS inside → allowed but nothing to learn', () => {
    const d = decideOfficeNetwork(base({ clientIp: null, gps: INSIDE }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'learned', learn: false, networkKey: null });
  });

  it('IPv6 phones on the same /64 match the learned prefix', () => {
    const learned = normalizeNetworkKey('2001:db8:abcd:12:1111:2222:3333:4444')!;
    const d = decideOfficeNetwork(base({ clientIp: '2001:db8:abcd:12::9', knownNetworks: [{ ip: learned, lastSeen: hoursAgo(1) }] }));
    expect(d).toMatchObject({ allowed: true, networkCheck: 'office_wifi' });
  });
});

describe('normalizeNetworkKey', () => {
  it('keeps IPv4 as is and unwraps IPv4-mapped IPv6', () => {
    expect(normalizeNetworkKey(' 103.10.20.30 ')).toBe('103.10.20.30');
    expect(normalizeNetworkKey('::ffff:103.10.20.30')).toBe('103.10.20.30');
  });

  it('reduces IPv6 to its /64 prefix', () => {
    expect(normalizeNetworkKey('2001:0db8:0000:0012::1')).toBe('2001:db8:0:12::/64');
  });

  it('rejects garbage', () => {
    expect(normalizeNetworkKey('not-an-ip')).toBeNull();
    expect(normalizeNetworkKey('999.1.1.1')).toBeNull();
    expect(normalizeNetworkKey(null)).toBeNull();
  });
});

describe('getClientIp', () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

  it('takes the first x-forwarded-for entry', () => {
    expect(getClientIp(headers({ 'x-forwarded-for': '103.10.20.30, 10.0.0.1, 172.16.0.1' }))).toBe('103.10.20.30');
  });

  it('falls back to cf-connecting-ip, then x-real-ip', () => {
    expect(getClientIp(headers({ 'cf-connecting-ip': '1.1.1.1' }))).toBe('1.1.1.1');
    expect(getClientIp(headers({ 'x-real-ip': '2.2.2.2' }))).toBe('2.2.2.2');
    expect(getClientIp(headers({}))).toBeNull();
  });
});

describe('parseOfficeWifiSettings', () => {
  it('defaults to off with 24 h expiry', () => {
    expect(parseOfficeWifiSettings(null)).toEqual({ enabled: false, ipExpiryHours: 24, exemptDutyTypes: [], exemptRoles: [] });
  });

  it('reads a stored JSON string', () => {
    const s = parseOfficeWifiSettings('{"enabled":true,"ipExpiryHours":12,"exemptDutyTypes":["FACTORY"],"exemptRoles":["MANAGER"]}');
    expect(s).toEqual({ enabled: true, ipExpiryHours: 12, exemptDutyTypes: ['FACTORY'], exemptRoles: ['MANAGER'] });
  });
});
