import { supabase, isSupabaseConfigured } from './supabase';
import { organizationService } from './organization.service';
import { apiClient } from './api.client';

// Office Wi-Fi Check-in (migration 0043). Settings are an org-scoped settings row
// ('office_wifi_checkin') that only ADMIN / HR can write. While enabled, clock in / out
// go through the attendance-punch edge function, which checks the request's real IP.

export interface OfficeWifiSettings {
  enabled: boolean;
  ipExpiryHours: number;
  exemptDutyTypes: string[];
  exemptRoles: string[];
}

export interface OfficeNetwork {
  id: string;
  ip: string;
  firstSeen: string;
  lastSeen: string;
}

export interface OfficeNetworkStatus {
  enabled: boolean;
  allowed: boolean;
  reason: string;
}

export const OFFICE_WIFI_SETTINGS_KEY = 'office_wifi_checkin';
export const OFFICE_WIFI_REQUIRED_MESSAGE = 'Please connect to the office Wi-Fi to check in.';

export const DEFAULT_OFFICE_WIFI_SETTINGS: OfficeWifiSettings = {
  enabled: false,
  ipExpiryHours: 24,
  exemptDutyTypes: [],
  exemptRoles: [],
};

/** Thrown when the server refuses a punch because the phone is not on the office Wi-Fi. */
export class OfficeWifiRequiredError extends Error {
  code = 'OFFICE_WIFI_REQUIRED' as const;
  constructor() {
    super(OFFICE_WIFI_REQUIRED_MESSAGE);
    this.name = 'OfficeWifiRequiredError';
  }
}

export function isOfficeWifiRequiredError(err: any): boolean {
  return err?.code === 'OFFICE_WIFI_REQUIRED' || String(err?.message || '').includes('OFFICE_WIFI_REQUIRED');
}

function normalize(raw: any): OfficeWifiSettings {
  const hours = Number(raw?.ipExpiryHours);
  return {
    enabled: raw?.enabled === true,
    ipExpiryHours: Number.isFinite(hours) && hours >= 1 ? Math.min(Math.floor(hours), 720) : 24,
    exemptDutyTypes: Array.isArray(raw?.exemptDutyTypes) ? raw.exemptDutyTypes : [],
    exemptRoles: Array.isArray(raw?.exemptRoles) ? raw.exemptRoles : [],
  };
}

async function invokeOrThrow(name: string, body: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let payload: any = null;
    try {
      // FunctionsHttpError wraps the real body — extract it
      payload = await (error as any).context?.json?.();
    } catch {}
    if (payload?.error === 'OFFICE_WIFI_REQUIRED') throw new OfficeWifiRequiredError();
    throw new Error(payload?.error || error.message || `${name} failed`);
  }
  return data;
}

export const officeWifiService = {
  async getSettings(): Promise<OfficeWifiSettings> {
    return normalize(await organizationService.getSetting(OFFICE_WIFI_SETTINGS_KEY, DEFAULT_OFFICE_WIFI_SETTINGS));
  },

  async saveSettings(settings: OfficeWifiSettings): Promise<void> {
    await organizationService.setSetting(OFFICE_WIFI_SETTINGS_KEY, normalize(settings));
  },

  async isEnabled(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      return (await officeWifiService.getSettings()).enabled;
    } catch {
      return false;
    }
  },

  async getStatus(params: { gps?: { lat: number; lng: number } | null; dutyType?: string }): Promise<OfficeNetworkStatus> {
    return invokeOrThrow('office-network-status', { gps: params.gps ?? null, dutyType: params.dutyType });
  },

  async clockIn(record: {
    date: string;
    checkIn: string | null;
    status: string;
    remarks: string;
    location: { lat: number; lng: number; address?: string } | undefined;
    dutyType?: string;
    employeeName?: string;
  }): Promise<{ id: string }> {
    return invokeOrThrow('attendance-punch', { action: 'clock_in', record });
  },

  async clockOut(params: { attendanceId: string; checkOut: string | null; remarks?: string; gps?: { lat: number; lng: number } | null }): Promise<void> {
    await invokeOrThrow('attendance-punch', { action: 'clock_out', ...params });
  },

  async listNetworks(): Promise<OfficeNetwork[]> {
    let query = supabase
      .from('office_networks')
      .select('id, ip, first_seen, last_seen')
      .order('last_seen', { ascending: false });
    const orgId = apiClient.getOrganizationId();
    if (orgId) query = query.eq('organization_id', orgId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ id: r.id, ip: r.ip, firstSeen: r.first_seen, lastSeen: r.last_seen }));
  },

  async forgetNetwork(id: string): Promise<void> {
    const { error } = await supabase.from('office_networks').delete().eq('id', id);
    if (error) throw error;
  },
};
