import type { Job } from './types';
import { computeVideoKbps, pickMaxDimension } from './bitrate';
import { buildMakeItFitArgs } from './makeItFit';

export interface FitParams {
  targetBytes: number;
  mute: boolean;
  quality: 'balanced' | 'best';
}

export const fitJob: Job<FitParams> = {
  id: 'fit',
  label: 'Make it fit',
  accept: 'video/*',
  output: () => ({ name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-output.mp4' }),
  buildPasses(input, output, ctx, params) {
    const best = params.quality === 'best';
    // Leaner audio when the per-second budget is tight, freeing bits for video.
    const bytesPerSec = ctx.durationSec > 0 ? params.targetBytes / ctx.durationSec : Infinity;
    const audioKbps = params.mute ? 0 : bytesPerSec < 150 * 1024 ? 96 : 128;
    const videoKbps = computeVideoKbps({
      targetBytes: params.targetBytes,
      durationSec: ctx.durationSec,
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
      preset: best ? 'medium' : 'fast',
      twoPass: best,
    });
  },
};
