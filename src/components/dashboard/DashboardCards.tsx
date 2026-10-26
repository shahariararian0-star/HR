import React from 'react';
import { ShieldCheck, Plus, Users, ChevronRight } from 'lucide-react';
import { CustomLeaveType, LeaveBalance } from '../../types';

/** Leave balance per type + "Apply for Leave" — shared by the admin and manager dashboards. */
export const LeaveAllocationCard: React.FC<{
  leaveTypes?: CustomLeaveType[];
  userBalance?: LeaveBalance | null;
  onApply: () => void;
}> = ({ leaveTypes, userBalance, onApply }) => {
  const balanceTypes = leaveTypes?.filter(t => t.hasBalance) || [];
  const totalRemaining = balanceTypes.reduce((sum, t) => sum + ((userBalance?.[t.id] as number) || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-5 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold text-slate-900">Leave Allocation</h2>
          <p className="text-xs text-slate-500">
            You have <span className="font-semibold text-slate-900">{totalRemaining} total days</span> remaining for the current fiscal year.
          </p>
        </div>
      </div>

      {balanceTypes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {balanceTypes.map(lt => (
            <div key={lt.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center min-w-0">
              <p className="text-xs font-medium text-slate-500 truncate">{lt.name.replace(' Leave', '')}</p>
              <p className="text-2xl font-bold text-primary leading-tight">{(userBalance?.[lt.id] as number) || 0}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onApply}
        className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-primary-hover transition-colors active:scale-[0.99]"
      >
        <Plus size={18} /> Apply for Leave
      </button>
    </div>
  );
};

/** Directory shortcut with active / total member counts. */
export const DirectoryCard: React.FC<{
  title: string;
  subtitle: string;
  activeCount: number;
  totalCount: number;
  onOpen: () => void;
}> = ({ title, subtitle, activeCount, totalCount, onOpen }) => (
  <button
    onClick={onOpen}
    className="w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3 transition-colors hover:bg-slate-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
        <Users size={20} />
      </div>
      <div className="min-w-0">
        <h4 className="font-semibold text-slate-900 leading-tight truncate">{title}</h4>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="text-right">
        <p className="text-sm font-bold text-emerald-600">{activeCount} Active</p>
        <p className="text-[11px] text-slate-400">Out of {totalCount}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300" />
    </div>
  </button>
);
