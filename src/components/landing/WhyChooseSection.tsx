import React from 'react';
import { Zap, Users, ShieldCheck, BarChart3 } from 'lucide-react';

const reasons = [
  {
    icon: Zap,
    tone: 'text-[#1677FF] bg-[#1677FF]/12 ring-[#1677FF]/25',
    title: 'Save Time',
    description: 'Automate the manual parts of HR — attendance sheets, leave balances, monthly hours — and focus on what matters most: your people.',
  },
  {
    icon: Users,
    tone: 'text-emerald-500 bg-emerald-500/12 ring-emerald-500/25',
    title: 'Improve Productivity',
    description: 'Give your team simple tools that work on any phone, so check-ins, breaks and leave requests take seconds instead of emails.',
  },
  {
    icon: ShieldCheck,
    tone: 'text-violet-500 bg-violet-500/12 ring-violet-500/25',
    title: 'Stay Compliant',
    description: 'Selfie, location and network evidence on every check-in gives you a clear audit trail, with role-based access to sensitive records.',
  },
  {
    icon: BarChart3,
    tone: 'text-amber-500 bg-amber-500/12 ring-amber-500/25',
    title: 'Make Data-Driven Decisions',
    description: 'See attendance trends, worked hours and leave patterns for every employee, and export the numbers whenever payroll needs them.',
  },
];

const WhyChooseSection: React.FC = () => (
  <section id="why-staffcove" className="py-20 md:py-24 bg-dl-ground">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="font-dl-display text-3xl sm:text-4xl font-extrabold text-dl-ink tracking-tight mb-4">
          Why Teams Choose <span className="sc-gradient-text">StaffCove</span>
        </h2>
        <p className="text-base sm:text-lg text-dl-muted leading-relaxed">
          More than just an HR tool — a better way to build and support your team.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x divide-dl-hair">
        {reasons.map(({ icon: Icon, tone, title, description }) => (
          <div key={title} className="lg:px-7 first:lg:pl-0 last:lg:pr-0 text-center sm:text-left">
            <div className={`w-14 h-14 rounded-full ring-1 flex items-center justify-center mb-5 mx-auto sm:mx-0 ${tone}`}>
              <Icon size={24} aria-hidden="true" />
            </div>
            <h3 className="font-dl-display text-base font-bold text-dl-ink mb-2">{title}</h3>
            <p className="text-sm text-dl-muted leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyChooseSection;
