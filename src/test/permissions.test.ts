import { describe, it, expect } from 'vitest';
import { can, assignableRoles, canManageAccount, DEFAULT_HR_PERMISSIONS } from '../utils/permissions';

describe('can()', () => {
  it('gives the Owner and Super Admin every module', () => {
    expect(can({ role: 'ADMIN' }, 'billing')).toBe(true);
    expect(can({ role: 'SUPER_ADMIN' }, 'settings')).toBe(true);
  });

  it('gives HR only the modules in their list', () => {
    const hr = { role: 'HR', permissions: ['employees', 'leave'] };
    expect(can(hr, 'employees')).toBe(true);
    expect(can(hr, 'reports')).toBe(false);
  });

  it('treats a null list as every module (HR created before access lists)', () => {
    expect(can({ role: 'HR', permissions: null }, 'billing')).toBe(true);
  });

  it('treats a list that has not loaded yet as no access', () => {
    expect(can({ role: 'HR' }, 'employees')).toBe(false);
  });

  it('gives staff no admin modules', () => {
    expect(can({ role: 'MANAGER' }, 'employees')).toBe(false);
    expect(can({ role: 'EMPLOYEE' }, 'leave')).toBe(false);
  });
});

describe('assignableRoles()', () => {
  it('lets the Owner assign HR and Owner', () => {
    expect(assignableRoles({ role: 'ADMIN' })).toEqual(expect.arrayContaining(['HR', 'ADMIN', 'TEAM_LEAD']));
  });

  it('lets HR assign staff roles only', () => {
    const roles = assignableRoles({ role: 'HR', permissions: ['employees'] });
    expect(roles).toEqual(expect.arrayContaining(['EMPLOYEE', 'TEAM_LEAD', 'MANAGER', 'MANAGEMENT']));
    expect(roles).not.toContain('HR');
    expect(roles).not.toContain('ADMIN');
  });

  it('gives HR without Team Directory access nothing to assign', () => {
    expect(assignableRoles({ role: 'HR', permissions: ['leave'] })).toEqual([]);
  });
});

describe('canManageAccount()', () => {
  it('stops HR from managing Owner and HR accounts', () => {
    const hr = { role: 'HR', permissions: null };
    expect(canManageAccount(hr, 'ADMIN')).toBe(false);
    expect(canManageAccount(hr, 'HR')).toBe(false);
    expect(canManageAccount(hr, 'TEAM_LEAD')).toBe(true);
  });

  it('protects Super Admin from everyone else', () => {
    expect(canManageAccount({ role: 'ADMIN' }, 'SUPER_ADMIN')).toBe(false);
  });
});

it('new HR accounts get every module except billing by default', () => {
  expect(DEFAULT_HR_PERMISSIONS).not.toContain('billing');
  expect(DEFAULT_HR_PERMISSIONS).toContain('employees');
});
