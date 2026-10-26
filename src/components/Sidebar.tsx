
import React from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Network,
  UserCircle,
  List,
  History,
  ClipboardCheck,
  Megaphone,
  Bell,
  Building2,
  CreditCard,
  Wallet,
  ShieldAlert,
  ScrollText,
  Sparkles,
  Monitor,
  HardDrive,
  Send,
  FileText,
  BookOpen,
  HelpCircle,
  Star,
  Share2,
} from 'lucide-react';
import HelpButton from './onboarding/HelpButton';
import { BrandMark } from './shared/BrandMark';

interface SidebarProps {
  currentPath: string;
  navParams?: any;
  onNavigate: (path: string, params?: any) => void;
  onLogout: () => void;
  role: string;
  user?: any;
}

// Super Admin dashboard sections, opened as #/super-admin/<tab>
const SUPER_ADMIN_SECTIONS = [
  {
    label: 'Platform',
    items: [
      { tab: 'organizations', label: 'Organizations', icon: Building2 },
      { tab: 'requests', label: 'Upgrades', icon: CreditCard },
      { tab: 'payments', label: 'Payments', icon: Wallet },
      { tab: 'hygiene', label: 'Review', icon: ShieldAlert },
      { tab: 'audit', label: 'Audit Log', icon: ScrollText },
      { tab: 'ai-email', label: 'Email', icon: Sparkles },
      { tab: 'ads', label: 'Ads', icon: Monitor },
      { tab: 'storage', label: 'Storage', icon: HardDrive },
      { tab: 'notifications', label: 'Notifications', icon: Bell },
      { tab: 'broadcast', label: 'Push', icon: Send },
    ],
  },
  {
    label: 'Content',
    items: [
      { tab: 'blog', label: 'Blog', icon: FileText },
      { tab: 'tutorials', label: 'Tutorials', icon: BookOpen },
      { tab: 'guides', label: 'Guides', icon: HelpCircle },
      { tab: 'showcase', label: 'Showcase', icon: Star },
      { tab: 'social', label: 'Social', icon: Share2 },
    ],
  },
];

const navItemClass = (isActive: boolean) =>
  `w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-colors relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    isActive ? 'bg-primary-light text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;

const Sidebar: React.FC<SidebarProps> = ({ currentPath, navParams, onNavigate, onLogout, role, user }) => {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const roleLabel = isSuperAdmin ? 'Super Admin' : (user?.designation || 'Specialist');

  // Super Admin has a different menu
  const superAdminMenuItems = [
    { id: 'profile', label: 'My Profile', icon: UserCircle, roles: ['SUPER_ADMIN'] },
  ];
  const superAdminTab = (currentPath === 'super-admin' || currentPath === 'dashboard') ? (navParams?.tab || 'organizations') : null;

  const regularMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
    { id: 'profile', label: 'My Profile', icon: UserCircle, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
    { id: 'attendance-logs', label: 'My Attendance', icon: History, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
    { id: 'attendance-audit', label: 'Attendance Audit', icon: List, roles: ['ADMIN', 'HR', 'MANAGER'] },
    { id: 'leave', label: 'Leave', icon: CalendarDays, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
    { id: 'admin-notifications', label: 'Notifications', icon: Bell, roles: ['ADMIN', 'HR'] },
    { id: 'employees', label: 'Team Directory', icon: Users, roles: ['ADMIN', 'HR', 'MANAGER'] },
    { id: 'performance-review', label: 'Performance', icon: ClipboardCheck, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
    { id: 'organization', label: 'Organization', icon: Network, roles: ['ADMIN', 'HR'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'HR'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['ADMIN', 'HR'] },
  ];

  const menuItems = isSuperAdmin ? superAdminMenuItems : regularMenuItems;
  const filteredItems = menuItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-72 bg-app-sidebar h-[100dvh] flex flex-col border-r border-app-border relative z-50">
      {/* Brand */}
      <div className="h-20 px-6 flex items-center flex-shrink-0">
        <BrandMark />
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
        {isSuperAdmin && SUPER_ADMIN_SECTIONS.map(section => (
          <div key={section.label} className="pb-2">
            <p className="px-4 pt-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = superAdminTab === item.tab;
                return (
                  <button
                    key={item.tab}
                    onClick={() => onNavigate('super-admin', { tab: item.tab })}
                    aria-current={isActive ? 'page' : undefined}
                    className={navItemClass(isActive)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" aria-hidden="true"></span>
                      )}
                      <item.icon size={18} className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'} />
                      <span className={`text-sm truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {isSuperAdmin && <p className="px-4 pt-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Account</p>}
        {filteredItems.map((item) => {
          const isActive = currentPath === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-colors relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" aria-hidden="true"></span>
                )}
                <item.icon size={20} className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className={`text-sm truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              </div>
              {!isSuperAdmin && (
                <HelpButton helpPointId={`sidebar.${item.id}`} size={14} variant="sidebar" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Account + Sign Out */}
      <div className="p-3 border-t border-app-border flex-shrink-0 space-y-2">
        <button
          onClick={() => onNavigate('profile')}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random`}
            className="w-10 h-10 rounded-full bg-slate-50 object-cover flex-shrink-0"
            alt=""
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'User Name'}</p>
            <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
          </div>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <LogOut size={18} className="text-slate-400 group-hover:text-rose-600" />
          <span className="text-sm font-semibold">Sign Out</span>
        </button>
        <p className="text-[10px] font-medium text-slate-400 text-center tracking-widest uppercase">StaffCove v2.9.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;
