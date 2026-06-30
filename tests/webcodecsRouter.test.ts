import { describe, it, expect } from 'vitest';
import { selectCompressEngine } from '../src/engine/webcodecs/router';
import type { CompressRouteInput } from '../src/engine/webcodecs/types';

const ok: CompressRouteInput = {
  quality: 'balanced',
  format: 'mp4',
  hasUnsupportedEdits: false,
  inputContainer: 'mp4',
  inputDecodable: true,
  outputEncodable: true,
  audioOk: true,
};

describe('selectCompressEngine', () => {
  it('picks webcodecs when everything is supported', () => {
    expect(selectCompressEngine(ok)).toBe('webcodecs');
  });
  it('falls back for best/two-pass', () => {
    expect(selectCompressEngine({ ...ok, quality: 'best' })).toBe('ffmpeg');
  });
  it('falls back when unsupported edits are present', () => {
    expect(selectCompressEngine({ ...ok, hasUnsupportedEdits: true })).toBe('ffmpeg');
  });
  it('falls back for non-mp4 input containers', () => {
    expect(selectCompressEngine({ ...ok, inputContainer: 'other' })).toBe('ffmpeg');
  });
  it('falls back when input is not decodable', () => {
    expect(selectCompressEngine({ ...ok, inputDecodable: false })).toBe('ffmpeg');
  });
  it('falls back when output is not encodable', () => {
    expect(selectCompressEngine({ ...ok, outputEncodable: false })).toBe('ffmpeg');
  });
  it('falls back when audio cannot be copied', () => {
    expect(selectCompressEngine({ ...ok, audioOk: false })).toBe('ffmpeg');
  });
});
