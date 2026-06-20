import { describe, it, expect } from 'vitest';
import { licenseGate } from '../src/lib/license';

describe('licenseGate (v1 no-op)', () => {
  it('allows every feature', () => {
    expect(licenseGate.isAllowed('batch')).toBe(true);
    expect(licenseGate.isAllowed('anything')).toBe(true);
  });
});
