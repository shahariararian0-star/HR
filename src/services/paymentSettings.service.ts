import { supabase, isSupabaseConfigured } from './supabase';
import { DonationTier } from '../types';

// Platform payment settings (settings row key 'payment_settings', organization_id IS NULL).
// Edited by Super Admin in the Payments tab; read by org admins on the Upgrade page
// through the get_payment_settings() RPC (migration 0040), since settings RLS hides
// platform rows from everyone except Super Admin.

export interface PaymentTier {
  id: DonationTier;
  amount: number;
  duration: string;
  enabled: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  url: string;      // optional external payment link (http/https only)
  details: string;  // optional account details, e.g. "bKash: 01XXXXXXXXX (Personal)"
  enabled: boolean;
}

export type PaymentGatewayProvider = 'stripe' | 'paypal' | 'sslcommerz';

export const PAYMENT_GATEWAY_PROVIDERS: PaymentGatewayProvider[] = ['stripe', 'paypal', 'sslcommerz'];
export type PaymentGatewayMode = 'test' | 'live';

// Non-secret gateway options. Keys live in Vault (see paymentGateway.service.ts).
export interface PaymentGatewayConfig {
  enabled: boolean;
  mode: PaymentGatewayMode;
}

export interface PaymentSettings {
  currencySymbol: string;
  currencyCode: string; // ISO 4217, charged by Stripe / PayPal
  instructions: string;
  tiers: PaymentTier[];
  methods: PaymentMethod[];
  gateways: Record<PaymentGatewayProvider, PaymentGatewayConfig>;
}

const SETTINGS_KEY = 'payment_settings';

// Matches what the Upgrade page showed before payment settings were configurable.
export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  currencySymbol: '$',
  currencyCode: 'USD',
  instructions: '',
  gateways: {
    stripe: { enabled: false, mode: 'test' },
    paypal: { enabled: false, mode: 'test' },
    sslcommerz: { enabled: false, mode: 'test' },
  },
  tiers: [
    { id: 'TIER_3MO', amount: 5, duration: '3 months', enabled: true },
    { id: 'TIER_6MO', amount: 10, duration: '6 months', enabled: true },
    { id: 'TIER_1YR', amount: 20, duration: '1 year', enabled: true },
    { id: 'TIER_LIFETIME', amount: 50, duration: 'Lifetime', enabled: true },
  ],
  methods: [
    { id: 'kofi', name: 'Ko-fi', url: 'https://ko-fi.com/openhr', details: '', enabled: true },
    { id: 'bmac', name: 'Buy Me a Coffee', url: 'https://buymeacoffee.com/openhrapp', details: '', enabled: true },
    { id: 'paypal', name: 'PayPal', url: 'https://paypal.me/openhr', details: '', enabled: true },
  ],
};

/** Only http(s) links are rendered as clickable, so a saved value can never become a javascript: URL. */
export function isSafePaymentUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// Fill gaps from defaults so a partially saved or older value still renders every tier.
function normalize(raw: unknown): PaymentSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_PAYMENT_SETTINGS;
  const value = raw as Partial<PaymentSettings>;
  const savedTiers = Array.isArray(value.tiers) ? value.tiers : [];
  const gateway = (p: PaymentGatewayProvider): PaymentGatewayConfig => ({
    enabled: value.gateways?.[p]?.enabled === true,
    mode: value.gateways?.[p]?.mode === 'live' ? 'live' : 'test',
  });
  return {
    currencySymbol: typeof value.currencySymbol === 'string' ? value.currencySymbol : DEFAULT_PAYMENT_SETTINGS.currencySymbol,
    currencyCode: typeof value.currencyCode === 'string' && /^[A-Za-z]{3}$/.test(value.currencyCode)
      ? value.currencyCode.toUpperCase()
      : DEFAULT_PAYMENT_SETTINGS.currencyCode,
    instructions: typeof value.instructions === 'string' ? value.instructions : '',
    gateways: { stripe: gateway('stripe'), paypal: gateway('paypal'), sslcommerz: gateway('sslcommerz') },
    tiers: DEFAULT_PAYMENT_SETTINGS.tiers.map(def => {
      const saved = savedTiers.find(t => t?.id === def.id);
      return saved
        ? {
            id: def.id,
            amount: Number(saved.amount) || 0,
            duration: typeof saved.duration === 'string' && saved.duration ? saved.duration : def.duration,
            enabled: saved.enabled !== false,
          }
        : def;
    }),
    methods: Array.isArray(value.methods)
      ? value.methods.map((m, i) => ({
          id: typeof m?.id === 'string' && m.id ? m.id : `method-${i}`,
          name: typeof m?.name === 'string' ? m.name : '',
          url: typeof m?.url === 'string' ? m.url : '',
          details: typeof m?.details === 'string' ? m.details : '',
          enabled: m?.enabled !== false,
        }))
      : DEFAULT_PAYMENT_SETTINGS.methods,
  };
}

function parse(value: unknown): PaymentSettings {
  if (typeof value === 'string') {
    try {
      return normalize(JSON.parse(value));
    } catch {
      return DEFAULT_PAYMENT_SETTINGS;
    }
  }
  return normalize(value);
}

export const paymentSettingsService = {
  async getSettings(): Promise<PaymentSettings> {
    if (!isSupabaseConfigured()) return DEFAULT_PAYMENT_SETTINGS;
    try {
      const { data, error } = await supabase.rpc('get_payment_settings');
      if (error) throw error;
      return data ? parse(data) : DEFAULT_PAYMENT_SETTINGS;
    } catch (e: any) {
      console.warn('[PaymentSettings] Load failed, using defaults:', e?.message || e);
      return DEFAULT_PAYMENT_SETTINGS;
    }
  },

  /** Plans for the public landing page. Anonymous visitors can call this (migration 0047). */
  async getPublicPlans(): Promise<Pick<PaymentSettings, 'currencySymbol' | 'tiers'>> {
    const pick = (s: PaymentSettings) => ({ currencySymbol: s.currencySymbol, tiers: s.tiers });
    if (!isSupabaseConfigured()) return pick(DEFAULT_PAYMENT_SETTINGS);
    try {
      const { data, error } = await supabase.rpc('get_public_plans');
      if (error) throw error;
      return pick(data ? parse(data) : DEFAULT_PAYMENT_SETTINGS);
    } catch (e: any) {
      console.warn('[PaymentSettings] Public plans load failed, using defaults:', e?.message || e);
      return pick(DEFAULT_PAYMENT_SETTINGS);
    }
  },

  async saveSettings(settings: PaymentSettings): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const value = JSON.stringify(normalize(settings));
    // Manual upsert — the partial unique index on platform keys needs a WHERE clause
    // in ON CONFLICT that the Supabase JS client cannot express.
    const { data: existing, error: findErr } = await supabase
      .from('settings')
      .select('id')
      .eq('key', SETTINGS_KEY)
      .is('organization_id', null)
      .maybeSingle();
    if (findErr) throw findErr;
    const { error } = existing
      ? await supabase.from('settings').update({ value }).eq('id', existing.id)
      : await supabase.from('settings').insert({ key: SETTINGS_KEY, value, organization_id: null });
    if (error) throw error;
  },
};
