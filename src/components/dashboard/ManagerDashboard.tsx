
import React from 'react';
import { DashboardData } from '../../hooks/dashboard/useDashboard';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStats } from './DashboardStats';
import { AnnouncementWidget } from './AnnouncementWidget';
import { LeaveAllocationCard, DirectoryCard } from './DashboardCards';

interface Props {
  data: DashboardData;
  isLoading: boolean;
  onNavigate: (path: string, params?: any) => void;
}

export const ManagerDashboard: React.FC<Props> = ({ data, isLoading, onNavigate }) => {
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

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 items-start">
          {/* Leave Allocation Card */}
          <div className="lg:col-span-2">
            <LeaveAllocationCard
              leaveTypes={data.leaveTypes}
              userBalance={data.userBalance}
              onApply={() => onNavigate('leave', { autoOpen: true })}
            />
          </div>

          <div className="space-y-5 md:space-y-6">
            {/* Team Directory Shortcut */}
            <DirectoryCard
              title="Team Directory"
              subtitle={data.teamInfo?.name || data.freshUser.department}
              activeCount={data.activeTeamMembers}
              totalCount={data.teamMembersCount}
              onOpen={() => onNavigate('employees')}
            />

            {/* Announcements Widget */}
            <AnnouncementWidget user={data.freshUser} onNavigate={onNavigate} />
          </div>
        </div>
      )}
    </div>
  );
};
