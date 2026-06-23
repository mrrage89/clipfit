import { describe, it, expect } from 'vitest';
import { buildMakeItFitArgs } from '../src/jobs/makeItFit';

const SCALE =
  "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2";

describe('buildMakeItFitArgs', () => {
  it('builds a single-pass command with downscale and audio', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'input.mp4',
      outputName: 'output.mp4',
      videoKbps: 3000,
      audioKbps: 128,
    });
    expect(passes).toEqual([
      [
        '-i', 'input.mp4',
        '-vf', SCALE,
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-b:v', '3000k',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ],
    ]);
  });

  it('strips audio with -an when audioKbps is 0', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'input.mp4',
      outputName: 'output.mp4',
      videoKbps: 3000,
      audioKbps: 0,
    });
    expect(passes[0]).toContain('-an');
    expect(passes[0]).not.toContain('-c:a');
  });

  it('honors a custom maxDimension and preset', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'in.mp4',
      outputName: 'out.mp4',
      videoKbps: 1000,
      audioKbps: 128,
      maxDimension: 720,
      preset: 'medium',
    });
    expect(passes[0].join(' ')).toContain("scale='min(720,iw)'");
    expect(passes[0].join(' ')).toContain('-preset medium');
  });

  it('two-pass returns an analyze pass and an encode pass', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'in.mp4',
      outputName: 'out.mp4',
      videoKbps: 3000,
      audioKbps: 128,
      twoPass: true,
    });
    expect(passes).toHaveLength(2);
    expect(passes[0].join(' ')).toContain('-pass 1');
    expect(passes[0]).toContain('-an');
    expect(passes[1].join(' ')).toContain('-pass 2');
  });

  it('adds x264 aq-mode params when provided', () => {
    const a = buildMakeItFitArgs({
      inputName: 'in.mp4',
      outputName: 'out.mp4',
      videoKbps: 1000,
      audioKbps: 128,
      aqMode: 3,
    })[0];
    const i = a.indexOf('-x264-params');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(a[i + 1]).toBe('aq-mode=3');
  });

  it('omits aq-mode params by default', () => {
    const a = buildMakeItFitArgs({
      inputName: 'in.mp4',
      outputName: 'out.mp4',
      videoKbps: 1000,
      audioKbps: 128,
    })[0];
    expect(a).not.toContain('-x264-params');
  });
});
