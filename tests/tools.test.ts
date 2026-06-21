import { describe, it, expect } from 'vitest';
import { gifJob } from '../src/jobs/gif';
import { audioJob } from '../src/jobs/audio';
import { convertJob } from '../src/jobs/convert';
import { trimJob } from '../src/jobs/trim';

const ctx = { durationSec: 30, width: 1920, height: 1080, hasAudio: true };

describe('gifJob', () => {
  it('builds two passes: palettegen then paletteuse', () => {
    const passes = gifJob.buildPasses('in.mp4', gifJob.output({ fps: 12, width: 480 }).name, ctx, {
      fps: 12,
      width: 480,
    });
    expect(passes).toHaveLength(2);
    expect(passes[0].join(' ')).toContain('palettegen');
    expect(passes[1].join(' ')).toContain('paletteuse');
    expect(passes[1]).toContain('palette.png');
  });
});

describe('audioJob', () => {
  it('mp3 → libmp3lame / output.mp3', () => {
    const out = audioJob.output({ format: 'mp3' });
    expect(out.name).toBe('output.mp3');
    expect(audioJob.buildPasses('in.mp4', out.name, ctx, { format: 'mp3' })[0]).toContain('libmp3lame');
  });
  it('wav → pcm_s16le / output.wav', () => {
    const out = audioJob.output({ format: 'wav' });
    expect(out.name).toBe('output.wav');
    expect(audioJob.buildPasses('in.mp4', out.name, ctx, { format: 'wav' })[0]).toContain('pcm_s16le');
  });
});

describe('convertJob', () => {
  it('mp4 → libx264', () => {
    expect(convertJob.buildPasses('in.mkv', 'output.mp4', ctx, { target: 'mp4' })[0]).toContain('libx264');
  });
  it('webm → libvpx-vp9 / video/webm', () => {
    const out = convertJob.output({ target: 'webm' });
    expect(out.mime).toBe('video/webm');
    expect(convertJob.buildPasses('in.mp4', out.name, ctx, { target: 'webm' })[0]).toContain('libvpx-vp9');
  });
});

describe('trimJob', () => {
  it('input-seeks with -ss, duration -t, stream copy', () => {
    const a = trimJob.buildPasses('in.mp4', 'out.mp4', ctx, { startSec: 5, endSec: 12 })[0];
    expect(a[a.indexOf('-ss') + 1]).toBe('5');
    expect(a[a.indexOf('-t') + 1]).toBe('7');
    expect(a).toContain('copy');
  });
});
