import type { Job } from './types';
import type { EditParams } from './edit';

// Combined editor job: applies trim + crop + edits in ONE ffmpeg pass.
export interface StudioParams {
  trim?: { startSec: number; endSec: number };
  crop?: { x: number; y: number; w: number; h: number };
  edit?: EditParams;
}

export const studioJob: Job<StudioParams> = {
  id: 'studio',
  label: 'Edit',
  accept: 'video/*',
  output: () => ({ name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-edit.mp4' }),
  buildPasses(input, output, ctx, p) {
    const pre: string[] = [];
    if (p.trim) {
      pre.push('-ss', String(p.trim.startSec), '-t', String(Math.max(0, p.trim.endSec - p.trim.startSec)));
    }

    const e = p.edit ?? {};
    const vf: string[] = [];
    if (p.crop) vf.push(`crop=${p.crop.w}:${p.crop.h}:${p.crop.x}:${p.crop.y}`);
    if (e.rotate === 90) vf.push('transpose=1');
    else if (e.rotate === 180) vf.push('transpose=1', 'transpose=1');
    else if (e.rotate === 270) vf.push('transpose=2');
    if (e.flipH) vf.push('hflip');
    if (e.flipV) vf.push('vflip');
    if (e.speed && e.speed !== 1) vf.push(`setpts=PTS/${e.speed}`);
    if (e.fps && e.fps > 0) vf.push(`fps=${e.fps}`);

    const af: string[] = [];
    if (ctx.hasAudio) {
      if (e.speed && e.speed !== 1) af.push(`atempo=${e.speed}`);
      if (e.volumeDb && e.volumeDb !== 0) af.push(`volume=${e.volumeDb}dB`);
    }

    const args = [...pre, '-i', input];
    if (vf.length) {
      args.push('-vf', vf.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
    } else {
      args.push('-c:v', 'copy');
    }
    if (!ctx.hasAudio) args.push('-an');
    else if (af.length) args.push('-af', af.join(','), '-c:a', 'aac');
    else args.push('-c:a', 'copy');
    args.push(output);
    return [args];
  },
};
