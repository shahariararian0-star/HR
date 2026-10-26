import { supabase, isSupabaseConfigured } from './supabase';
import { DonationTier } from '../types';
import { PaymentGatewayMode, PaymentGatewayProvider } from './paymentSettings.service';

// Online payments (Stripe, PayPal, SSLCommerz). Keys are stored in Supabase Vault through
// set_payment_gateway_secrets() and can never be read back by the browser — the
// dashboard only sees which keys exist and their last 4 characters (migration 0041).
// Checkout and verification run in the payment-checkout edge function.

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface OnlinePayment {
  id: string;
  organizationId: string;
  organizationName?: string;
  provider: PaymentGatewayProvider;
  mode: PaymentGatewayMode;
  tier: DonationTier;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created: string;
  paidAt?: string;
  paidUntil?: string;
}

/** e.g. { 'stripe:test': { secret_key: '…abcd' } } */
export type GatewayKeyStatus = Record<string, Record<string, string>>;

export const GATEWAY_KEY_FIELDS: Record<PaymentGatewayProvider, { key: string; label: string }[]> = {
  stripe: [
    { key: 'secret_key', label: 'Secret key (sk_…)' },
    { key: 'webhook_secret', label: 'Webhook signing secret (whsec_…)' },
  ],
  paypal: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client secret' },
  ],
  sslcommerz: [
    { key: 'store_id', label: 'Store ID' },
    { key: 'store_password', label: 'Store password' },
  ],
};

async function functionError(error: any, fallback: string): Promise<string> {
  try {
    // FunctionsHttpError wraps the real body — extract it
    const body = await error?.context?.json?.();
    if (body?.error) return body.error;
  } catch {}
  return error?.message || fallback;
}

export const paymentGatewayService = {
  async getKeyStatus(): Promise<GatewayKeyStatus> {
    if (!isSupabaseConfigured()) return {};
    const { data, error } = await supabase.rpc('get_payment_gateway_status');
    if (error) throw error;
    return (data ?? {}) as GatewayKeyStatus;
  },

  /** Blank values keep the stored key. */
  async saveKeys(provider: PaymentGatewayProvider, mode: PaymentGatewayMode, keys: Record<string, string>): Promise<void> {
    const { error } = await supabase.rpc('set_payment_gateway_secrets', {
      p_provider: provider,
      p_mode: mode,
      p_secrets: keys,
    });
    if (error) throw error;
  },

  /** Returns the Stripe / PayPal page URL to send the payer to. */
  async startCheckout(provider: PaymentGatewayProvider, tier: DonationTier): Promise<string> {
    const { data, error } = await supabase.functions.invoke('payment-checkout', {
      body: { action: 'create', provider, tier, origin: window.location.origin },
    });
    if (error) throw new Error(await functionError(error, 'Could not start payment'));
    if (!data?.url) throw new Error('Payment page not available');
    return data.url;
  },

  async verifyPayment(paymentId: string): Promise<PaymentStatus> {
    const { data, error } = await supabase.functions.invoke('payment-checkout', {
      body: { action: 'verify', paymentId },
    });
    if (error) throw new Error(await functionError(error, 'Could not check payment'));
    return data.status as PaymentStatus;
  },

  async listPayments(limit = 50): Promise<OnlinePayment[]> {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase
      .from('payments')
      .select('*, organizations(name)')
      .order('created', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: r.organizations?.name,
      provider: r.provider,
      mode: r.mode,
      tier: r.tier,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      created: r.created,
      paidAt: r.paid_at || undefined,
      paidUntil: r.paid_until || undefined,
    }));
  },
};
