import { describe, it, expect } from 'vitest';
import { videoKbpsForCopiedAudio } from '../src/engine/webcodecs/budget';

describe('videoKbpsForCopiedAudio', () => {
  it('budgets remaining bytes to video after subtracting audio', () => {
    // 10s; 10MiB * 0.95 = 9,961,472 usable, minus 0.5MiB (524,288) audio = 9,437,184
    // video bytes; * 8 / 1000 / 10 = 7549.7 -> floor 7549 kbps
    const kbps = videoKbpsForCopiedAudio({
      targetBytes: 10 * 1024 * 1024,
      durationSec: 10,
      audioBytes: 0.5 * 1024 * 1024,
      safetyMargin: 0.95,
    });
    expect(kbps).toBe(7549);
  });
  it('returns 0 when audio alone exceeds the budget (caller falls back)', () => {
    expect(
      videoKbpsForCopiedAudio({
        targetBytes: 1 * 1024 * 1024,
        durationSec: 10,
        audioBytes: 2 * 1024 * 1024,
        safetyMargin: 0.95,
      }),
    ).toBe(0);
  });
  it('returns 0 for non-positive duration', () => {
    expect(
      videoKbpsForCopiedAudio({
        targetBytes: 10 * 1024 * 1024,
        durationSec: 0,
        audioBytes: 0,
        safetyMargin: 0.95,
      }),
    ).toBe(0);
  });
});
