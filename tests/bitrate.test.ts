import { describe, it, expect } from 'vitest';
import { computeVideoKbps } from '../src/jobs/bitrate';

describe('computeVideoKbps', () => {
  it('splits the budget between video and audio with a safety margin', () => {
    // 25 MB target, 60s, 128kbps audio, margin 0.95
    // totalBits = 25*1024*1024*8*0.95 = 199,229,440
    // audioBits = 128*1000*60 = 7,680,000
    // videoKbps = (199,229,440 - 7,680,000)/60/1000 = 3192.49 -> floor 3192
    expect(
      computeVideoKbps({ targetBytes: 25 * 1024 * 1024, durationSec: 60, audioKbps: 128 }),
    ).toBe(3192);
  });

  it('uses the full budget for video when audio is stripped (0 kbps)', () => {
    // 199,229,440/60/1000 = 3320.49 -> 3320
    expect(
      computeVideoKbps({ targetBytes: 25 * 1024 * 1024, durationSec: 60, audioKbps: 0 }),
    ).toBe(3320);
  });

  it('never returns below the minimum video bitrate', () => {
    expect(
      computeVideoKbps({ targetBytes: 1 * 1024 * 1024, durationSec: 600, audioKbps: 128 }),
    ).toBe(100); // default minVideoKbps
  });

  it('throws on non-positive duration', () => {
    expect(() => computeVideoKbps({ targetBytes: 1024, durationSec: 0, audioKbps: 0 })).toThrow();
  });
});
