import type { CompressRouteInput, EngineChoice } from './types';

// Pure decision: use the WebCodecs fast-path only when every precondition holds;
// otherwise the existing ffmpeg.wasm path (which can do everything) handles it.
export function selectCompressEngine(r: CompressRouteInput): EngineChoice {
  if (r.quality !== 'balanced') return 'ffmpeg';
  if (r.hasUnsupportedEdits) return 'ffmpeg';
  if (r.inputContainer !== 'mp4') return 'ffmpeg';
  if (!r.inputDecodable) return 'ffmpeg';
  if (!r.outputEncodable) return 'ffmpeg';
  if (!r.audioOk) return 'ffmpeg';
  return 'webcodecs';
}
