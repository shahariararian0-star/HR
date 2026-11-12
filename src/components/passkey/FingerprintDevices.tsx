import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2, Plus, Smartphone, Trash2 } from 'lucide-react';
import { passkeyService, PasskeyDevice } from '../../services/passkey.service';
import { useToast } from '../../context/ToastContext';

/** My Profile → "Fingerprint & devices": the employee's own registered fingerprints. */
export const FingerprintDevices: React.FC<{ userId: string }> = ({ userId }) => {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<PasskeyDevice[]>([]);
  const [supported, setSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setDevices(await passkeyService.listMine(userId));
    } catch {
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    passkeyService.isSupported().then(setSupported);
    load();
  }, [userId]);

  const add = async () => {
    setBusy(true);
    try {
      await passkeyService.register();
      showToast('Fingerprint registered on this device.', 'success');
      await load();
    } catch (e: any) {
      if (e?.code !== 'CANCELLED') showToast(e?.message || 'Could not register your fingerprint.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: PasskeyDevice) => {
    if (!window.confirm(`Remove "${d.label}"? You will no longer be able to sign in or check in with it.`)) return;
    try {
      await passkeyService.remove(d.id);
      await load();
    } catch {
      showToast('Could not remove this device.', 'error');
    }
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');

  return (
    <div className="max-w-3xl">
      <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-6 flex items-center gap-2">
        <Fingerprint size={24} className="text-primary" /> Fingerprint &amp; devices
      </h3>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-5">
        <p className="text-sm text-slate-500">
          Sign in and check in with your phone's fingerprint. Your fingerprint never leaves your phone. Register each phone you use.
        </p>

        {isLoading ? (
          <div className="py-6 flex justify-center text-slate-300"><Loader2 className="animate-spin" /></div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-400">No fingerprint registered yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {devices.map(d => (
              <li key={d.id} className="flex items-center gap-3 p-4">
                <Smartphone size={18} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{d.label}</p>
                  <p className="text-xs text-slate-500">Added {fmt(d.createdAt)} · Last used {fmt(d.lastUsedAt)}</p>
                </div>
                <button onClick={() => remove(d)} aria-label={`Remove ${d.label}`} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {supported ? (
          <button
            onClick={add}
            disabled={busy}
            className="px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover disabled:opacity-70 flex items-center gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Register this device
          </button>
        ) : (
          <p className="text-xs text-slate-400">This device or browser cannot use fingerprint. Open StaffCove on your phone to register.</p>
        )}
      </div>
    </div>
  );
};

export default FingerprintDevices;
