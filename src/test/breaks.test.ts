import { describe, it, expect } from 'vitest';
import { totalBreakMinutes, formatBreakMinutes, AttendanceBreak } from '../services/break.service';

/** Attendance breaks — total time across multiple breaks in one session (migration 0045). */
const br = (start: string, end?: string): AttendanceBreak => ({
  id: start, attendanceId: 'a', employeeId: 'e', startTime: start, endTime: end,
});

describe('totalBreakMinutes', () => {
  it('adds up several finished breaks', () => {
    const breaks = [
      br('2026-10-24T06:00:00Z', '2026-10-24T06:15:00Z'),
      br('2026-10-24T08:00:00Z', '2026-10-24T08:45:00Z'),
    ];
    expect(totalBreakMinutes(breaks)).toBe(60);
  });

  it('counts a running break up to now', () => {
    const now = new Date('2026-10-24T10:20:00Z');
    expect(totalBreakMinutes([br('2026-10-24T10:00:00Z')], now)).toBe(20);
  });

  it('is zero with no breaks', () => {
    expect(totalBreakMinutes([])).toBe(0);
  });
});

describe('formatBreakMinutes', () => {
  it('formats minutes and hours', () => {
    expect(formatBreakMinutes(45)).toBe('45m');
    expect(formatBreakMinutes(75)).toBe('1h 15m');
  });
});
