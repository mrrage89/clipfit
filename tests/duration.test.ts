import { describe, it, expect } from 'vitest';
import { parseDurationSec } from '../src/lib/duration';

describe('parseDurationSec', () => {
  it('parses HH:MM:SS.ss from a real ffmpeg line', () => {
    const line = '  Duration: 00:01:23.45, start: 0.000000, bitrate: 1200 kb/s';
    expect(parseDurationSec([line])).toBeCloseTo(83.45, 2);
  });

  it('returns null when duration is N/A', () => {
    expect(parseDurationSec(['  Duration: N/A, start: 0.000000, bitrate: N/A'])).toBeNull();
  });

  it('returns null when no Duration line is present', () => {
    expect(parseDurationSec(['Input #0, mov,mp4', 'Stream #0:0: Video: h264'])).toBeNull();
  });

  it('finds the first Duration among many lines', () => {
    expect(parseDurationSec(['noise', '  Duration: 00:00:10.00, bitrate: 500 kb/s', 'more'])).toBe(10);
  });
});
