import React from 'react';
import { LayoutDashboard, Users, Clock, CalendarDays, BarChart3, ClipboardCheck, Settings, Search, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { Bars, Donut, DonutLegend, DEPARTMENT_SLICES, Initials } from './MockCharts';

// Static picture of the admin dashboard for the hero. Sample numbers only; the names are
// the public demo accounts, so a visitor who opens the live demo sees the same people.

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Users, label: 'Employees' },
  { icon: Clock, label: 'Attendance' },
  { icon: CalendarDays, label: 'Leave' },
  { icon: ClipboardCheck, label: 'Performance' },
  { icon: BarChart3, label: 'Reports' },
  { icon: Settings, label: 'Settings' },
];

const STATS = [
  { label: 'Total Employees', value: '248', trend: '12% from last month', up: true },
  { label: 'On Leave Today', value: '12', trend: '2% from last week', up: false },
  { label: 'Attendance Rate', value: '96%', trend: '4% from last month', up: true },
];

const HeroDashboardMockup: React.FC = () => (
  <div
    className="relative rounded-[20px] border border-dl-hair bg-dl-surface shadow-[0_30px_80px_-30px_rgba(22,119,255,0.45)] overflow-hidden select-none"
    aria-hidden="true"
  >
    <div className="flex">
      {/* Sidebar */}
      <div className="hidden sm:flex flex-col w-36 shrink-0 border-r border-dl-hair-soft bg-dl-surface-2 p-3 gap-1">
        <div className="flex items-center gap-1.5 mb-3 px-1">
          <img src="/img/logo-mark.png" alt="" className="w-5 h-5 rounded bg-white object-contain" />
          <span className="text-[11px] font-bold text-dl-ink">Staff<span className="text-dl-teal">Cove</span></span>
        </div>
        {NAV.map(({ icon: Icon, label, active }) => (
          <div
            key={label}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium ${
              active ? 'bg-dl-teal/15 text-dl-teal' : 'text-dl-muted'
            }`}
          >
            <Icon size={12} />
            {label}
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5 flex-1 max-w-[200px] px-2.5 py-1.5 rounded-lg bg-dl-surface-2 border border-dl-hair-soft text-[10px] text-dl-soft">
            <Search size={11} /> Search employees, reports…
          </div>
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-dl-muted" />
            <Initials name="Alex Morgan" size={22} />
            <div className="hidden md:block leading-tight">
              <div className="text-[10px] font-semibold text-dl-ink">Alex Morgan</div>
              <div className="text-[9px] text-dl-soft">HR Director</div>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <div className="text-sm font-bold text-dl-ink">Welcome back, Alex 👋</div>
          <div className="text-[10px] text-dl-muted">Here's what's happening with your team today.</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-dl-hair-soft bg-dl-surface-2 p-2.5 min-w-0">
              <div className="text-[9px] text-dl-muted truncate">{s.label}</div>
              <div className="text-lg font-bold text-dl-ink leading-tight">{s.value}</div>
              <div className={`flex items-center gap-0.5 text-[8px] truncate ${s.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                {s.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />} {s.trend}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="rounded-xl border border-dl-hair-soft bg-dl-surface-2 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-dl-ink">Team Attendance</span>
              <span className="flex items-center gap-2 text-[8px] text-dl-soft">
                <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-[#1677FF]" />Present</span>
                <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-rose-400" />Absent</span>
              </span>
            </div>
            <Bars values={[72, 88, 64, 92, 80, 45, 38]} labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} height={84} />
          </div>
          <div className="hidden md:block rounded-xl border border-dl-hair-soft bg-dl-surface-2 p-3">
            <div className="text-[10px] font-semibold text-dl-ink mb-2">Employee Distribution</div>
            <div className="flex items-center gap-3">
              <Donut slices={DEPARTMENT_SLICES} total="248" caption="Employees" size={92} />
              <DonutLegend slices={DEPARTMENT_SLICES} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HeroDashboardMockup;
