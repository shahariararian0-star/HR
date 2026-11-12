
import React from 'react';
import { Users, List, CalendarDays, Network, BarChart3, Settings, History, UserCircle, Zap } from 'lucide-react';
import { DashboardData } from '../../hooks/dashboard/useDashboard';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStats } from './DashboardStats';
import { AnnouncementWidget } from './AnnouncementWidget';
import { LeaveAllocationCard, DirectoryCard } from './DashboardCards';
import SetupChecklist from '../onboarding/SetupChecklist';

interface Props {
  data: DashboardData;
  isLoading: boolean;
  onNavigate: (path: string, params?: any) => void;
}


const QUICK_ACTION_GROUPS = [
  {
    label: 'Management',
    items: [
      { path: 'attendance-audit', label: 'Audit', icon: List },
      { path: 'leave', label: 'Leave', icon: CalendarDays },
      { path: 'employees', label: 'Directory', icon: Users },
      { path: 'organization', label: 'Org', icon: Network },
      { path: 'reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Personal',
    items: [
      { path: 'attendance-logs', label: 'Attendance', icon: History },
      { path: 'profile', label: 'Profile', icon: UserCircle },
      { path: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const AdminDashboard: React.FC<Props> = ({ data, isLoading, onNavigate }) => {
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

      {/* Setup Checklist for Admins */}
      <SetupChecklist user={data.freshUser} onNavigate={onNavigate} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 items-start">
        <div className="lg:col-span-2 space-y-5 md:space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center"><Zap size={18} /></div>
              <h2 className="text-base md:text-lg font-semibold text-slate-900">Quick Actions</h2>
            </div>
            {QUICK_ACTION_GROUPS.map(group => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{group.label}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
                  {group.items.map(item => (
                    <button
                      key={item.path}
                      onClick={() => onNavigate(item.path)}
                      className="group flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-xl border border-slate-200 bg-white font-medium text-xs md:text-sm transition-colors hover:border-primary hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <item.icon size={20} className="text-primary" />
                      <span className="truncate max-w-full text-slate-700 group-hover:text-primary">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!isLoading && (
            <LeaveAllocationCard
              leaveTypes={data.leaveTypes}
              userBalance={data.userBalance}
              onApply={() => onNavigate('leave', { autoOpen: true })}
            />
          )}
        </div>

        {!isLoading && (
          <div className="space-y-5 md:space-y-6">
            {/* Org Directory Shortcut */}
            <DirectoryCard
              title="Global Directory"
              subtitle="Organization-wide"
              activeCount={data.activeTeamMembers}
              totalCount={data.teamMembersCount}
              onOpen={() => onNavigate('employees')}
            />

            {/* Announcements Widget */}
            <AnnouncementWidget user={data.freshUser} onNavigate={onNavigate} />
          </div>
        )}
      </div>
    </div>
  );
};
