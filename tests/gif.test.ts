import { describe, it, expect } from 'vitest';
import { gifJob } from '../src/jobs/gif';
import type { ProbeResult } from '../src/lib/probe';

const ctx: ProbeResult = { durationSec: 102, width: 1080, height: 1920, hasAudio: true };

describe('gifJob', () => {
  it('builds two palette passes with fps + scale', () => {
    const passes = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 12, width: 480 });
    expect(passes).toHaveLength(2);
    expect(passes[0].join(' ')).toContain('fps=12,scale=480:-1:flags=lanczos');
    expect(passes[0].join(' ')).toContain('palettegen');
    expect(passes[1].join(' ')).toContain('paletteuse');
  });

  it('caps duration with -t before the input on both passes when lengthSec is given', () => {
    const passes = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 12, width: 480, lengthSec: 5 });
    for (const pass of passes) {
      const t = pass.indexOf('-t');
      expect(t).toBeGreaterThanOrEqual(0);
      expect(pass[t + 1]).toBe('5');
      expect(t).toBeLessThan(pass.indexOf('-i')); // input option, before -i
    }
  });

  it('seeks with -ss before the input when startSec is given', () => {
    const passes = gifJob.buildPasses('in.mp4', 'out.gif', ctx, {
      fps: 12,
      width: 480,
      startSec: 3,
      lengthSec: 5,
    });
    for (const pass of passes) {
      const s = pass.indexOf('-ss');
      expect(s).toBeGreaterThanOrEqual(0);
      expect(pass[s + 1]).toBe('3');
      expect(s).toBeLessThan(pass.indexOf('-i'));
    }
  });

  it('omits -ss/-t when no trim is given (back-compat)', () => {
    const passes = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 12, width: 480 });
    for (const pass of passes) {
      expect(pass).not.toContain('-ss');
      expect(pass).not.toContain('-t');
    }
  });

  it('reduces palette with max_colors when maxColors < 256', () => {
    const passes = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 10, width: 480, maxColors: 64 });
    expect(passes[0].join(' ')).toContain('palettegen=max_colors=64');
  });

  it('uses the full palette (no max_colors) by default', () => {
    const passes = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 10, width: 480 });
    expect(passes[0].join(' ')).not.toContain('max_colors');
  });

  it('applies the chosen dither mode', () => {
    const none = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 10, width: 480, dither: 'none' });
    expect(none[1].join(' ')).toContain('paletteuse=dither=none');
    const bayer = gifJob.buildPasses('in.mp4', 'out.gif', ctx, { fps: 10, width: 480, dither: 'bayer' });
    expect(bayer[1].join(' ')).toContain('dither=bayer');
  });
});
