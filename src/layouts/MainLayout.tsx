import React, { useState } from 'react';
import { Database, Menu, X, LayoutDashboard, Clock, CalendarDays, UserCircle, Sun, Moon, MoreHorizontal } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/notifications/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SubscriptionBanner } from '../components/subscription';
import { BrandMark } from '../components/shared/BrandMark';


interface MainLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  navParams?: any;
  onNavigate: (path: string, params?: any) => void;
}

// Bottom bar destinations (phones and tablets). "More" opens the full menu, so every
// section of the sidebar stays reachable.
const BOTTOM_NAV = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, match: ['dashboard'] },
  { id: 'attendance-logs', label: 'History', icon: Clock, match: ['attendance-logs', 'attendance-audit'] },
  { id: 'leave', label: 'Leave', icon: CalendarDays, match: ['leave'] },
  { id: 'profile', label: 'Account', icon: UserCircle, match: ['profile'] },
];

const MainLayout: React.FC<MainLayoutProps> = ({ children, currentPath, navParams, onNavigate }) => {
  const { user, logout } = useAuth();
  const { darkMode, setDarkModePreference } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigate = (path: string, params?: any) => {
    onNavigate(path, params);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('dashboard'); // Reset path on logout
  };

  if (!user) return null;

  const isBottomNavActive = BOTTOM_NAV.some(item => item.match.includes(currentPath));

  return (
    <div className="flex bg-app-bg min-h-[100dvh] relative overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      {/* Mobile / tablet overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar — fixed from lg, slide-in drawer below */}
      <div className={`fixed h-full z-[70] transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          currentPath={currentPath}
          navParams={navParams}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          role={user.role}
          user={user}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-72 flex flex-col min-h-[100dvh] max-w-full min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 lg:h-20 bg-white/90 backdrop-blur-xl border-b border-app-border flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 sticky top-0 z-40">
           <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                className="p-2 -ml-2 text-slate-500 lg:hidden hover:bg-slate-50 rounded-xl transition-colors flex-shrink-0"
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>

              <BrandMark size={32} className="lg:hidden" />
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-slate-50 text-slate-500 border-slate-100">
                <Database size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Cloud Node Alpha</span>
              </div>
           </div>

           <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setDarkModePreference(darkMode ? 'light' : 'dark')}
                className="p-2.5 rounded-xl text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors flex-shrink-0"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <NotificationBell onNavigate={handleNavigate} />
              <button
                className="flex items-center gap-3 flex-shrink-0 rounded-full lg:rounded-xl lg:pl-1 lg:pr-3 lg:py-1 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => handleNavigate('profile')}
                aria-label="My profile"
              >
                <img
                  src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`}
                  className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-slate-50 object-cover ring-2 ring-transparent hover:ring-primary transition-all flex-shrink-0"
                  alt=""
                  width={40}
                  height={40}
                />
                <span className="hidden lg:block text-left min-w-0 max-w-[10rem]">
                  <span className="block text-sm font-semibold text-slate-900 truncate">{user.name}</span>
                  <span className="block text-xs text-slate-500 truncate">
                    {user.role === 'SUPER_ADMIN' ? 'Super Admin' : (user.designation || user.role)}
                  </span>
                </span>
              </button>
           </div>
        </header>

        {/* Subscription Banner - visible to all org users */}
        <SubscriptionBanner onUpgradeClick={() => handleNavigate('upgrade')} userRole={user.role} onExitDemo={handleLogout} />

        {/* Content */}
        <div id="main-content" className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 w-full pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 overflow-x-hidden">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>

        {/* Bottom Navigation (phones and tablets) */}
        <nav
          aria-label="Quick navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-app-border grid grid-cols-5 gap-1 px-2 pt-2 z-50 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        >
          {BOTTOM_NAV.map(item => {
            const isActive = item.match.includes(currentPath);
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl transition-colors ${isActive ? 'bg-primary-light text-primary' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <item.icon size={20} />
                <span className="text-[11px] font-semibold leading-none">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="More sections"
            className={`flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl transition-colors ${!isBottomNavActive || isMobileMenuOpen ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[11px] font-semibold leading-none">More</span>
          </button>
        </nav>
      </main>
    </div>
  );
};

export default MainLayout;
