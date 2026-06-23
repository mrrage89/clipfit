import { describe, it, expect } from 'vitest';
import { fitJob, bestPreset } from '../src/jobs/fit';
import type { Edits } from '../src/jobs/editChain';

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

describe('bestPreset', () => {
  it('uses a slower x264 preset for shorter clips, bounded for long ones', () => {
    expect(bestPreset(10)).toBe('veryslow');
    expect(bestPreset(20)).toBe('veryslow');
    expect(bestPreset(45)).toBe('slower');
    expect(bestPreset(60)).toBe('slower');
    expect(bestPreset(120)).toBe('slow');
  });
});

describe('fitJob preset wiring', () => {
  it('best uses the duration-adaptive preset', () => {
    const short = { durationSec: 10, width: 1920, height: 1080, hasAudio: true };
    const passes = fitJob.buildPasses('in.mp4', 'out.mp4', short, {
      targetBytes: 25 * 1024 * 1024,
      mute: false,
      quality: 'best',
    });
    expect(passes[1].join(' ')).toContain('-preset veryslow');
  });
  it('balanced still uses the fast preset', () => {
    const a = fitJob.buildPasses(
      'in.mp4',
      'out.mp4',
      { durationSec: 60, width: 1920, height: 1080, hasAudio: true },
      { targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced' },
    )[0];
    expect(a.join(' ')).toContain('-preset fast');
  });
});

describe('fitJob edits + format', () => {
  const ctx2 = { durationSec: 60, width: 1920, height: 1080, hasAudio: true };
  const bps = (p: string[][]) => Number(p[0][p[0].indexOf('-b:v') + 1].replace('k', ''));

  it('budgets bitrate from the trimmed duration', () => {
    const edits: Edits = { trim: { startSec: 0, endSec: 30 } }; // half the clip
    const full = fitJob.buildPasses('in.mp4', 'out.mp4', ctx2, {
      targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced', format: 'mp4',
    });
    const trimmed = fitJob.buildPasses('in.mp4', 'out.mp4', ctx2, {
      targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced', format: 'mp4', edits,
    });
    expect(bps(trimmed)).toBeGreaterThan(bps(full)); // shorter clip -> more kbps for the same size
    expect(trimmed[0].slice(0, 2)).toEqual(['-ss', '0']);
  });

  it('webm format selects the webm output + vp9', () => {
    const out = fitJob.output({ targetBytes: 1, mute: false, quality: 'balanced', format: 'webm' });
    expect(out.downloadName.endsWith('.webm')).toBe(true);
    const a = fitJob.buildPasses('in.mp4', out.name, ctx2, {
      targetBytes: 25 * 1024 * 1024, mute: false, quality: 'balanced', format: 'webm',
    });
    expect(a[0].join(' ')).toContain('libvpx-vp9');
  });
});
