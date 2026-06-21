import type { Job } from './types';

export interface GifParams {
  fps: number;
  width: number;
}

// Two-pass palettegen/paletteuse for good-quality GIFs.
export const gifJob: Job<GifParams> = {
  id: 'gif',
  label: 'Video → GIF',
  accept: 'video/*',
  output: () => ({ name: 'output.gif', mime: 'image/gif', downloadName: 'clipfit.gif' }),
  buildPasses(input, output, _ctx, p) {
    const vf = `fps=${p.fps},scale=${p.width}:-1:flags=lanczos`;
    return [
      ['-i', input, '-vf', `${vf},palettegen`, 'palette.png'],
      ['-i', input, '-i', 'palette.png', '-lavfi', `${vf},paletteuse`, output],
    ];
  },
};
