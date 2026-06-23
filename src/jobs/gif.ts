import type { Job } from './types';

export interface GifParams {
  fps: number;
  width: number;
  startSec?: number;
  lengthSec?: number;
  maxColors?: number; // default 256 (full palette)
  dither?: 'none' | 'bayer' | 'sierra'; // default sierra (sharpest, largest)
}

// Two-pass palettegen/paletteuse for good-quality GIFs.
// GIF has essentially no inter-frame compression, so size scales with
// duration * fps * frame area. The biggest quality-preserving size lever is the
// palette size (fewer colors -> smaller indices -> smaller LZW stream).
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

    const colors = p.maxColors ?? 256;
    const palettegen = colors < 256 ? `palettegen=max_colors=${colors}` : 'palettegen';
    const dither =
      p.dither === 'none' ? 'none' : p.dither === 'bayer' ? 'bayer:bayer_scale=5' : 'sierra2_4a';

    return [
      [...seek, '-i', input, '-vf', `${vf},${palettegen}`, 'palette.png'],
      [...seek, '-i', input, '-i', 'palette.png', '-lavfi', `${vf},paletteuse=dither=${dither}`, output],
    ];
  },
};
