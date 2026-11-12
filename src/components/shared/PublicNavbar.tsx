import React, { useState } from 'react';
import { Menu, X, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSearch } from '../../context/SearchContext';
import { navigateTo } from '../../utils/seo';
import { dlShell, dlBrand, dlNav } from '../shared/daylightShell';

/**
 * Navigation bar for every public page other than the home page (blog, guides,
 * features, about, contact, changelog, legal). It carries the same links and
 * actions as the home page navbar (src/components/landing/Navbar.tsx) so the
 * menu does not change when a visitor moves between public pages.
 */
interface PublicNavbarProps {
  onRegisterClick?: () => void;
}

type NavLink = { label: string; href: string; section?: string };

const NAV_LINKS: NavLink[] = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/', section: 'pricing' },
  { label: 'FAQ', href: '/', section: 'faq' },
  { label: 'Contact', href: '/contact' },
  { label: 'Blog', href: '/blog' },
  { label: 'Guides', href: '/how-to-use' },
];

/** Pricing and FAQ are sections of the home page: open it, then scroll once they render. */
function goToSection(id: string) {
  navigateTo('/');
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    if (++tries < 40) setTimeout(tick, 50);
  };
  setTimeout(tick, 50);
}

function isActive(link: NavLink, path: string): boolean {
  if (link.section) return false;
  return path === link.href || path.startsWith(link.href + '/');
}

const PublicNavbar: React.FC<PublicNavbarProps> = ({ onRegisterClick }) => {
  const { darkMode, setDarkModePreference } = useTheme();
  const { setSearchOpen } = useSearch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '';

  const toggleDarkMode = () => setDarkModePreference(darkMode ? 'light' : 'dark');

  const go = (link: NavLink) => {
    setMobileOpen(false);
    if (link.section) goToSection(link.section);
    else navigateTo(link.href);
  };

  const goHome = () => {
    setMobileOpen(false);
    navigateTo('/');
  };

  const handleGetStarted = () => {
    setMobileOpen(false);
    if (onRegisterClick) onRegisterClick();
    else navigateTo('/');
  };

  return (
    <>
      <nav className={dlShell.nav}>
        <div className={dlShell.inner}>
          <div className={dlShell.row}>
            {/* Logo */}
            <div className={dlBrand.trigger} onClick={goHome}>
              <div className={dlBrand.frame}>
                <img src="/img/logo.webp" className="w-full h-full object-contain" alt="StaffCove" width="48" height="48" />
              </div>
              <span className={dlBrand.word}>
                <span className={dlBrand.wordInk}>Staff</span>
                <span className={dlBrand.wordAccent}>Cove</span>
              </span>
            </div>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-5 lg:gap-7">
              {NAV_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.section ? `/#${link.section}` : link.href}
                  onClick={(e) => { e.preventDefault(); go(link); }}
                  className={isActive(link, path) ? dlNav.linkActive : dlNav.link}
                  aria-current={isActive(link, path) ? 'page' : undefined}
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => setSearchOpen(true)}
                className={dlNav.searchTrigger}
                aria-label="Search (Ctrl+K)"
              >
                <Search size={14} />
                <span>Search…</span>
                <kbd className={dlNav.searchKbd}>Ctrl+K</kbd>
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className={dlNav.iconButton}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={goHome} className={dlNav.buttonQuiet}>
                Login
              </button>
              <button onClick={handleGetStarted} className={dlNav.buttonPrimary}>
                Get Started Free
              </button>
            </div>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center gap-1">
              <button onClick={() => setSearchOpen(true)} className={dlNav.iconButtonCompact} aria-label="Search">
                <Search size={20} />
              </button>
              <button
                onClick={toggleDarkMode}
                className={dlNav.iconButtonCompact}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className={dlNav.iconButtonCompact}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className={`${dlNav.mobilePanel} animate-in slide-in-from-top-2 duration-200`}>
            <div className={dlNav.mobilePanelInner}>
              {NAV_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.section ? `/#${link.section}` : link.href}
                  onClick={(e) => { e.preventDefault(); go(link); }}
                  className={isActive(link, path) ? dlNav.mobileLinkActive : dlNav.mobileLink}
                >
                  {link.label}
                </a>
              ))}
              <div className={dlNav.mobileDivider}>
                <button onClick={goHome} className={dlNav.mobileButtonQuiet}>Login</button>
                <button onClick={handleGetStarted} className={dlNav.mobileButtonPrimary}>Get Started Free</button>
              </div>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer to push content below the fixed navbar */}
      <div className={dlShell.spacer} />
    </>
  );
};

export default PublicNavbar;
