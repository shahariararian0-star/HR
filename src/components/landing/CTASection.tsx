import React from 'react';
import { ArrowRight } from 'lucide-react';
import { navigateTo } from '../../utils/seo';

interface CTASectionProps {
  onRegisterClick: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({ onRegisterClick }) => {
  return (
    <section className="py-16 md:py-20 bg-dl-ground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B4FD6] via-[#1677FF] to-[#7C3AED] px-6 py-10 sm:px-12 sm:py-12">
          {/* Decorative ribbons */}
          <div className="absolute -left-16 -bottom-20 w-72 h-72 rounded-full bg-gradient-to-tr from-[#14C38E] to-[#FACC15] opacity-40 blur-2xl" aria-hidden="true" />
          <div className="absolute -right-10 -top-24 w-80 h-80 rounded-full bg-gradient-to-bl from-[#EC4899] to-[#22D3EE] opacity-30 blur-2xl" aria-hidden="true" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 text-center lg:text-left">
            <div className="max-w-xl">
              <h2 className="font-dl-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                Ready to Build a Happier, More Productive Workplace?
              </h2>
              <p className="text-white/85 text-sm sm:text-base">
                Create your organization in a few minutes, invite your team, and start tracking
                attendance today. It is free to start and free to stay.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 shrink-0">
              <button
                onClick={onRegisterClick}
                className="px-7 py-3.5 rounded-xl bg-white text-[#0B4FD6] font-semibold text-sm shadow-lg hover:bg-white/90 transition-colors inline-flex items-center justify-center gap-2"
              >
                Get Started Free <ArrowRight size={17} />
              </button>
              <button
                onClick={() => navigateTo('/contact')}
                className="px-7 py-3.5 rounded-xl border border-white/50 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                Talk to Us
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
