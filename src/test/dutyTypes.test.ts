import { describe, it, expect } from 'vitest';
import { getEnabledDutyTypes, getDutyLabel } from '../utils/dutyTypes';

/** Active duty types chosen by the organization admin (Organization → System → Duty Types). */
describe('getEnabledDutyTypes', () => {
  it('defaults to both when the setting was never saved', () => {
    expect(getEnabledDutyTypes(null)).toEqual(['OFFICE', 'FACTORY']);
    expect(getEnabledDutyTypes({})).toEqual(['OFFICE', 'FACTORY']);
    expect(getEnabledDutyTypes({ enabledDutyTypes: [] })).toEqual(['OFFICE', 'FACTORY']);
  });

  it('returns only the active ones, in a stable order', () => {
    expect(getEnabledDutyTypes({ enabledDutyTypes: ['FACTORY'] })).toEqual(['FACTORY']);
    expect(getEnabledDutyTypes({ enabledDutyTypes: ['OFFICE'] })).toEqual(['OFFICE']);
    expect(getEnabledDutyTypes({ enabledDutyTypes: ['FACTORY', 'OFFICE'] })).toEqual(['OFFICE', 'FACTORY']);
  });

  it('ignores unknown values', () => {
    expect(getEnabledDutyTypes({ enabledDutyTypes: ['REMOTE' as any] })).toEqual(['OFFICE', 'FACTORY']);
  });
});

describe('getDutyLabel', () => {
  it('uses custom labels with defaults', () => {
    expect(getDutyLabel({ dutyLabel2: 'Field' }, 'FACTORY')).toBe('Field');
    expect(getDutyLabel(null, 'OFFICE')).toBe('Office');
  });
});
