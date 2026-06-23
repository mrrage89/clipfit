import type { Job } from './types';
import { computeVideoKbps, pickMaxDimension } from './bitrate';
import { buildMakeItFitArgs } from './makeItFit';
import { buildEditChain, effectiveDurationSec, type Edits } from './editChain';

export interface FitParams {
  targetBytes: number;
  mute: boolean;
  quality: 'balanced' | 'best';
  format?: 'mp4' | 'webm'; // default mp4
  edits?: Edits;
}

// Slower x264 presets squeeze more quality per bit; cap effort by duration so
// single-thread wasm encode time stays reasonable on long clips.
export function bestPreset(durationSec: number): string {
  if (durationSec <= 20) return 'veryslow';
  if (durationSec <= 60) return 'slower';
  return 'slow';
}

export const fitJob: Job<FitParams> = {
  id: 'fit',
  label: 'Compress',
  accept: 'video/*',
  output: (p) =>
    p.format === 'webm'
      ? { name: 'output.webm', mime: 'video/webm', downloadName: 'clipfit.webm' }
      : { name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-output.mp4' },
  buildPasses(input, output, ctx, params) {
    const best = params.quality === 'best';
    const dur = effectiveDurationSec(ctx.durationSec, params.edits);
    const chain = buildEditChain(params.edits, ctx.hasAudio && !params.mute);
    // Leaner audio when the per-second budget is tight, freeing bits for video.
    const bytesPerSec = dur > 0 ? params.targetBytes / dur : Infinity;
    const audioKbps = params.mute ? 0 : bytesPerSec < 150 * 1024 ? 96 : 128;
    const videoKbps = computeVideoKbps({
      targetBytes: params.targetBytes,
      durationSec: dur,
      audioKbps,
      // Two-pass hits the target accurately, so we can use more of the budget.
      safetyMargin: best ? 0.97 : 0.95,
    });
    return buildMakeItFitArgs({
      inputName: input,
      outputName: output,
      videoKbps,
      audioKbps,
      maxDimension: pickMaxDimension(videoKbps),
      preset: best ? bestPreset(dur) : 'fast',
      twoPass: best,
      format: params.format,
      seek: chain.seek,
      editVf: chain.vf,
      editAf: chain.af,
    });
  },
};
