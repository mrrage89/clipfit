import { selectCompressEngine } from './router';
import type { CompressRouteInput } from './types';

export { compressFast } from './compress';
export type { FastCompressParams } from './compress';

// Orchestrate: route to WebCodecs when eligible, but ANY failure (or an empty
// blob) transparently falls back to ffmpeg.wasm. WebCodecs can never make a job
// fail that ffmpeg could complete.
export async function runCompressFast(args: {
  route: CompressRouteInput;
  fast: () => Promise<Blob>;
  ffmpeg: () => Promise<Blob>;
}): Promise<{ blob: Blob; engine: 'webcodecs' | 'ffmpeg' }> {
  if (selectCompressEngine(args.route) === 'ffmpeg') {
    return { blob: await args.ffmpeg(), engine: 'ffmpeg' };
  }
  try {
    const blob = await args.fast();
    if (!blob || blob.size === 0) throw new Error('empty output');
    return { blob, engine: 'webcodecs' };
  } catch (e) {
    console.warn('[clipfit] webcodecs failed, falling back to ffmpeg:', e);
    return { blob: await args.ffmpeg(), engine: 'ffmpeg' };
  }
}
