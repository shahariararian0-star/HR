import { describe, it, expect } from 'vitest';
import { calculateEmployeeSummaries } from '../utils/attendanceUtils';

/** Reports → Employee Summary: total hours worked per employee for the period. */
const base = {
  approvedLeaves: [],
  shifts: [],
  shiftOverrides: [],
  appConfig: { workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] } as any,
  holidays: [],
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  selectedDepts: [],
  employeeFilter: 'All Employees',
};

const employees = [
  { id: 'e1', name: 'Asha', department: 'Ops', designation: 'Clerk', status: 'ACTIVE' },
  { id: 'e2', name: 'Rafi', department: 'Ops', designation: 'Clerk', status: 'ACTIVE' },
] as any[];

describe('calculateEmployeeSummaries — hours worked', () => {
  it('sums check-in to check-out per employee and skips days without a check-out', () => {
    const [asha, rafi] = calculateEmployeeSummaries({
      ...base,
      employees,
      consolidatedAttendance: [
        { id: '1', employeeId: 'e1', date: '2026-10-05', checkIn: '09:00', checkOut: '17:30', status: 'PRESENT' },
        { id: '2', employeeId: 'e1', date: '2026-10-06', checkIn: '09:15', checkOut: '17:00', status: 'LATE' },
        { id: '3', employeeId: 'e1', date: '2026-10-07', checkIn: '09:00', status: 'PRESENT' }, // still checked in
        { id: '4', employeeId: 'e2', date: '2026-10-05', checkIn: '22:00', checkOut: '06:00', status: 'PRESENT' }, // night shift
        { id: '5', employeeId: 'e1', date: '2026-09-30', checkIn: '09:00', checkOut: '18:00', status: 'PRESENT' }, // outside period
      ] as any[],
    });

    expect(asha.employeeName).toBe('Asha');
    expect(asha.workedMinutes).toBe(510 + 465);
    expect(asha.workedDays).toBe(2);
    expect(rafi.workedMinutes).toBe(480);
    expect(rafi.workedDays).toBe(1);
  });

  it('is zero for an employee with no records', () => {
    const [asha] = calculateEmployeeSummaries({ ...base, employees: [employees[0]], consolidatedAttendance: [] });
    expect(asha.workedMinutes).toBe(0);
    expect(asha.workedDays).toBe(0);
  });
});
