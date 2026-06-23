export interface MakeItFitParams {
  inputName: string;
  outputName: string;
  videoKbps: number;
  audioKbps: number; // 0 => strip audio
  maxDimension?: number; // cap longest side (downscale only); default 1280
  preset?: string; // x264 preset; default 'veryfast'
  twoPass?: boolean; // default false (single pass)
  aqMode?: number; // x264 aq-mode (perceptual bit allocation); omitted when unset
  format?: 'mp4' | 'webm'; // default 'mp4'
  seek?: string[]; // trim input-seek args (before -i)
  editVf?: string[]; // edit video filters, applied before scale
  editAf?: string[]; // edit audio filters
}

// Returns an array of ffmpeg arg-arrays (one entry per pass).
export function buildMakeItFitArgs(p: MakeItFitParams): string[][] {
  const maxDim = p.maxDimension ?? 1280;
  const preset = p.preset ?? 'veryfast';
  const webm = p.format === 'webm';
  const scale =
    `scale='min(${maxDim},iw)':'min(${maxDim},ih)':` +
    `force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const vf = [...(p.editVf ?? []), scale].join(',');
  const seek = p.seek ?? [];

  const vcodec = webm
    ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', `${p.videoKbps}k`]
    : [
        '-c:v', 'libx264', '-preset', preset,
        ...(p.aqMode ? ['-x264-params', `aq-mode=${p.aqMode}`] : []),
        '-pix_fmt', 'yuv420p', '-b:v', `${p.videoKbps}k`,
      ];
  // Video options must be identical across both passes for two-pass to be valid.
  const video = ['-vf', vf, ...vcodec];

  const editAf = p.editAf?.length ? ['-af', p.editAf.join(',')] : [];
  const acodec = webm
    ? ['-c:a', 'libopus', '-b:a', `${p.audioKbps}k`]
    : ['-c:a', 'aac', '-b:a', `${p.audioKbps}k`];
  const audio = p.audioKbps > 0 ? [...editAf, ...acodec] : ['-an'];
  const finalize = webm ? [] : ['-movflags', '+faststart'];

  if (!p.twoPass) {
    return [[...seek, '-i', p.inputName, ...video, ...audio, ...finalize, p.outputName]];
  }
  // Pass 1 analyzes (no audio, output discarded); pass 2 distributes bits optimally.
  return [
    [...seek, '-i', p.inputName, ...video, '-pass', '1', '-an', '-f', 'null', '-'],
    [...seek, '-i', p.inputName, ...video, '-pass', '2', ...audio, ...finalize, p.outputName],
  ];
}
