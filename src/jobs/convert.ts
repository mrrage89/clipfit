import type { Job } from './types';

export interface ConvertParams {
  target: 'mp4' | 'webm';
}

export const convertJob: Job<ConvertParams> = {
  id: 'convert',
  label: 'Convert format',
  accept: 'video/*',
  output: (p) =>
    p.target === 'webm'
      ? { name: 'output.webm', mime: 'video/webm', downloadName: 'clipfit.webm' }
      : { name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit.mp4' },
  buildPasses(input, output, _ctx, p) {
    if (p.target === 'webm') {
      return [
        ['-i', input, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-c:a', 'libopus', output],
      ];
    }
    return [
      ['-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', output],
    ];
  },
};
