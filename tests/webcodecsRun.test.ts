import { it, expect, vi } from 'vitest';
import { runCompressFast } from '../src/engine/webcodecs/run';
import type { CompressRouteInput } from '../src/engine/webcodecs/types';

const route: CompressRouteInput = {
  quality: 'balanced',
  format: 'mp4',
  hasUnsupportedEdits: false,
  inputContainer: 'mp4',
  inputDecodable: true,
  outputEncodable: true,
  audioOk: true,
};
const fastBlob = new Blob(['x']);
const ffmpegBlob = new Blob(['y']);

it('uses webcodecs when it succeeds', async () => {
  const r = await runCompressFast({ route, fast: async () => fastBlob, ffmpeg: async () => ffmpegBlob });
  expect(r.engine).toBe('webcodecs');
  expect(r.blob).toBe(fastBlob);
});

it('falls back to ffmpeg when webcodecs throws', async () => {
  const ffmpeg = vi.fn(async () => ffmpegBlob);
  const r = await runCompressFast({ route, fast: async () => { throw new Error('boom'); }, ffmpeg });
  expect(r.engine).toBe('ffmpeg');
  expect(ffmpeg).toHaveBeenCalledOnce();
});

it('falls back when webcodecs returns an empty blob', async () => {
  const r = await runCompressFast({ route, fast: async () => new Blob([]), ffmpeg: async () => ffmpegBlob });
  expect(r.engine).toBe('ffmpeg');
});

it('skips webcodecs entirely when the route says ffmpeg', async () => {
  const fast = vi.fn(async () => fastBlob);
  const r = await runCompressFast({ route: { ...route, quality: 'best' }, fast, ffmpeg: async () => ffmpegBlob });
  expect(r.engine).toBe('ffmpeg');
  expect(fast).not.toHaveBeenCalled();
});
