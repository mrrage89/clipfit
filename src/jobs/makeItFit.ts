export interface MakeItFitParams {
  inputName: string;
  outputName: string;
  videoKbps: number;
  audioKbps: number; // 0 => strip audio
  maxDimension?: number; // cap the longest side (downscale only); default 1280
}

// Returns an array of ffmpeg arg-arrays (one entry = one pass).
export function buildMakeItFitArgs(p: MakeItFitParams): string[][] {
  const maxDim = p.maxDimension ?? 1280;
  const audio =
    p.audioKbps > 0 ? ['-c:a', 'aac', '-b:a', `${p.audioKbps}k`] : ['-an'];
  // Downscale large videos to fit within a maxDim box. This keeps the wasm
  // encoder's per-frame memory bounded (avoids OOM on 4K/large inputs) and
  // improves quality-per-bit at small targets. Never upscales; preserves aspect;
  // forces even dimensions (required by yuv420p / libx264).
  const scale =
    `scale='min(${maxDim},iw)':'min(${maxDim},ih)':` +
    `force_original_aspect_ratio=decrease:force_divisible_by=2`;
  return [
    [
      '-i', p.inputName,
      '-vf', scale,
      '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${p.videoKbps}k`,
      ...audio,
      '-movflags', '+faststart',
      p.outputName,
    ],
  ];
}
