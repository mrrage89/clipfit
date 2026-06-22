export interface MakeItFitParams {
  inputName: string;
  outputName: string;
  videoKbps: number;
  audioKbps: number; // 0 => strip audio
  maxDimension?: number; // cap longest side (downscale only); default 1280
  preset?: string; // x264 preset; default 'veryfast'
  twoPass?: boolean; // default false (single pass)
}

// Returns an array of ffmpeg arg-arrays (one entry per pass).
export function buildMakeItFitArgs(p: MakeItFitParams): string[][] {
  const maxDim = p.maxDimension ?? 1280;
  const preset = p.preset ?? 'veryfast';
  const scale =
    `scale='min(${maxDim},iw)':'min(${maxDim},ih)':` +
    `force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const audio = p.audioKbps > 0 ? ['-c:a', 'aac', '-b:a', `${p.audioKbps}k`] : ['-an'];
  // Video options must be identical across both passes for two-pass to be valid.
  const video = [
    '-vf', scale,
    '-c:v', 'libx264', '-preset', preset, '-pix_fmt', 'yuv420p', '-b:v', `${p.videoKbps}k`,
  ];

  if (!p.twoPass) {
    return [['-i', p.inputName, ...video, ...audio, '-movflags', '+faststart', p.outputName]];
  }
  // Pass 1 analyzes (no audio, output discarded); pass 2 distributes bits optimally.
  return [
    ['-i', p.inputName, ...video, '-pass', '1', '-an', '-f', 'null', '-'],
    ['-i', p.inputName, ...video, '-pass', '2', ...audio, '-movflags', '+faststart', p.outputName],
  ];
}
