import { describe, it, expect } from 'vitest';
import { buildEditChain, effectiveDurationSec } from '../src/jobs/editChain';

describe('buildEditChain', () => {
  it('is empty for no edits', () => {
    expect(buildEditChain(undefined, true)).toEqual({ seek: [], vf: [], af: [] });
  });
  it('builds trim seek + ordered video filters + audio filters', () => {
    const c = buildEditChain(
      {
        trim: { startSec: 2, endSec: 7 },
        crop: { x: 1, y: 2, w: 10, h: 20 },
        rotate: 90,
        flipH: true,
        speed: 2,
        fps: 24,
        volumeDb: -3,
      },
      true,
    );
    expect(c.seek).toEqual(['-ss', '2', '-t', '5']);
    expect(c.vf).toEqual(['crop=10:20:1:2', 'transpose=1', 'hflip', 'setpts=PTS/2', 'fps=24']);
    expect(c.af).toEqual(['atempo=2', 'volume=-3dB']);
  });
  it('drops audio filters when the source has no audio', () => {
    expect(buildEditChain({ volumeDb: 5, speed: 1.5 }, false).af).toEqual([]);
  });
  it('rotate 180 is two transposes; 270 is transpose=2', () => {
    expect(buildEditChain({ rotate: 180 }, false).vf).toEqual(['transpose=1', 'transpose=1']);
    expect(buildEditChain({ rotate: 270 }, false).vf).toEqual(['transpose=2']);
  });
});

describe('effectiveDurationSec', () => {
  it('returns full duration with no edits', () => {
    expect(effectiveDurationSec(60)).toBe(60);
  });
  it('uses the trim length', () => {
    expect(effectiveDurationSec(60, { trim: { startSec: 10, endSec: 25 } })).toBe(15);
  });
  it('divides by speed (trim + speed)', () => {
    expect(effectiveDurationSec(60, { trim: { startSec: 0, endSec: 20 }, speed: 2 })).toBe(10);
  });
});
