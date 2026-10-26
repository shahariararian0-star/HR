import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { paymentGatewayService, OnlinePayment } from '../../services/paymentGateway.service';

interface Props {
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
}

const STATUS_STYLES: Record<OnlinePayment['status'], string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const PaymentHistory: React.FC<Props> = ({ onMessage }) => {
  const [payments, setPayments] = useState<OnlinePayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setPayments(await paymentGatewayService.listPayments());
    } catch (e: any) {
      onMessage({ type: 'error', text: e?.message || 'Could not load payments.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Asks Stripe / PayPal again — for a payment where the payer never came back.
  const handleRecheck = async (id: string) => {
    setCheckingId(id);
    try {
      const status = await paymentGatewayService.verifyPayment(id);
      onMessage({ type: status === 'PAID' ? 'success' : 'error', text: `Payment status: ${status}` });
      await load();
    } catch (e: any) {
      onMessage({ type: 'error', text: e?.message || 'Could not check payment.' });
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Online payment history</p>
        <button onClick={load} title="Refresh" className="p-1 text-slate-400 hover:text-primary">
          <RefreshCw size={14} />
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center h-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">No online payments yet.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {payments.map(p => (
            <div key={p.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{p.organizationName || p.organizationId}</p>
                <p className="text-xs text-slate-500">
                  {p.amount} {p.currency} · {p.tier} · {p.provider}{p.mode === 'test' ? ' (test)' : ''} ·{' '}
                  {new Date(p.created).toLocaleString()}
                  {p.status === 'PAID' && ` · active until ${p.paidUntil ? new Date(p.paidUntil).toLocaleDateString() : 'forever'}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                {p.status !== 'PAID' && (
                  <button
                    onClick={() => handleRecheck(p.id)}
                    disabled={checkingId === p.id}
                    className="text-xs font-semibold text-primary hover:text-primary-hover disabled:opacity-50"
                  >
                    {checkingId === p.id ? 'Checking…' : 'Re-check'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
