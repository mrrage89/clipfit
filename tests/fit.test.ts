import { describe, it, expect } from 'vitest';
import { fitJob } from '../src/jobs/fit';

const ctx = { durationSec: 60, width: 1920, height: 1080, hasAudio: true };

describe('fitJob.buildPasses', () => {
  it('computes the video bitrate from ctx duration and keeps audio', () => {
    const args = fitJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      targetBytes: 25 * 1024 * 1024,
      mute: false,
    })[0];
    // 25MB, 60s, 128k audio, 0.95 margin -> 3192 kbps (see bitrate.test.ts)
    expect(args[args.indexOf('-b:v') + 1]).toBe('3192k');
    expect(args).toContain('-c:a');
  });

  it('strips audio when muted', () => {
    const args = fitJob.buildPasses('in.mp4', 'out.mp4', ctx, {
      targetBytes: 25 * 1024 * 1024,
      mute: true,
    })[0];
    expect(args).toContain('-an');
    expect(args).not.toContain('-c:a');
  });
});
