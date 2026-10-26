
import React from 'react';
import { Network, User, Plus, ArrowRight } from 'lucide-react';
import { DashboardData } from '../../hooks/dashboard/useDashboard';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStats } from './DashboardStats';
import { AnnouncementWidget } from './AnnouncementWidget';
import { AdBanner } from '../ads/AdBanner';

interface Props {
  data: DashboardData;
  isLoading: boolean;
  onNavigate: (path: string, params?: any) => void;
}

export const EmployeeDashboard: React.FC<Props> = ({ data, isLoading, onNavigate }) => {
  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in duration-700">
      <DashboardHeader
        user={data.freshUser}
        activeShift={data.activeShift}
        appConfig={data.appConfig}
        isLoading={isLoading}
        onNavigate={onNavigate}
      />

      <DashboardStats
        leaveUsed={data.leaveUsed}
        upcomingHoliday={data.upcomingHoliday}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 items-start">
        <div className="lg:col-span-2 space-y-5 md:space-y-6">
          {/* Employee Specific Content - Mobile Optimized Grid */}
          {!isLoading && (
            <div className="grid grid-cols-2 gap-3 md:gap-4 animate-in slide-in-from-bottom-4">

               {/* 1. My Team */}
               <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 min-h-[84px] min-w-0">
                  <div className="w-10 h-10 bg-primary-light text-primary rounded-full flex items-center justify-center flex-shrink-0"><Network size={18} /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Team</p>
                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 leading-tight" title={data.myTeamName}>
                      {data.myTeamName}
                    </h3>
                  </div>
               </div>

               {/* 2. Reports To */}
               <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 min-h-[84px] min-w-0">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0"><User size={18} /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Manager</p>
                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 leading-tight">
                      {data.myManager?.name || 'No Manager'}
                    </h3>
                  </div>
               </div>

               {/* 3. Leave Action */}
               <button
                 onClick={() => onNavigate('leave', { autoOpen: true })}
                 className="col-span-2 w-full py-3.5 px-5 bg-primary text-white rounded-2xl shadow-sm flex items-center justify-between active:scale-[0.99] hover:bg-primary-hover transition-all group"
               >
                  <div className="flex items-center gap-3">
                     <div className="p-1.5 bg-white/20 rounded-lg group-hover:rotate-90 transition-transform duration-500">
                        <Plus size={16} className="text-white" />
                     </div>
                     <span className="text-sm font-semibold">New Request</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium opacity-90 group-hover:opacity-100 transition-opacity">
                     <span>Apply Leave</span>
                     <ArrowRight size={16} />
                  </div>
               </button>
            </div>
          )}

          {/* Phase 2B: PWA Ad Placement - Below summary cards */}
          {!isLoading && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <AdBanner slot="dashboard-below-cards" className="mx-auto" />
            </div>
          )}
        </div>

        {/* Announcements Widget */}
        <AnnouncementWidget user={data.freshUser} onNavigate={onNavigate} />
      </div>
    </div>
  );
};
