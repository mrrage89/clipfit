import { describe, it, expect } from 'vitest';
import { fitJob } from '../src/jobs/fit';

const ctx = { durationSec: 60, width: 1920, height: 1080, hasAudio: true };

describe('fitJob.buildPasses', () => {
  it('balanced: single pass, computed bitrate, keeps audio', () => {
    const passes = fitJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      targetBytes: 25 * 1024 * 1024,
      mute: false,
      quality: 'balanced',
    });
    expect(passes).toHaveLength(1);
    const a = passes[0];
    expect(a[a.indexOf('-b:v') + 1]).toBe('3192k');
    expect(a).toContain('-c:a');
  });

  it('strips audio when muted', () => {
    const a = fitJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      targetBytes: 25 * 1024 * 1024,
      mute: true,
      quality: 'balanced',
    })[0];
    expect(a).toContain('-an');
    expect(a).not.toContain('-c:a');
  });

  it('best: two passes (analyze + encode)', () => {
    const passes = fitJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      targetBytes: 25 * 1024 * 1024,
      mute: false,
      quality: 'best',
    });
    expect(passes).toHaveLength(2);
    expect(passes[0].join(' ')).toContain('-pass 1');
    expect(passes[1].join(' ')).toContain('-pass 2');
  });
});
