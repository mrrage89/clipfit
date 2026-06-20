import { describe, it, expect } from 'vitest';
import { buildMakeItFitArgs } from '../src/jobs/makeItFit';

describe('buildMakeItFitArgs', () => {
  it('builds a single-pass command with audio', () => {
    const passes = buildMakeItFitArgs({
      inputName: 'input.mp4',
      outputName: 'output.mp4',
      videoKbps: 3000,
      audioKbps: 128,
    });
    expect(passes).toEqual([
      [
        '-i', 'input.mp4',
        '-c:v', 'libx264', '-b:v', '3000k',
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
});
