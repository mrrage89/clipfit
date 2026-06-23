import type { Job } from './types';

export interface GifParams {
  fps: number;
  width: number;
  startSec?: number;
  lengthSec?: number;
}

// Two-pass palettegen/paletteuse for good-quality GIFs.
// GIF has essentially no inter-frame compression, so size scales with
// duration * fps * frame area — a length cap is what keeps the file sane.
export const gifJob: Job<GifParams> = {
  id: 'gif',
  label: 'Video → GIF',
  accept: 'video/*',
  output: () => ({ name: 'output.gif', mime: 'image/gif', downloadName: 'clipfit.gif' }),
  buildPasses(input, output, _ctx, p) {
    const vf = `fps=${p.fps},scale=${p.width}:-1:flags=lanczos`;
    const seek: string[] = [];
    if (p.startSec && p.startSec > 0) seek.push('-ss', String(p.startSec));
    if (p.lengthSec && p.lengthSec > 0) seek.push('-t', String(p.lengthSec));
    return [
      [...seek, '-i', input, '-vf', `${vf},palettegen`, 'palette.png'],
      [...seek, '-i', input, '-i', 'palette.png', '-lavfi', `${vf},paletteuse`, output],
    ];
  },
};
