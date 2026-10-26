
import React from 'react';
import { CalendarDays, Gift } from 'lucide-react';
import { Holiday } from '../../types';

interface Props {
  leaveUsed: number;
  upcomingHoliday: Holiday | null;
  isLoading: boolean;
  compact?: boolean;
}

const SkeletonCard = () => (
  <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm animate-pulse flex items-center gap-4">
    <div className="w-11 h-11 md:w-12 md:h-12 bg-slate-100 rounded-full flex-shrink-0"></div>
    <div className="space-y-2 flex-1">
      <div className="h-2.5 bg-slate-50 rounded-lg w-1/2"></div>
      <div className="h-5 md:h-6 bg-slate-100 rounded-lg w-3/4"></div>
    </div>
  </div>
);

export const DashboardStats: React.FC<Props> = ({ leaveUsed, upcomingHoliday, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 md:gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 md:gap-4">
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 md:gap-4 min-w-0">
        <div className="w-11 h-11 md:w-12 md:h-12 bg-primary-light text-primary rounded-full flex items-center justify-center flex-shrink-0">
          <CalendarDays size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate">Leave Used</p>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{leaveUsed} Days</h3>
        </div>
      </div>
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 md:gap-4 min-w-0">
        <div className="w-11 h-11 md:w-12 md:h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Gift size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate">
            {upcomingHoliday ? upcomingHoliday.name : 'No Holidays'}
          </p>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight truncate">
            {upcomingHoliday ? new Date(upcomingHoliday.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : 'N/A'}
          </h3>
        </div>
      </div>
    </div>
  );
};
