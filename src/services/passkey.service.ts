import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser';
import { supabase, isSupabaseConfigured } from './supabase';
import { organizationService } from './organization.service';

// Fingerprint (passkey / WebAuthn) sign-in and check-in. Migration 0048; server side is the
// `passkey` edge function and the fingerprint step in `attendance-punch`.
// The phone checks the finger and signs a one-time challenge with a key that never leaves it;
// the server verifies the signature. The app never sees a fingerprint.

export const BIOMETRIC_SETTINGS_KEY = 'biometric_checkin';
export const FINGERPRINT_REQUIRED_MESSAGE = 'Please confirm with your fingerprint to check in.';

export interface BiometricSettings {
  enabled: boolean;
}

export interface PasskeyDevice {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PasskeyStatus {
  registered: number;
  checkinRequired: boolean;
}

export interface PasskeyProof {
  challengeId: string;
  response: unknown;
}

/** A fingerprint step failed or was cancelled. `code` is the server code or 'CANCELLED'. */
export class PasskeyError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PasskeyError';
  }
}

export function isFingerprintRequiredError(err: any): boolean {
  return err?.code === 'FINGERPRINT_REQUIRED' || String(err?.message || '').includes('FINGERPRINT_REQUIRED');
}

async function call(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('passkey', { body });
  if (error) {
    let payload: any = null;
    try {
      payload = await (error as any).context?.json?.();
    } catch {}
    throw new PasskeyError(payload?.error || 'PASSKEY_FAILED', payload?.message || error.message || 'Fingerprint request failed.');
  }
  return data;
}

/** The browser's own errors when the person cancels or the sheet times out. */
function fromBrowserError(err: any): PasskeyError {
  const name = err?.name || err?.cause?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return new PasskeyError('CANCELLED', 'Fingerprint check was cancelled or timed out.');
  }
  if (name === 'InvalidStateError') {
    return new PasskeyError('ALREADY_REGISTERED', 'This device is already registered.');
  }
  return new PasskeyError('BROWSER_ERROR', err?.message || 'This device could not use fingerprint.');
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone / iPad'
    : /Mac/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  return `${os} · ${browser}`;
}

export const passkeyService = {
  /** True when this device has a built-in fingerprint / face / PIN unlock the browser can use. */
  async isSupported(): Promise<boolean> {
    try {
      if (!window.isSecureContext || !browserSupportsWebAuthn()) return false;
      return await platformAuthenticatorIsAvailable();
    } catch {
      return false;
    }
  },

  async status(): Promise<PasskeyStatus> {
    const data = await call({ action: 'status' });
    return { registered: Number(data?.registered) || 0, checkinRequired: data?.checkinRequired === true };
  },

  async register(): Promise<void> {
    const { challengeId, options } = await call({ action: 'register-options' });
    let response;
    try {
      response = await startRegistration({ optionsJSON: options });
    } catch (e) {
      throw fromBrowserError(e);
    }
    await call({ action: 'register-verify', challengeId, response, deviceLabel: deviceLabel() });
  },

  /** Sign in with a registered fingerprint and store the new session. */
  async signIn(): Promise<void> {
    const { challengeId, options } = await call({ action: 'login-options' });
    let response;
    try {
      response = await startAuthentication({ optionsJSON: options });
    } catch (e) {
      throw fromBrowserError(e);
    }
    const tokens = await call({ action: 'login-verify', challengeId, response });
    if (!tokens?.access_token || !tokens?.refresh_token) {
      throw new PasskeyError('PASSKEY_FAILED', 'Fingerprint sign-in failed. Please sign in with your password.');
    }
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error) throw new PasskeyError('PASSKEY_FAILED', error.message);
  },

  /** Ask for the fingerprint and return a proof for attendance-punch. */
  async getPunchProof(): Promise<PasskeyProof> {
    const { challengeId, options } = await call({ action: 'punch-options' });
    try {
      const response = await startAuthentication({ optionsJSON: options });
      return { challengeId, response };
    } catch (e) {
      throw fromBrowserError(e);
    }
  },

  async listMine(userId: string): Promise<PasskeyDevice[]> {
    const { data, error } = await supabase
      .from('passkey_credentials')
      .select('id, device_label, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id, label: r.device_label || 'Device', createdAt: r.created_at, lastUsedAt: r.last_used_at,
    }));
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('passkey_credentials').delete().eq('id', id);
    if (error) throw error;
  },

  /** ADMIN / HR: remove every fingerprint an employee registered. Returns how many. */
  async resetForEmployee(userId: string): Promise<number> {
    const { data, error } = await supabase.from('passkey_credentials').delete().eq('user_id', userId).select('id');
    if (error) throw error;
    return data?.length ?? 0;
  },

  /** ADMIN / HR: ids of employees in the current org with at least one fingerprint. */
  async registeredUserIds(): Promise<Set<string>> {
    const { data, error } = await supabase.from('passkey_credentials').select('user_id');
    if (error) throw error;
    return new Set((data ?? []).map((r: any) => r.user_id as string));
  },

  async getSettings(): Promise<BiometricSettings> {
    if (!isSupabaseConfigured()) return { enabled: false };
    const raw: any = await organizationService.getSetting(BIOMETRIC_SETTINGS_KEY, { enabled: false });
    return { enabled: raw?.enabled === true };
  },

  async saveSettings(settings: BiometricSettings): Promise<void> {
    await organizationService.setSetting(BIOMETRIC_SETTINGS_KEY, { enabled: settings.enabled === true });
  },

  async isCheckinEnabled(): Promise<boolean> {
    try {
      return (await passkeyService.getSettings()).enabled;
    } catch {
      return false;
    }
  },
};
