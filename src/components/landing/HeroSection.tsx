import React, { useState } from 'react';
import { ArrowRight, Check, Play, Camera, Wifi, CalendarCheck, Smartphone, BarChart3 } from 'lucide-react';
import DemoLoginModal from './DemoLoginModal';
import HeroDashboardMockup from './HeroDashboardMockup';

interface HeroSectionProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLoginSuccess?: (user: any) => void;
}

// Capabilities shown in the strip under the hero. These are product facts, not customer
// logos: StaffCove does not show company logos or endorsements it has no permission to use.
const CAPABILITIES = [
  { icon: Camera, label: 'Selfie + GPS check-in' },
  { icon: Wifi, label: 'Office Wi-Fi check-in' },
  { icon: CalendarCheck, label: 'Leave approvals' },
  { icon: BarChart3, label: 'Hours & reports' },
  { icon: Smartphone, label: 'Installs as an app' },
];

const FACTS = [
  { value: '$0', label: 'Free plan, forever' },
  { value: '14 days', label: 'Ad-free to start' },
  { value: 'Any device', label: 'Phone, tablet, desktop' },
];

const HeroSection: React.FC<HeroSectionProps> = ({ onLoginClick, onRegisterClick }) => {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <section className="relative pt-28 md:pt-36 pb-14 md:pb-20 overflow-hidden bg-dl-ground">
      {/* Soft brand glow behind the hero */}
      <div
        className="absolute -top-40 right-[-10%] w-[70%] h-[80%] rounded-full blur-[120px] -z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--sc-glow), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-10 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-dl-teal/10 border border-dl-teal/20 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-dl-teal rounded-full" />
              <span className="text-[11px] font-bold text-dl-teal uppercase tracking-dl-label">All-in-one HR platform</span>
            </div>

            <h1 className="font-dl-display text-4xl sm:text-5xl xl:text-6xl font-extrabold text-dl-ink tracking-tight leading-[1.08] mb-6">
              HR Management That Puts{' '}
              <span className="sc-gradient-text">People First</span>
            </h1>

            <p className="text-base sm:text-lg text-dl-muted max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              StaffCove helps modern teams manage people, simplify HR processes and build a happier,
              more productive workplace. Track attendance with selfie, GPS or office Wi-Fi check-ins,
              handle leave requests in one click, and keep every employee record in one place — on
              any device, with nothing to install.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 mb-6">
              <button
                onClick={onRegisterClick}
                className="sc-gradient-bg px-7 py-3.5 text-white font-semibold text-sm rounded-xl shadow-[0_10px_30px_-10px_rgba(22,119,255,0.7)] hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                Get Started Free <ArrowRight size={17} />
              </button>
              <button
                onClick={() => setShowDemoModal(true)}
                className="px-7 py-3.5 bg-dl-surface border border-dl-hair text-dl-ink font-semibold text-sm rounded-xl hover:border-dl-teal hover:text-dl-teal transition-colors flex items-center justify-center gap-2"
              >
                <Play size={16} /> Try Live Demo
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs text-dl-muted mb-4">
              {['No credit card required', 'Setup in minutes', 'Free plan forever'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-500" /> {t}
                </span>
              ))}
            </div>

            <p className="text-sm text-dl-muted">
              Already have an account?{' '}
              <button onClick={onLoginClick} className="font-semibold text-dl-teal hover:underline">
                Log in
              </button>
            </p>
          </div>

          {/* Product picture */}
          <div className="min-w-0 lg:[transform:perspective(1600px)_rotateY(-6deg)_rotateX(2deg)]">
            <HeroDashboardMockup />
          </div>
        </div>

        {/* Capabilities + facts strip */}
        <div className="mt-14 md:mt-20 rounded-2xl border border-dl-hair bg-dl-surface shadow-dl-1 p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-center">
          <div>
            <div className="text-[10px] font-bold text-dl-soft uppercase tracking-dl-label mb-3 text-center lg:text-left">
              Everything a working day needs
            </div>
            <ul className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-3">
              {CAPABILITIES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-semibold text-dl-ink">
                  <Icon size={17} className="text-dl-teal" aria-hidden="true" /> {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 lg:border-l border-dl-hair lg:pl-6">
            {FACTS.map((f, i) => (
              <div key={f.label} className={`text-center px-2 ${i > 0 ? 'border-l border-dl-hair' : ''}`}>
                <div className="font-dl-display text-lg sm:text-xl xl:text-2xl font-bold text-dl-ink whitespace-nowrap">{f.value}</div>
                <div className="text-[11px] text-dl-muted">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DemoLoginModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onOpenLoginPage={onLoginClick}
      />
    </section>
  );
};

export default HeroSection;
