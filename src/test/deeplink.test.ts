import { describe, it, expect, afterEach } from 'vitest';
import { getCurrentRoute, buildHash } from '../utils/deeplink';

/**
 * Deep links: a URL hash restores the page (bookmarks, refresh, redirects such as the payment
 * return to #/upgrade). parseHash used to strip the '#' and then match patterns that start with
 * '#', so no hash ever matched.
 */
const at = (hash: string) => {
  window.location.hash = hash;
  return getCurrentRoute();
};

afterEach(() => { window.location.hash = ''; });

describe('getCurrentRoute', () => {
  it('matches simple routes', () => {
    expect(at('#/profile')).toEqual({ path: 'profile', params: null });
    expect(at('#/upgrade')).toEqual({ path: 'upgrade', params: null });
    expect(at('#/attendance-audit')).toEqual({ path: 'attendance-audit', params: null });
  });

  it('extracts route params', () => {
    expect(at('#/leave/abc123')).toEqual({ path: 'leave', params: { openLeaveId: 'abc123' } });
    expect(at('#/employee/e-1')).toEqual({ path: 'employees', params: { selectedEmployeeId: 'e-1' } });
  });

  it('routes Super Admin sections', () => {
    expect(at('#/super-admin/payments')).toEqual({ path: 'super-admin', params: { tab: 'payments' } });
    expect(at('#/super-admin')).toEqual({ path: 'super-admin', params: null });
  });

  it('ignores unknown and auth hashes', () => {
    expect(at('#/nope')).toBeNull();
    expect(at('#access_token=x&type=recovery')).toBeNull();
    expect(at('')).toBeNull();
  });
});

describe('buildHash round-trips', () => {
  it('super-admin with and without a tab', () => {
    expect(buildHash('super-admin', { tab: 'blog' })).toBe('#/super-admin/blog');
    expect(buildHash('super-admin')).toBe('#/super-admin');
  });
});
