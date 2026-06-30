// Video bitrate (kbps) when audio is copied through unchanged: subtract the known
// audio byte size from the target, give the rest to video. Returns 0 when it can't
// fit (caller then falls back to ffmpeg, which can re-encode audio to make room).
export function videoKbpsForCopiedAudio(opts: {
  targetBytes: number;
  durationSec: number;
  audioBytes: number;
  safetyMargin: number;
}): number {
  if (opts.durationSec <= 0) return 0;
  const usable = opts.targetBytes * opts.safetyMargin - opts.audioBytes;
  if (usable <= 0) return 0;
  const kbps = (usable * 8) / 1000 / opts.durationSec;
  return Math.max(1, Math.floor(kbps));
}
