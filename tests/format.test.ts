import { describe, it, expect } from 'vitest';
import { humanizeBytes } from '../src/lib/format';

describe('humanizeBytes', () => {
  it('formats MB', () => expect(humanizeBytes(25 * 1024 * 1024)).toBe('25.0 MB'));
  it('formats KB', () => expect(humanizeBytes(2048)).toBe('2.0 KB'));
});
