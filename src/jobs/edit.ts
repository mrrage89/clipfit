import type { Job } from './types';

export interface EditParams {
  rotate?: 0 | 90 | 180 | 270; // degrees clockwise
  flipH?: boolean;
  flipV?: boolean;
  speed?: number; // playback rate (1 = unchanged); atempo limits to 0.5–2
  fps?: number; // target frame rate (0/undefined = keep)
  volumeDb?: number; // audio gain in dB (0 = unchanged)
}

export const editJob: Job<EditParams> = {
  id: 'edit',
  label: 'Edit',
  accept: 'video/*',
  output: () => ({ name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-edited.mp4' }),
  buildPasses(input, output, ctx, p) {
    const vf: string[] = [];
    if (p.rotate === 90) vf.push('transpose=1');
    else if (p.rotate === 180) vf.push('transpose=1', 'transpose=1');
    else if (p.rotate === 270) vf.push('transpose=2');
    if (p.flipH) vf.push('hflip');
    if (p.flipV) vf.push('vflip');
    if (p.speed && p.speed !== 1) vf.push(`setpts=PTS/${p.speed}`);
    if (p.fps && p.fps > 0) vf.push(`fps=${p.fps}`);

    const af: string[] = [];
    if (ctx.hasAudio) {
      if (p.speed && p.speed !== 1) af.push(`atempo=${p.speed}`);
      if (p.volumeDb && p.volumeDb !== 0) af.push(`volume=${p.volumeDb}dB`);
    }

    const args = ['-i', input];
    if (vf.length) {
      args.push('-vf', vf.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
    } else {
      args.push('-c:v', 'copy');
    }
    if (!ctx.hasAudio) {
      args.push('-an');
    } else if (af.length) {
      args.push('-af', af.join(','), '-c:a', 'aac');
    } else {
      args.push('-c:a', 'copy');
    }
    args.push(output);
    return [args];
  },
};
