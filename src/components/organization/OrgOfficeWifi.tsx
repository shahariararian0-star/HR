import React, { useState, useEffect } from 'react';
import { Wifi, Save, Loader2, Trash2 } from 'lucide-react';
import {
  officeWifiService,
  DEFAULT_OFFICE_WIFI_SETTINGS,
  OfficeWifiSettings,
  OfficeNetwork,
} from '../../services/officeWifi.service';
import { useToast } from '../../context/ToastContext';

interface Props {
  hasOfficeLocations: boolean;
  dutyLabels: { OFFICE: string; FACTORY: string };
  dutyTypes: ('OFFICE' | 'FACTORY')[];
}

const EXEMPTABLE_ROLES = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER', 'MANAGEMENT', 'HR', 'ADMIN'];

export const OrgOfficeWifi: React.FC<Props> = ({ hasOfficeLocations, dutyLabels, dutyTypes }) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<OfficeWifiSettings>(DEFAULT_OFFICE_WIFI_SETTINGS);
  const [networks, setNetworks] = useState<OfficeNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadNetworks = () => {
    officeWifiService.listNetworks().then(setNetworks).catch(() => setNetworks([]));
  };

  useEffect(() => {
    officeWifiService.getSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));
    loadNetworks();
  }, []);

  const toggleListValue = (field: 'exemptDutyTypes' | 'exemptRoles', value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value],
    }));
  };

  const handleSave = async () => {
    if (settings.enabled && !hasOfficeLocations) {
      showToast('Add an office location in Office Geofences first, so the office Wi-Fi can be learned.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      await officeWifiService.saveSettings(settings);
      showToast('Office Wi-Fi Check-in settings saved.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to save settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleForget = async (network: OfficeNetwork) => {
    try {
      await officeWifiService.forgetNetwork(network.id);
      loadNetworks();
    } catch (e: any) {
      showToast(e?.message || 'Failed to forget this IP.', 'error');
    }
  };

  const isExpired = (n: OfficeNetwork) =>
    Date.now() - new Date(n.lastSeen).getTime() > settings.ipExpiryHours * 3600 * 1000;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 bg-primary text-white flex justify-between items-center">
        <div className="flex items-center gap-3"><Wifi size={20} /><h3 className="text-sm font-semibold uppercase tracking-wider">Office Wi-Fi Check-in</h3></div>
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
        <div className="p-6 space-y-6">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 accent-primary"
              checked={settings.enabled}
              disabled={!hasOfficeLocations && !settings.enabled}
              onChange={e => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <div>
              <p className="font-bold text-slate-900">Office Wi-Fi Check-in</p>
              <p className="text-sm text-slate-500">When ON, employees can only clock in and out while connected to the office Wi-Fi.</p>
              {!hasOfficeLocations && (
                <p className="text-xs text-amber-600 mt-1">Add at least one office location in Office Geofences above before turning this on.</p>
              )}
            </div>
          </label>

          {settings.enabled && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Learned office IPs</p>
                {networks.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
                    None yet. The first employee who clocks in from inside an office geofence teaches the app the office Wi-Fi.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    {networks.map(n => (
                      <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-slate-900 truncate">{n.ip}</p>
                          <p className="text-xs text-slate-500">
                            Last seen {new Date(n.lastSeen).toLocaleString()}
                            {isExpired(n) && <span className="ml-2 text-amber-600 font-semibold">expired</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => handleForget(n)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Forget
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="max-w-[220px] space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">IP expiry (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={settings.ipExpiryHours}
                  onChange={e => setSettings(prev => ({ ...prev, ipExpiryHours: Number(e.target.value) }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-primary-light"
                />
              </div>

              {(EXEMPTABLE_ROLES.every(r => settings.exemptRoles.includes(r))
                || dutyTypes.every(t => settings.exemptDutyTypes.includes(t))) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  Everyone is exempt right now, so the Wi-Fi check never runs. Exempt means "skips the check" —
                  untick the groups that must be on the office Wi-Fi.
                </div>
              )}

              <p className="text-xs text-slate-500 -mb-3">Ticked groups <strong>skip</strong> the Wi-Fi check (e.g. field staff). Leave everyone else unticked.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Exempt duty types</p>
                  {dutyTypes.map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={settings.exemptDutyTypes.includes(type)}
                        onChange={() => toggleListValue('exemptDutyTypes', type)}
                      />
                      {dutyLabels[type]} duty
                    </label>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Exempt roles</p>
                  {EXEMPTABLE_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={settings.exemptRoles.includes(role)}
                        onChange={() => toggleListValue('exemptRoles', role)}
                      />
                      {role.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
