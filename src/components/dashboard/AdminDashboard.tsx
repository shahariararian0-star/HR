
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

const TILE_COLORS = [
  'bg-blue-50 text-blue-600 border-blue-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
  'bg-amber-50 text-amber-600 border-amber-100',
  'bg-purple-50 text-purple-600 border-purple-100',
  'bg-teal-50 text-teal-600 border-teal-100',
];

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
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center"><Zap size={18} /></div>
              <h2 className="text-base md:text-lg font-semibold text-slate-900">Quick Actions</h2>
            </div>
            {QUICK_ACTION_GROUPS.map(group => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{group.label}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
                  {group.items.map((item, i) => (
                    <button
                      key={item.path}
                      onClick={() => onNavigate(item.path)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border font-semibold text-xs md:text-sm transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${TILE_COLORS[i % TILE_COLORS.length]}`}
                    >
                      <item.icon size={20} />
                      <span className="truncate max-w-full text-slate-700">{item.label}</span>
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
