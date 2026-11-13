import type { Role } from '../types';

/**
 * Role hierarchy and per-HR access (migration 0049).
 *
 *   ADMIN = the company Owner: full access; the only role that creates Owner and HR accounts.
 *   HR    = access limited to the modules in `permissions` (null / undefined = all modules).
 *   Staff = TEAM_LEAD, MANAGER, MANAGEMENT, EMPLOYEE.
 *
 * The database enforces the same rules (public.has_permission, profiles_guard), so these
 * helpers only decide what the app shows.
 */

export type ModuleKey =
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'announcements'
  | 'notifications'
  | 'performance'
  | 'organization'
  | 'reports'
  | 'settings'
  | 'billing';

export const MODULES: { key: ModuleKey; label: string; hint: string }[] = [
  { key: 'employees', label: 'Team Directory', hint: 'Add, edit and remove staff' },
  { key: 'attendance', label: 'Attendance Audit', hint: 'See and correct attendance' },
  { key: 'leave', label: 'Leave', hint: 'Final leave approval and leave records' },
  { key: 'announcements', label: 'Announcements', hint: 'Post and manage announcements' },
  { key: 'notifications', label: 'Notifications', hint: 'Send notifications to staff' },
  { key: 'performance', label: 'Performance', hint: 'Manage review cycles' },
  { key: 'organization', label: 'Organization', hint: 'Departments, teams, shifts, holidays, check-in rules' },
  { key: 'reports', label: 'Reports', hint: 'Download reports' },
  { key: 'settings', label: 'Settings', hint: 'Company settings' },
  { key: 'billing', label: 'Billing', hint: 'Upgrade plan and payments' },
];

/** Default access for a new HR account: everything except billing. */
export const DEFAULT_HR_PERMISSIONS: ModuleKey[] = MODULES.map(m => m.key).filter(k => k !== 'billing');

export const STAFF_ROLES: Role[] = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER', 'MANAGEMENT'];

type PermissionUser = { role?: string | null; permissions?: string[] | null } | null | undefined;

/** Can this user use the module? Owner and Super Admin: always. HR: per their access list. */
export function can(user: PermissionUser, key: ModuleKey): boolean {
  if (!user?.role) return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  // HR: null = every module (accounts from before access lists); undefined = not loaded yet,
  // so nothing until App.tsx fills it in.
  if (user.role === 'HR') {
    if (user.permissions === undefined) return false;
    return user.permissions === null || user.permissions.includes(key);
  }
  return false;
}

/** Owner, or HR with the module: the "admin side" of a page. */
export const isOwner = (user: PermissionUser): boolean => user?.role === 'ADMIN';

/** Roles this user may give to someone in the Team Directory form. */
export function assignableRoles(user: PermissionUser): Role[] {
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return [...STAFF_ROLES, 'HR', 'ADMIN'];
  if (user?.role === 'HR' && can(user, 'employees')) return [...STAFF_ROLES];
  return [];
}

/** May this user open the edit form for an account with this role? */
export function canManageAccount(user: PermissionUser, targetRole: string | undefined): boolean {
  if (targetRole === 'SUPER_ADMIN') return user?.role === 'SUPER_ADMIN';
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') return true;
  if (user?.role === 'HR' && can(user, 'employees')) return targetRole !== 'ADMIN' && targetRole !== 'HR';
  return false;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Owner (full access)',
  HR: 'HR',
  MANAGEMENT: 'Management',
  MANAGER: 'Manager',
  TEAM_LEAD: 'Team Leader',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Super Admin',
};
