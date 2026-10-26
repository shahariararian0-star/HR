import { describe, it, expect } from 'vitest';
import { calculateWorkedMinutes, formatWorkedMinutes } from '../utils/attendanceUtils';

/** Hours worked from check-in to check-out, shown on attendance rows and the dashboard. */
describe('calculateWorkedMinutes', () => {
  it('counts a normal day', () => {
    expect(calculateWorkedMinutes('09:00', '17:30')).toBe(510);
  });

  it('handles a night shift that ends after midnight', () => {
    expect(calculateWorkedMinutes('22:00', '06:00')).toBe(480);
  });

  it('is zero for an instant check-out', () => {
    expect(calculateWorkedMinutes('09:00', '09:00')).toBe(0);
  });

  it('returns null while still checked in or when a time is missing', () => {
    expect(calculateWorkedMinutes('09:00', '')).toBeNull();
    expect(calculateWorkedMinutes('09:00', undefined)).toBeNull();
    expect(calculateWorkedMinutes('-', '17:00')).toBeNull();
  });
});

describe('formatWorkedMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatWorkedMinutes(510)).toBe('8h 30m');
    expect(formatWorkedMinutes(45)).toBe('45m');
    expect(formatWorkedMinutes(0)).toBe('0m');
  });
});
