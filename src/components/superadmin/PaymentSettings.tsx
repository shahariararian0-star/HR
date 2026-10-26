import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import {
  paymentSettingsService,
  DEFAULT_PAYMENT_SETTINGS,
  isSafePaymentUrl,
  PaymentSettings as PaymentSettingsValue,
  PaymentMethod,
  PaymentTier,
} from '../../services/paymentSettings.service';
import PaymentGateways from './PaymentGateways';
import PaymentHistory from './PaymentHistory';

interface Props {
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
}

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30';

const PaymentSettings: React.FC<Props> = ({ onMessage }) => {
  const [settings, setSettings] = useState<PaymentSettingsValue>(DEFAULT_PAYMENT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    paymentSettingsService.getSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, []);

  const updateTier = (id: PaymentTier['id'], patch: Partial<PaymentTier>) => {
    setSettings(prev => ({ ...prev, tiers: prev.tiers.map(t => (t.id === id ? { ...t, ...patch } : t)) }));
  };

  const updateMethod = (id: string, patch: Partial<PaymentMethod>) => {
    setSettings(prev => ({ ...prev, methods: prev.methods.map(m => (m.id === id ? { ...m, ...patch } : m)) }));
  };

  const addMethod = () => {
    setSettings(prev => ({
      ...prev,
      methods: [...prev.methods, { id: `method-${Date.now()}`, name: '', url: '', details: '', enabled: true }],
    }));
  };

  const removeMethod = (id: string) => {
    setSettings(prev => ({ ...prev, methods: prev.methods.filter(m => m.id !== id) }));
  };

  const handleSave = async () => {
    const badMethod = settings.methods.find(m => m.url.trim() && !isSafePaymentUrl(m.url));
    if (badMethod) {
      onMessage({ type: 'error', text: `Payment link for "${badMethod.name || 'unnamed method'}" must start with https:// or http://` });
      return;
    }
    if (settings.methods.some(m => !m.name.trim())) {
      onMessage({ type: 'error', text: 'Every payment method needs a name.' });
      return;
    }
    if (!/^[A-Z]{3}$/.test(settings.currencyCode)) {
      onMessage({ type: 'error', text: 'Currency code must be 3 letters, e.g. USD.' });
      return;
    }
    setIsSaving(true);
    try {
      await paymentSettingsService.saveSettings(settings);
      onMessage({ type: 'success', text: 'Payment settings saved.' });
    } catch (e: any) {
      onMessage({ type: 'error', text: e?.message || 'Failed to save payment settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet size={22} className="text-primary" />
            Payment Settings
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Plans and prices shown on the home page and the Upgrade page. Approve payments in the Upgrades tab.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSettings(DEFAULT_PAYMENT_SETTINGS)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plans</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="max-w-[200px]">
            <label className="text-xs font-medium text-slate-500">Currency symbol</label>
            <input
              type="text"
              value={settings.currencySymbol}
              maxLength={5}
              onChange={e => setSettings(prev => ({ ...prev, currencySymbol: e.target.value }))}
              placeholder="$, ৳, €"
              className={inputClass}
            />
          </div>
          <div className="divide-y divide-slate-50">
            {settings.tiers.map(tier => (
              <div key={tier.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 py-3 items-end">
                <div>
                  <label className="text-xs font-medium text-slate-500">Label shown ({tier.id})</label>
                  <input
                    type="text"
                    value={tier.duration}
                    onChange={e => updateTier(tier.id, { duration: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Price</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={tier.amount}
                    onChange={e => updateTier(tier.id, { amount: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
                  <input
                    type="checkbox"
                    checked={tier.enabled}
                    onChange={e => updateTier(tier.id, { enabled: e.target.checked })}
                  />
                  Show
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PaymentGateways settings={settings} onChange={setSettings} onMessage={onMessage} />

      {/* Payment methods */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manual payment methods</p>
          <button
            onClick={addMethod}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
          >
            <Plus size={14} /> Add method
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {settings.methods.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No payment methods. Add one so admins know how to pay.</p>
          )}
          {settings.methods.map(method => (
            <div key={method.id} className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto_auto] gap-3 items-end">
                <div>
                  <label className="text-xs font-medium text-slate-500">Name</label>
                  <input
                    type="text"
                    value={method.name}
                    onChange={e => updateMethod(method.id, { name: e.target.value })}
                    placeholder="bKash, PayPal, Bank transfer"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Payment link (optional)</label>
                  <input
                    type="url"
                    value={method.url}
                    onChange={e => updateMethod(method.id, { url: e.target.value })}
                    placeholder="https://paypal.me/yourname"
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
                  <input
                    type="checkbox"
                    checked={method.enabled}
                    onChange={e => updateMethod(method.id, { enabled: e.target.checked })}
                  />
                  Show
                </label>
                <button
                  onClick={() => removeMethod(method.id)}
                  title="Remove"
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Account details (optional)</label>
                <input
                  type="text"
                  value={method.details}
                  onChange={e => updateMethod(method.id, { details: e.target.value })}
                  placeholder="e.g. Send Money to 01XXXXXXXXX (Personal)"
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instructions for admins (optional)</p>
        </div>
        <div className="p-4">
          <textarea
            value={settings.instructions}
            onChange={e => setSettings(prev => ({ ...prev, instructions: e.target.value }))}
            rows={3}
            placeholder="e.g. Put your organization name in the payment note. We activate within 24 hours."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      <PaymentHistory onMessage={onMessage} />
    </div>
  );
};

export default PaymentSettings;
