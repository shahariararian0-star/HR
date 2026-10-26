import { AppConfig } from '../types';

export type DutyType = 'OFFICE' | 'FACTORY';

export const ALL_DUTY_TYPES: DutyType[] = ['OFFICE', 'FACTORY'];

/**
 * Duty types the organization admin has switched on (Organization → System → Duty Types).
 * Missing or empty means both, so organizations that never touched the setting keep both options.
 */
export function getEnabledDutyTypes(config: Pick<AppConfig, 'enabledDutyTypes'> | null | undefined): DutyType[] {
  const enabled = (config?.enabledDutyTypes || []).filter((t): t is DutyType => ALL_DUTY_TYPES.includes(t as DutyType));
  return enabled.length > 0 ? ALL_DUTY_TYPES.filter(t => enabled.includes(t)) : ALL_DUTY_TYPES;
}

export function getDutyLabel(config: Pick<AppConfig, 'dutyLabel1' | 'dutyLabel2'> | null | undefined, type: DutyType): string {
  return type === 'FACTORY' ? (config?.dutyLabel2 || 'Factory') : (config?.dutyLabel1 || 'Office');
}
