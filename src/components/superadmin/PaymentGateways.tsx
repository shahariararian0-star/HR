import React, { useState, useEffect } from 'react';
import { Loader2, KeyRound, CheckCircle2, Copy } from 'lucide-react';
import {
  PaymentSettings,
  PaymentGatewayProvider,
  PaymentGatewayConfig,
  PAYMENT_GATEWAY_PROVIDERS,
} from '../../services/paymentSettings.service';
import { paymentGatewayService, GatewayKeyStatus, GATEWAY_KEY_FIELDS } from '../../services/paymentGateway.service';

interface Props {
  settings: PaymentSettings;
  onChange: (settings: PaymentSettings) => void;
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
}

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30';

const GATEWAY_LABELS: Record<PaymentGatewayProvider, { name: string; keysUrl: string; keysHint: string }> = {
  stripe: {
    name: 'Stripe (cards)',
    keysUrl: 'https://dashboard.stripe.com/apikeys',
    keysHint: 'Stripe Dashboard → Developers → API keys. Test keys start with sk_test_.',
  },
  paypal: {
    name: 'PayPal',
    keysUrl: 'https://developer.paypal.com/dashboard/applications',
    keysHint: 'PayPal Developer → Apps & Credentials. Pick Sandbox for test, Live for live. PayPal does not accept BDT.',
  },
  sslcommerz: {
    name: 'SSLCommerz (bKash, Nagad, Rocket, cards, net banking)',
    keysUrl: 'https://developer.sslcommerz.com/registration/',
    keysHint: 'Test: register a free sandbox store and SSLCommerz emails the Store ID and password. Live: from your SSLCommerz merchant account. Accepts BDT; USD prices are converted to BDT for the payer.',
  },
};

const STRIPE_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;

const PaymentGateways: React.FC<Props> = ({ settings, onChange, onMessage }) => {
  const [keyStatus, setKeyStatus] = useState<GatewayKeyStatus>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<PaymentGatewayProvider | null>(null);

  const loadStatus = () => {
    paymentGatewayService.getKeyStatus()
      .then(setKeyStatus)
      .catch(e => onMessage({ type: 'error', text: e?.message || 'Could not load payment key status.' }));
  };

  useEffect(loadStatus, []);

  const updateGateway = (provider: PaymentGatewayProvider, patch: Partial<PaymentGatewayConfig>) => {
    onChange({ ...settings, gateways: { ...settings.gateways, [provider]: { ...settings.gateways[provider], ...patch } } });
  };

  const draftKey = (provider: PaymentGatewayProvider, field: string) => `${provider}:${settings.gateways[provider].mode}:${field}`;

  const handleSaveKeys = async (provider: PaymentGatewayProvider) => {
    const mode = settings.gateways[provider].mode;
    const keys: Record<string, string> = {};
    for (const { key } of GATEWAY_KEY_FIELDS[provider]) {
      keys[key] = drafts[draftKey(provider, key)] ?? '';
    }
    if (Object.values(keys).every(v => !v.trim())) {
      onMessage({ type: 'error', text: 'Type at least one key to save.' });
      return;
    }
    setSavingProvider(provider);
    try {
      await paymentGatewayService.saveKeys(provider, mode, keys);
      setDrafts(prev => {
        const next = { ...prev };
        for (const { key } of GATEWAY_KEY_FIELDS[provider]) delete next[draftKey(provider, key)];
        return next;
      });
      loadStatus();
      onMessage({ type: 'success', text: `${GATEWAY_LABELS[provider].name} ${mode} keys saved.` });
    } catch (e: any) {
      onMessage({ type: 'error', text: e?.message || 'Failed to save keys.' });
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Online payments</p>
      </div>
      <div className="p-4 space-y-6">
        <p className="text-sm text-slate-500">
          Paid online, the organization is activated automatically for its plan's length. SSLCommerz needs no
          webhook setup: it is told where to confirm on every payment. On/off, mode and
          currency are saved with the Save button at the top. Keys are saved with their own button, stored
          encrypted, and never shown again.
        </p>

        <div className="max-w-[200px]">
          <label className="text-xs font-medium text-slate-500">Currency code charged (ISO)</label>
          <input
            type="text"
            value={settings.currencyCode}
            maxLength={3}
            onChange={e => onChange({ ...settings, currencyCode: e.target.value.toUpperCase() })}
            placeholder="USD"
            className={inputClass}
          />
        </div>

        {PAYMENT_GATEWAY_PROVIDERS.map(provider => {
          const gateway = settings.gateways[provider];
          const stored = keyStatus[`${provider}:${gateway.mode}`] ?? {};
          const label = GATEWAY_LABELS[provider];
          return (
            <div key={provider} className="border border-slate-100 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-bold text-slate-900">{label.name}</h4>
                <div className="flex items-center gap-4">
                  <select
                    value={gateway.mode}
                    onChange={e => updateGateway(provider, { mode: e.target.value as PaymentGatewayConfig['mode'] })}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                  >
                    <option value="test">Test mode</option>
                    <option value="live">Live mode (real money)</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={gateway.enabled}
                      onChange={e => updateGateway(provider, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                {label.keysHint}{' '}
                <a href={label.keysUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Open
                </a>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GATEWAY_KEY_FIELDS[provider].map(({ key, label: fieldLabel }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      {fieldLabel} ({gateway.mode})
                      {stored[key] && (
                        <span className="text-emerald-600 flex items-center gap-0.5">
                          <CheckCircle2 size={12} /> set {stored[key]}
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={drafts[draftKey(provider, key)] ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [draftKey(provider, key)]: e.target.value }))}
                      placeholder={stored[key] ? 'Leave blank to keep current key' : 'Paste key'}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>

              {provider === 'stripe' && (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
                  <p>
                    Webhook (recommended): Stripe Dashboard → Developers → Webhooks → Add endpoint. Events:{' '}
                    <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>.
                    Then paste its signing secret above.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="break-all text-slate-700">{STRIPE_WEBHOOK_URL}</code>
                    <button
                      onClick={() => navigator.clipboard?.writeText(STRIPE_WEBHOOK_URL)}
                      title="Copy"
                      className="p-1 text-slate-400 hover:text-primary"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => handleSaveKeys(provider)}
                disabled={savingProvider === provider}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all disabled:opacity-50"
              >
                {savingProvider === provider ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Save {gateway.mode} keys
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentGateways;
