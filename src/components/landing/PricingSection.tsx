import React, { useEffect, useMemo, useState } from 'react';
import { Check, Gift, Crown, Server } from 'lucide-react';
import { navigateTo } from '../../utils/seo';
import { tierMonths, bestSaving } from '../../utils/planPricing';
import { paymentSettingsService, DEFAULT_PAYMENT_SETTINGS, PaymentTier } from '../../services/paymentSettings.service';

interface PricingSectionProps {
  onRegisterClick: () => void;
}

// The middle card is driven by the plans a Super Admin sets in Super Admin -> Payments,
// read through get_public_plans() (migration 0047). Free and Self-Hosted are fixed.

const FREE_FEATURES = [
  'Every HR feature included',
  'No employee limits',
  'First 14 days ad-free',
  'Works on any device',
];

const SELF_HOSTED_FEATURES = [
  'Your data on your own servers',
  'The same full product, open source',
  'Docker Compose setup',
  'Help with installation on request',
];

const Feature: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2.5 text-sm text-dl-ink">
    <Check size={16} className="text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </li>
);

const PricingSection: React.FC<PricingSectionProps> = ({ onRegisterClick }) => {
  const [plans, setPlans] = useState<{ currencySymbol: string; tiers: PaymentTier[] } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    paymentSettingsService.getPublicPlans().then((p) => {
      if (!cancelled) setPlans(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tiers = useMemo(() => (plans?.tiers ?? []).filter((t) => t.enabled), [plans]);
  const symbol = plans?.currencySymbol ?? DEFAULT_PAYMENT_SETTINGS.currencySymbol;
  const saving = useMemo(() => bestSaving(tiers), [tiers]);

  // Default to the longest timed plan, which is usually the best value per month.
  useEffect(() => {
    if (tiers.length === 0 || tiers.some((t) => t.id === selectedId)) return;
    const timed = tiers.filter((t) => tierMonths(t.duration) !== null);
    const pick = timed.length ? timed[timed.length - 1] : tiers[0];
    setSelectedId(pick.id);
  }, [tiers, selectedId]);

  const selected = tiers.find((t) => t.id === selectedId) ?? null;
  const isLifetime = selected ? tierMonths(selected.duration) === null : false;
  const showPaid = plans === null || tiers.length > 0;

  return (
    <section id="pricing" className="py-20 md:py-24 bg-dl-ground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-dl-hair bg-dl-surface-2/60 p-5 sm:p-8 lg:p-10">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div className="max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-full border border-dl-hair bg-dl-surface text-[10px] font-bold text-dl-muted uppercase tracking-dl-label mb-4">
                Simple &amp; transparent pricing
              </span>
              <h2 className="font-dl-display text-3xl sm:text-4xl font-extrabold text-dl-ink tracking-tight mb-3">
                Plans for Every Stage of Growth
              </h2>
              <p className="text-base text-dl-muted leading-relaxed">
                Start free and keep every feature for as long as you like. If you would rather your
                team never sees an ad, pick an ad-free plan for the whole organization — one price,
                not per seat. Upgrade or switch anytime from inside the app.
              </p>
            </div>

            {tiers.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <div role="radiogroup" aria-label="Ad-free plan length" className="flex flex-wrap p-1 rounded-xl border border-dl-hair bg-dl-surface">
                  {tiers.map((t) => {
                    const active = t.id === selectedId;
                    return (
                      <button
                        key={t.id}
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedId(t.id)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          active ? 'sc-gradient-bg text-white shadow-dl-1' : 'text-dl-muted hover:text-dl-ink'
                        }`}
                      >
                        {t.duration}
                      </button>
                    );
                  })}
                </div>
                {saving >= 5 && (
                  <span className="px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    Save up to {saving}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Cards */}
          <div className={`grid grid-cols-1 gap-5 ${showPaid ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-4xl'}`}>
            {/* Free */}
            <div className="flex flex-col rounded-2xl border border-dl-hair bg-dl-surface p-6">
              <div className="flex items-start gap-3 mb-5">
                <span className="w-11 h-11 rounded-xl bg-[#1677FF]/12 text-[#1677FF] flex items-center justify-center shrink-0">
                  <Gift size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-dl-ink">Free</h3>
                  <p className="text-xs text-dl-muted">Perfect for teams getting started with HR.</p>
                </div>
              </div>
              <div className="mb-5">
                <span className="font-dl-display text-4xl font-extrabold text-dl-ink">{symbol}0</span>
                <span className="text-sm text-dl-muted"> /forever</span>
              </div>
              <ul className="space-y-2.5 mb-6 grow">
                {FREE_FEATURES.map((f) => <Feature key={f}>{f}</Feature>)}
              </ul>
              <button
                onClick={onRegisterClick}
                className="w-full py-3 rounded-xl border border-dl-hair text-sm font-semibold text-dl-ink hover:border-dl-teal hover:text-dl-teal transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Ad-free (dynamic) */}
            {showPaid && (
              <div className="relative flex flex-col rounded-2xl border-2 border-[#22C3D6] bg-dl-surface p-6 shadow-[0_20px_60px_-25px_rgba(18,181,203,0.6)]">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#5EEAD4] to-[#67E8F9] text-[#063B45] text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                  Recommended
                </span>
                <div className="flex items-start gap-3 mb-5">
                  <span className="w-11 h-11 rounded-xl sc-gradient-bg text-white flex items-center justify-center shrink-0">
                    <Crown size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-dl-ink">Ad-Free</h3>
                    <p className="text-xs text-dl-muted">Everything in Free, with no ads for anyone.</p>
                  </div>
                </div>
                <div className="mb-5 min-h-[44px]">
                  {selected ? (
                    <>
                      <span className="font-dl-display text-4xl font-extrabold text-dl-ink">
                        {symbol}{selected.amount}
                      </span>
                      <span className="text-sm text-dl-muted">
                        {isLifetime ? ' one-time, for good' : ` /organization · ${selected.duration}`}
                      </span>
                    </>
                  ) : (
                    <span className="inline-block h-10 w-32 rounded-lg bg-dl-hair-soft animate-pulse" />
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 grow">
                  <Feature>Everything in Free</Feature>
                  <Feature>No ads for every employee</Feature>
                  <Feature>One price for the whole organization</Feature>
                  <Feature>
                    {selected
                      ? isLifetime
                        ? 'Pay once, ad-free for good'
                        : `Ad-free for ${selected.duration}`
                      : 'Choose the length that suits you'}
                  </Feature>
                </ul>
                <button
                  onClick={onRegisterClick}
                  className="w-full py-3 rounded-xl sc-gradient-bg text-white text-sm font-semibold shadow-dl-1 hover:brightness-110 transition-all"
                >
                  Start Free, Upgrade Anytime
                </button>
              </div>
            )}

            {/* Self-hosted */}
            <div className="flex flex-col rounded-2xl border border-dl-hair bg-dl-surface p-6">
              <div className="flex items-start gap-3 mb-5">
                <span className="w-11 h-11 rounded-xl bg-violet-500/12 text-violet-500 flex items-center justify-center shrink-0">
                  <Server size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-dl-ink">Self-Hosted</h3>
                  <p className="text-xs text-dl-muted">For organizations that keep data in-house.</p>
                </div>
              </div>
              <div className="mb-5">
                <span className="font-dl-display text-4xl font-extrabold text-dl-ink">Custom</span>
                <span className="block text-sm text-dl-muted">Let's talk about your setup.</span>
              </div>
              <ul className="space-y-2.5 mb-6 grow">
                {SELF_HOSTED_FEATURES.map((f) => <Feature key={f}>{f}</Feature>)}
              </ul>
              <button
                onClick={() => navigateTo('/contact')}
                className="w-full py-3 rounded-xl border border-dl-hair text-sm font-semibold text-dl-ink hover:border-dl-teal hover:text-dl-teal transition-colors"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
