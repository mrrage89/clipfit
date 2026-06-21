import type { Job } from './types';

export interface CropParams {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const cropJob: Job<CropParams> = {
  id: 'crop',
  label: 'Crop',
  accept: 'video/*',
  output: () => ({ name: 'output.mp4', mime: 'video/mp4', downloadName: 'clipfit-cropped.mp4' }),
  buildPasses(input, output, _ctx, p) {
    return [
      [
        '-i', input,
        '-vf', `crop=${p.w}:${p.h}:${p.x}:${p.y}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy',
        output,
      ],
    ];
  },
};
