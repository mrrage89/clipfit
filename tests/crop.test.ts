import { describe, it, expect } from 'vitest';
import { cropJob } from '../src/jobs/crop';
import { mapCropToSource } from '../src/lib/cropMath';

const ctx = { durationSec: 10, width: 1920, height: 1080, hasAudio: true };

describe('cropJob', () => {
  it('builds a crop=w:h:x:y filter and copies audio', () => {
    const a = cropJob.buildPasses('in.mp4', 'out.mp4', ctx, { x: 10, y: 20, w: 100, h: 200 })[0];
    expect(a.join(' ')).toContain('crop=100:200:10:20');
    expect(a.join(' ')).toContain('-c:a copy');
  });
});

describe('mapCropToSource', () => {
  it('scales a display rect to source pixels (4x)', () => {
    expect(mapCropToSource({ x: 10, y: 10, w: 100, h: 50 }, 480, 270, 1920, 1080)).toEqual({
      x: 40,
      y: 40,
      w: 400,
      h: 200,
    });
  });

  it('clamps to bounds and forces even dimensions', () => {
    const r = mapCropToSource({ x: 0, y: 0, w: 481, h: 271 }, 480, 270, 1921, 1081);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w % 2).toBe(0);
    expect(r.h % 2).toBe(0);
    expect(r.x + r.w).toBeLessThanOrEqual(1921);
    expect(r.y + r.h).toBeLessThanOrEqual(1081);
  });
});
