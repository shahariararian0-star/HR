import React from 'react';
import { Users, Clock, CalendarDays, BarChart3, ClipboardCheck, MapPin, Camera, Megaphone, ArrowRight } from 'lucide-react';
import { navigateTo } from '../../utils/seo';

// slug links to the feature's own page under /features; features without a page have none.
const features = [
  {
    icon: Users,
    tone: 'from-[#1677FF] to-[#4C9BFF]',
    title: 'Employee Management',
    slug: 'employee-directory',
    description: 'Keep every employee profile, department, designation and role in one secure place, with self-service updates.',
  },
  {
    icon: Clock,
    tone: 'from-[#10B981] to-[#34D399]',
    title: 'Attendance Tracking',
    slug: 'attendance-tracking',
    description: 'Check-in and check-out with selfie, GPS or office Wi-Fi, multiple breaks, and live worked hours for every shift.',
  },
  {
    icon: CalendarDays,
    tone: 'from-[#F59E0B] to-[#FBBF24]',
    title: 'Leave Management',
    slug: 'leave-management',
    description: 'Custom leave types, automatic balances and approval workflows. Employees apply in seconds, managers approve in one click.',
  },
  {
    icon: BarChart3,
    tone: 'from-[#8B5CF6] to-[#A78BFA]',
    title: 'Hours & Reports',
    slug: 'reports-analytics',
    description: 'Monthly hours per employee, attendance summaries and leave reports, exported to CSV or PDF for payroll and audits.',
  },
  {
    icon: ClipboardCheck,
    tone: 'from-[#EC4899] to-[#F472B6]',
    title: 'Performance Reviews',
    slug: 'performance-reviews',
    description: 'Review cycles with self-assessments, manager evaluations and HR sign-off, using competencies that match your values.',
  },
  {
    icon: MapPin,
    tone: 'from-[#06B6D4] to-[#22D3EE]',
    title: 'GPS Geofencing',
    slug: 'gps-geofencing',
    description: 'Set office locations and a radius so check-ins only count when staff are actually on site, with the location on record.',
  },
  {
    icon: Camera,
    tone: 'from-[#6366F1] to-[#818CF8]',
    title: 'Selfie Verification',
    slug: 'biometric-selfie-verification',
    description: 'Every check-in carries a photo and timestamp, so buddy punching stops and each attendance record can be verified.',
  },
  {
    icon: Megaphone,
    tone: 'from-[#14B8A6] to-[#2DD4BF]',
    title: 'Announcements & Alerts',
    slug: '',
    description: 'Post company news to the right roles and reach everyone instantly with in-app and push notifications, no refresh needed.',
  },
];

const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-20 md:py-24 bg-dl-ground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="font-dl-display text-3xl sm:text-4xl font-extrabold text-dl-ink tracking-tight mb-4">
            Everything You Need for <span className="sc-gradient-text">Modern HR</span>
          </h2>
          <p className="text-base sm:text-lg text-dl-muted leading-relaxed">
            Streamline your HR operations with tools built for growing teams. StaffCove covers the
            things every organisation has to track — who was here, who is away, who works where and
            how the year went — and treats each one as a core feature, not an upsell.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {features.map((feature) => {
            const content = (
              <>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.tone} flex items-center justify-center mb-4 shadow-dl-1`}>
                  <feature.icon size={20} className="text-white" aria-hidden="true" />
                </div>
                <h3 className="font-dl-display text-base font-bold text-dl-ink mb-2">{feature.title}</h3>
                <p className="text-sm text-dl-muted leading-relaxed mb-4 grow">{feature.description}</p>
                {feature.slug && (
                  <span className="self-end text-dl-teal transition-transform group-hover:translate-x-1">
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                )}
              </>
            );
            const cls =
              'group flex flex-col p-5 bg-dl-surface border border-dl-hair rounded-2xl text-left transition-all duration-300';
            return feature.slug ? (
              <a
                key={feature.title}
                href={`/features/${feature.slug}`}
                onClick={(e) => { e.preventDefault(); navigateTo(`/features/${feature.slug}`); }}
                className={`${cls} hover:shadow-dl-2 hover:border-dl-teal/40 hover:-translate-y-0.5 cursor-pointer`}
              >
                {content}
              </a>
            ) : (
              <div key={feature.title} className={cls}>
                {content}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => navigateTo('/features')}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-dl-teal border border-dl-teal/30 rounded-xl hover:bg-dl-teal/5 transition-colors"
          >
            View All Features <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
