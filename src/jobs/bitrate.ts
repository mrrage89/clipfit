export interface BitrateInput {
  targetBytes: number;
  durationSec: number;
  audioKbps: number; // 0 = no audio / stripped
  safetyMargin?: number; // default 0.95
  minVideoKbps?: number; // default 100
}

export function computeVideoKbps(input: BitrateInput): number {
  const { targetBytes, durationSec, audioKbps } = input;
  const safetyMargin = input.safetyMargin ?? 0.95;
  const minVideoKbps = input.minVideoKbps ?? 100;
  if (durationSec <= 0) throw new Error('durationSec must be positive');

  const totalBits = targetBytes * 8 * safetyMargin;
  const audioBits = audioKbps * 1000 * durationSec;
  const videoKbps = Math.floor((totalBits - audioBits) / durationSec / 1000);
  return Math.max(minVideoKbps, videoKbps);
}

export function isTargetAchievable(input: BitrateInput): boolean {
  const minVideoKbps = input.minVideoKbps ?? 100;
  const totalBits = input.targetBytes * 8 * (input.safetyMargin ?? 0.95);
  const audioBits = input.audioKbps * 1000 * input.durationSec;
  return (totalBits - audioBits) / input.durationSec / 1000 >= minVideoKbps;
}

// Pick a max output dimension the given video bitrate can support at decent
// quality. Combined with the scale filter's min(dim, source), this never
// upscales — it just stops over-downscaling when the budget allows more pixels.
export function pickMaxDimension(videoKbps: number): number {
  if (videoKbps >= 3500) return 1920;
  if (videoKbps >= 1800) return 1280;
  if (videoKbps >= 900) return 854;
  if (videoKbps >= 450) return 640;
  return 480;
}
