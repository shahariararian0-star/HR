import { describe, it, expect } from 'vitest';
import { tierMonths, bestSaving } from '../utils/planPricing';
import type { PaymentTier } from '../services/paymentSettings.service';

const tier = (id: PaymentTier['id'], amount: number, duration: string): PaymentTier => ({ id, amount, duration, enabled: true });

describe('tierMonths', () => {
  it('reads months and years from the free-text duration', () => {
    expect(tierMonths('3 months')).toBe(3);
    expect(tierMonths('6 Months')).toBe(6);
    expect(tierMonths('1 year')).toBe(12);
    expect(tierMonths('2 years')).toBe(24);
  });

  it('returns null for lifetime and unknown text', () => {
    expect(tierMonths('Lifetime')).toBeNull();
    expect(tierMonths('forever')).toBeNull();
  });
});

describe('bestSaving', () => {
  it('is zero when every tier costs the same per month', () => {
    expect(bestSaving([tier('TIER_3MO', 5, '3 months'), tier('TIER_6MO', 10, '6 months'), tier('TIER_1YR', 20, '1 year')])).toBe(0);
  });

  it('compares the cheapest monthly rate against the shortest tier', () => {
    // 3 months at 6 = 2/month; 1 year at 18 = 1.5/month -> 25% cheaper
    expect(bestSaving([tier('TIER_3MO', 6, '3 months'), tier('TIER_1YR', 18, '1 year')])).toBe(25);
  });

  it('ignores lifetime tiers and needs at least two timed tiers', () => {
    expect(bestSaving([tier('TIER_1YR', 20, '1 year'), tier('TIER_LIFETIME', 50, 'Lifetime')])).toBe(0);
  });
});
