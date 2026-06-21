import { describe, it, expect } from 'vitest';
import { studioJob } from '../src/jobs/studio';
import { thumbTimes, nearestThumb } from '../src/lib/filmstrip';

const ctx = { durationSec: 60, width: 1920, height: 1080, hasAudio: true };

describe('studioJob (combined single pass)', () => {
  it('trim-only → input-seek + stream copy (no re-encode)', () => {
    const a = studioJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      trim: { startSec: 5, endSec: 15 },
    })[0];
    expect(a[a.indexOf('-ss') + 1]).toBe('5');
    expect(a[a.indexOf('-t') + 1]).toBe('10');
    expect(a.join(' ')).toContain('-c:v copy');
    expect(a.join(' ')).toContain('-c:a copy');
  });

  it('crop + rotate + speed compose into one -vf/-af pass', () => {
    const a = studioJob
      .buildPasses('in.mp4', 'out.mp4', ctx, {
        crop: { x: 10, y: 20, w: 100, h: 200 },
        edit: { rotate: 90, speed: 2 },
      })[0]
      .join(' ');
    expect(a).toContain('crop=100:200:10:20');
    expect(a).toContain('transpose=1');
    expect(a).toContain('setpts=PTS/2');
    expect(a).toContain('atempo=2');
    expect(a).toContain('libx264');
  });

  it('trim + crop together: seek before -i, crop in -vf', () => {
    const a = studioJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      trim: { startSec: 2, endSec: 8 },
      crop: { x: 0, y: 0, w: 640, h: 480 },
    })[0];
    expect(a.indexOf('-ss')).toBeLessThan(a.indexOf('-i'));
    expect(a.join(' ')).toContain('crop=640:480:0:0');
  });
});

describe('filmstrip math', () => {
  it('thumbTimes spans 0..duration', () => {
    const t = thumbTimes(100, 11);
    expect(t[0]).toBe(0);
    expect(t[10]).toBe(100);
    expect(t[5]).toBe(50);
  });
  it('nearestThumb maps a time to the closest index', () => {
    expect(nearestThumb(0, 100, 11)).toBe(0);
    expect(nearestThumb(50, 100, 11)).toBe(5);
    expect(nearestThumb(100, 100, 11)).toBe(10);
    expect(nearestThumb(94, 100, 11)).toBe(9);
  });
});
