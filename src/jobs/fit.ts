import type { Job } from './types';
import { computeVideoKbps } from './bitrate';
import { buildMakeItFitArgs } from './makeItFit';

export interface FitParams {
  targetBytes: number;
  mute: boolean;
}

export const fitJob: Job<FitParams> = {
  id: 'fit',
  label: 'Make it fit',
  accept: 'video/*',
  outputName: 'output.mp4',
  mime: 'video/mp4',
  downloadName: 'clipfit-output.mp4',
  buildPasses(input, output, ctx, params) {
    const audioKbps = params.mute ? 0 : 128;
    const videoKbps = computeVideoKbps({
      targetBytes: params.targetBytes,
      durationSec: ctx.durationSec,
      audioKbps,
    });
    return buildMakeItFitArgs({ inputName: input, outputName: output, videoKbps, audioKbps });
  },
};
