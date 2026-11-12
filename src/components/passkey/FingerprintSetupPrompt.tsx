import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck, X } from 'lucide-react';
import { passkeyService } from '../../services/passkey.service';
import { useToast } from '../../context/ToastContext';

/**
 * Asks a signed-in employee to register their phone's fingerprint (a passkey).
 *
 * - Shown only on devices with a built-in unlock, and only while the employee has no
 *   fingerprint registered.
 * - When the organization has "Fingerprint check-in" OFF it is a dismissible card;
 *   "Not now" hides it for 7 days on this device.
 * - When it is ON, it is a blocking dialog: they cannot check in without a fingerprint.
 */

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const snoozeKey = (userId: string) => `staffcove-fingerprint-prompt:${userId}`;

function isSnoozed(userId: string): boolean {
  try {
    const raw = localStorage.getItem(snoozeKey(userId));
    return !!raw && Date.now() - Number(raw) < SNOOZE_MS;
  } catch {
    return false;
  }
}

interface Props {
  userId: string;
  onSignOut?: () => void;
}

export const FingerprintSetupPrompt: React.FC<Props> = ({ userId, onSignOut }) => {
  const { showToast } = useToast();
  const [state, setState] = useState<'hidden' | 'optional' | 'required'>('hidden');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await passkeyService.isSupported())) return;
      try {
        const status = await passkeyService.status();
        if (cancelled || status.registered > 0) return;
        if (status.checkinRequired) setState('required');
        else if (!isSnoozed(userId)) setState('optional');
      } catch {
        // Not set up on this website address, or offline: stay quiet.
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (state === 'hidden') return null;

  const register = async () => {
    setBusy(true);
    setError('');
    try {
      await passkeyService.register();
      setState('hidden');
      showToast('Fingerprint registered. You can now use it to sign in and check in.', 'success');
    } catch (e: any) {
      if (e?.code === 'ALREADY_REGISTERED') {
        setState('hidden');
      } else if (e?.code === 'CANCELLED') {
        setError('Registration was cancelled. Touch the sensor when your phone asks.');
      } else {
        setError(e?.message || 'Could not register your fingerprint. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const snooze = () => {
    try { localStorage.setItem(snoozeKey(userId), Date.now().toString()); } catch {}
    setState('hidden');
  };

  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
          <Fingerprint size={22} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">
            {state === 'required' ? 'Register your fingerprint to check in' : 'Use your fingerprint'}
          </h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            {state === 'required'
              ? 'Your organization asks you to confirm check-in and check-out with this phone\'s fingerprint.'
              : 'Sign in and check in with this phone\'s fingerprint instead of typing your password.'}
          </p>
        </div>
        {state === 'optional' && (
          <button onClick={snooze} aria-label="Close" className="p-1.5 -m-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={18} />
          </button>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500 mt-4 leading-relaxed">
        <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        Your fingerprint stays on your phone. StaffCove only receives a confirmation from it. Your phone may offer face unlock or your screen lock instead.
      </p>

      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
        {state === 'optional' ? (
          <button onClick={snooze} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Not now
          </button>
        ) : onSignOut && (
          <button onClick={onSignOut} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Sign out
          </button>
        )}
        <button
          onClick={register}
          disabled={busy}
          className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
          Register fingerprint
        </button>
      </div>
    </>
  );

  if (state === 'required') {
    return (
      <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 sm:p-6">{body}</div>
      </div>
    );
  }

  return (
    <div className="fixed top-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[100] bg-white rounded-2xl border border-slate-200 shadow-xl p-5" role="dialog" aria-label="Use your fingerprint">
      {body}
    </div>
  );
};

export default FingerprintSetupPrompt;
