import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2, Save } from 'lucide-react';
import { passkeyService } from '../../services/passkey.service';
import { useToast } from '../../context/ToastContext';
import { Employee } from '../../types';

interface Props {
  employees: Employee[];
}

/** Organization → Placement: the "Fingerprint check-in" switch (migration 0048). */
export const OrgBiometric: React.FC<Props> = ({ employees }) => {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([passkeyService.getSettings(), passkeyService.registeredUserIds().catch(() => new Set<string>())])
      .then(([settings, ids]) => { setEnabled(settings.enabled); setRegistered(ids); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const active = employees.filter(e => (e as any).status !== 'INACTIVE');
  const missing = active.filter(e => !registered.has(e.id));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await passkeyService.saveSettings({ enabled });
      showToast(enabled ? 'Fingerprint check-in is on.' : 'Fingerprint check-in is off.', 'success');
    } catch {
      showToast('Could not save. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 bg-primary text-white flex justify-between items-center">
        <div className="flex items-center gap-3"><Fingerprint size={20} /><h3 className="text-sm font-semibold uppercase tracking-wider">Fingerprint Check-in</h3></div>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      {isLoading ? (
        <div className="p-10 flex justify-center text-slate-300"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="p-6 space-y-5">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 accent-primary"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <div>
              <p className="font-bold text-slate-900">Require fingerprint to check in and out</p>
              <p className="text-sm text-slate-500">
                When ON, employees confirm every check-in and check-out with their phone's fingerprint, so nobody can
                check in for someone else. Employees without a registered fingerprint are asked to register at their
                next sign-in. Anyone can use fingerprint to sign in, whether this is on or off.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                The phone may accept face unlock or its screen lock instead of a finger. A new phone needs registering again;
                use "Reset fingerprint" in Team Directory if an employee changes phone.
              </p>
            </div>
          </label>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-800">
              {active.length - missing.length} of {active.length} employees have registered a fingerprint
            </p>
            {missing.length > 0 && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Not yet: {missing.slice(0, 12).map(e => e.name).join(', ')}{missing.length > 12 ? ` and ${missing.length - 12} more` : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgBiometric;
