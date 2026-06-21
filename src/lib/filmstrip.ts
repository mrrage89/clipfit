// Evenly-spaced timestamps for a filmstrip of `count` thumbnails across a clip.
export function thumbTimes(durationSec: number, count: number): number[] {
  if (count <= 1 || durationSec <= 0) return [0];
  return Array.from({ length: count }, (_, i) => (i / (count - 1)) * durationSec);
}

// Index of the filmstrip thumbnail nearest a given time.
export function nearestThumb(timeSec: number, durationSec: number, count: number): number {
  if (durationSec <= 0 || count <= 1) return 0;
  const idx = Math.round((timeSec / durationSec) * (count - 1));
  return Math.max(0, Math.min(count - 1, idx));
}
