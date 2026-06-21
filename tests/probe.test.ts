import { describe, it, expect } from 'vitest';
import { parseResolution, parseHasAudio } from '../src/lib/probe';

describe('parseResolution', () => {
  it('extracts WxH from a video stream line', () => {
    const lines = [
      '  Stream #0:1: Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv), 720x1280, 1804 kb/s',
    ];
    expect(parseResolution(lines)).toEqual({ width: 720, height: 1280 });
  });

  it('is not fooled by codec hex tags (0x6F637061)', () => {
    const lines = [
      '  Stream #0:0[0x1]: Video: prores (apco / 0x6F637061), yuv422p10le, 1920x1080, 34275 kb/s, SAR 1:1 DAR 16:9',
    ];
    expect(parseResolution(lines)).toEqual({ width: 1920, height: 1080 });
  });

  it('returns null when there is no video stream', () => {
    expect(parseResolution(['  Stream #0:0: Audio: aac, 44100 Hz'])).toBeNull();
  });
});

describe('parseHasAudio', () => {
  it('detects an audio stream', () => {
    expect(parseHasAudio(['Video: h264', '  Stream #0:1: Audio: aac (LC), 44100 Hz'])).toBe(true);
  });
  it('returns false with no audio stream', () => {
    expect(parseHasAudio(['  Stream #0:0: Video: h264, 1920x1080'])).toBe(false);
  });
});
