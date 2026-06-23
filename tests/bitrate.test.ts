import { describe, it, expect } from 'vitest';
import { computeVideoKbps, pickMaxDimension } from '../src/jobs/bitrate';

describe('computeVideoKbps', () => {
  it('splits the budget between video and audio with a safety margin', () => {
    expect(
      computeVideoKbps({ targetBytes: 25 * 1024 * 1024, durationSec: 60, audioKbps: 128 }),
    ).toBe(3192);
  });

  it('uses the full budget for video when audio is stripped (0 kbps)', () => {
    expect(
      computeVideoKbps({ targetBytes: 25 * 1024 * 1024, durationSec: 60, audioKbps: 0 }),
    ).toBe(3320);
  });

  it('never returns below the minimum video bitrate', () => {
    expect(
      computeVideoKbps({ targetBytes: 1 * 1024 * 1024, durationSec: 600, audioKbps: 128 }),
    ).toBe(100);
  });

  it('throws on non-positive duration', () => {
    expect(() => computeVideoKbps({ targetBytes: 1024, durationSec: 0, audioKbps: 0 })).toThrow();
  });
});

describe('pickMaxDimension', () => {
  it('caps resolution lower as bitrate drops (blocking is worse than softness)', () => {
    expect(pickMaxDimension(4000)).toBe(1920);
    expect(pickMaxDimension(2000)).toBe(1280);
    expect(pickMaxDimension(1000)).toBe(854);
    expect(pickMaxDimension(500)).toBe(640);
    expect(pickMaxDimension(300)).toBe(480);
  });
});
