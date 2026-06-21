import type { Job } from './types';

export interface TrimParams {
  startSec: number;
  endSec: number;
}

// Fast, keyframe-aligned trim via input-seek + stream copy (no re-encode).
export const trimJob: Job<TrimParams> = {
  id: 'trim',
  label: 'Trim',
  accept: 'video/*',
  output: () => ({ name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-trimmed.mp4' }),
  buildPasses(input, output, _ctx, p) {
    const dur = Math.max(0, p.endSec - p.startSec);
    return [['-ss', String(p.startSec), '-t', String(dur), '-i', input, '-c', 'copy', output]];
  },
};
