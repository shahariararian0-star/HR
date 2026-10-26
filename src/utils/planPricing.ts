import type { PaymentTier } from '../services/paymentSettings.service';

// Helpers for showing Super Admin plan tiers on the landing page.

/** Months a tier covers, from its free-text duration ("3 months", "1 year"); null for lifetime. */
export function tierMonths(duration: string): number | null {
  const m = duration.match(/(\d+)\s*(month|year)/i);
  if (!m) return null;
  return Number(m[1]) * (m[2].toLowerCase() === 'year' ? 12 : 1);
}

/** Largest saving per month of any timed tier against the shortest one, as a whole percent. */
export function bestSaving(tiers: PaymentTier[]): number {
  const timed = tiers
    .map((t) => ({ months: tierMonths(t.duration), amount: t.amount }))
    .filter((t): t is { months: number; amount: number } => t.months !== null && t.months > 0 && t.amount > 0)
    .sort((a, b) => a.months - b.months);
  if (timed.length < 2) return 0;
  const base = timed[0].amount / timed[0].months;
  const best = Math.min(...timed.map((t) => t.amount / t.months));
  return Math.floor((1 - best / base) * 100);
}
