export interface MakeItFitParams {
  inputName: string;
  outputName: string;
  videoKbps: number;
  audioKbps: number; // 0 => strip audio
}

// Returns an array of ffmpeg arg-arrays (one entry = one pass).
export function buildMakeItFitArgs(p: MakeItFitParams): string[][] {
  const audio =
    p.audioKbps > 0 ? ['-c:a', 'aac', '-b:a', `${p.audioKbps}k`] : ['-an'];
  return [
    [
      '-i', p.inputName,
      '-c:v', 'libx264', '-b:v', `${p.videoKbps}k`,
      ...audio,
      '-movflags', '+faststart',
      p.outputName,
    ],
  ];
}
