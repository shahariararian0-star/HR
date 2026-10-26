
import React, { useState, useEffect } from 'react';
import { Building, Building2, ArrowRight, Coffee, Play, Loader2 } from 'lucide-react';
import { Employee, Attendance, AppConfig } from '../../types';
import { getEnabledDutyTypes } from '../../utils/dutyTypes';
import { useBreaks } from '../../hooks/attendance/useBreaks';
import { formatBreakMinutes } from '../../services/break.service';
import { calculateWorkedMinutes, formatWorkedMinutes } from '../../utils/attendanceUtils';

interface Props {
  user: Employee;
  activeShift?: Attendance;
  appConfig: AppConfig | null;
  isLoading: boolean;
  onNavigate: (path: string) => void;
}

export const DashboardHeader: React.FC<Props> = ({ user, activeShift, appConfig, isLoading, onNavigate }) => {
  const enabledDutyTypes = getEnabledDutyTypes(appConfig);
  const breakState = useBreaks(activeShift?.id);

  // Live time since check-in, refreshed every 30 s while a session is open.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!activeShift) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(timer);
  }, [activeShift?.id]);
  const nowHHMM = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const workedMinutes = activeShift ? calculateWorkedMinutes(activeShift.checkIn, nowHHMM) : null;
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
      <div>
        {appConfig?.companyName && (
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={12} className="text-primary" />
            <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.2em]">{appConfig.companyName}</p>
          </div>
        )}
        <p className="text-sm text-slate-500">{greeting},</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{user.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {user.designation} {user.department && user.department !== 'Unassigned' && `• ${user.department}`}
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        {isLoading ? (
          <div className="w-48 h-16 bg-slate-100 rounded-[1.5rem] animate-pulse"></div>
        ) : activeShift ? (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Break — any number per session; checking out ends a running break */}
          <button
            onClick={breakState.openBreak ? breakState.endBreak : breakState.startBreak}
            disabled={breakState.isBusy}
            className={`w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 md:py-4 rounded-2xl md:rounded-[1.5rem] transition-all active:scale-95 disabled:opacity-60 ${
              breakState.openBreak
                ? 'bg-amber-500 shadow-lg shadow-amber-200 hover:bg-amber-600'
                : 'bg-white border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {breakState.isBusy
              ? <Loader2 size={16} className={`animate-spin ${breakState.openBreak ? 'text-white' : 'text-slate-500'}`} />
              : breakState.openBreak
                ? <Play size={16} className="text-white" />
                : <Coffee size={16} className="text-slate-500" />}
            <div className="text-left">
              <p className={`text-[9px] font-semibold uppercase tracking-widest leading-none mb-1 ${breakState.openBreak ? 'text-amber-100' : 'text-slate-400'}`}>
                {breakState.openBreak
                  ? `On break since ${new Date(breakState.openBreak.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : breakState.breaks.length > 0
                    ? `Breaks today: ${formatBreakMinutes(breakState.totalMinutes)}`
                    : 'Need a pause?'}
              </p>
              <p className={`text-xs font-semibold uppercase ${breakState.openBreak ? 'text-white' : 'text-slate-700'}`}>
                {breakState.openBreak ? 'End Break' : 'Start Break'}
              </p>
            </div>
          </button>
          <button
            onClick={() => onNavigate('attendance-finish')}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 md:py-4 bg-rose-500 rounded-2xl md:rounded-[1.5rem] shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all group active:scale-95 animate-in zoom-in"
          >
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-75"></div>
            </div>
            <div className="text-left">
              <p className="text-[9px] font-semibold text-rose-100 uppercase tracking-widest leading-none mb-1">
                {activeShift.dutyType === 'FACTORY' ? (appConfig?.dutyLabel2 || 'Factory') : (appConfig?.dutyLabel1 || 'Office')}
                {workedMinutes !== null ? ` · ${formatWorkedMinutes(workedMinutes)}` : ' Session Active'}
              </p>
              <p className="text-xs font-semibold text-white uppercase">Check Out</p>
            </div>
            <ArrowRight size={16} className="text-rose-200 group-hover:text-white transition-colors ml-2" />
          </button>
          </div>
        ) : (
          <div className={`grid ${enabledDutyTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2 w-full sm:w-auto animate-in slide-in-from-right-4`}>
            {enabledDutyTypes.includes('OFFICE') && (
              <button
                onClick={() => onNavigate('attendance-quick-office')}
                className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-primary text-white rounded-2xl md:rounded-[1.5rem] shadow-lg shadow-primary-light hover:bg-primary-hover active:scale-95 transition-all"
              >
                <Building size={16} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">{appConfig?.dutyLabel1 || 'Office'}</span>
              </button>
            )}
            {enabledDutyTypes.includes('FACTORY') && (
              <button
                onClick={() => onNavigate('attendance-quick-factory')}
                className={`flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-primary text-white rounded-2xl md:rounded-[1.5rem] shadow-lg shadow-primary-light hover:bg-primary-hover active:scale-95 transition-all ${enabledDutyTypes.length > 1 ? 'opacity-80' : ''}`}
              >
                <Building2 size={16} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">{appConfig?.dutyLabel2 || 'Factory'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
